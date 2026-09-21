import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { classifyDbError, getDb, pendingMigrations } from "@/lib/db/client";
import { clientIp } from "@/lib/site-request";
import { getCurrentUser } from "@/lib/auth/session";
import { storageStatus, uploadProbe } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Region token of a Supabase pooler host (aws-0-ap-south-1.pooler.supabase.com -> ap-south-1); nothing else is revealed. */
function databaseRegion(): string | null {
  const m = /@[^/?]*?aws-\d+-([a-z]{2}-[a-z]+-\d)\./.exec(process.env.DATABASE_URL || "");
  return m ? m[1] : null;
}

/** The origin this request arrived on, so the storage check tests CORS for the host actually being used. */
function requestOrigin(req: NextRequest): string | null {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Whether this caller may see the deployment detail (and trigger the write probe).
 *
 * The bare `{ ok, database }` answer is public so an uptime monitor can use it. Everything else —
 * which migrations are pending, the commit, the region, the storage verdict — describes the deployment,
 * and `?probe=upload` makes the server write and delete a real object in the bucket, so both are for
 * whoever operates the platform: a signed-in super admin, or a `HEALTH_TOKEN` in the URL for monitors.
 */
async function isOperator(req: NextRequest): Promise<boolean> {
  const token = process.env.HEALTH_TOKEN?.trim();
  const given = req.nextUrl.searchParams.get("token");
  if (token && given && sameToken(token, given)) return true;
  try {
    return (await getCurrentUser())?.isSuper === true;
  } catch {
    return false;
  }
}

/**
 * Deployment check for the operator: is the database reachable, is its schema current, and can a site
 * admin actually upload media from this host? Only failure categories are reported (never the connection
 * string, credentials or the raw error, which go to the function logs), so this is the first thing to open
 * after a deploy or when the admin panel fails. Call it on a tenant host to check that host's uploads, and
 * add ?probe=upload to have the server perform one real presigned PUT against the bucket.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`health:${clientIp(req.headers) || "unknown"}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const headers = { "cache-control": "no-store" };
  const operator = await isOperator(req);
  const region = operator ? process.env.VERCEL_REGION || null : null;
  const commit = operator ? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null : null;
  // The upload probe writes a real object, so it is opt-in and operator-only: /api/health?probe=upload.
  // It answers the one question a preflight cannot — whether the bucket accepts what our own code signs.
  const storage = { ...(await storageStatus(requestOrigin(req))), upload: null as Awaited<ReturnType<typeof uploadProbe>> | null };
  if (operator && storage.backend === "r2" && req.nextUrl.searchParams.get("probe") === "upload") storage.upload = await uploadProbe(requestOrigin(req));
  const storageOk = storage.ok && (storage.upload?.ok ?? true);
  try {
    const db = await getDb();
    const pending = await pendingMigrations(db);
    const t0 = performance.now();
    await db.query(`select 1`);
    const dbLatencyMs = Math.round(performance.now() - t0);
    const database = pending.length ? "schema" : "ok";
    const ok = database === "ok" && storageOk;
    const detail = operator
      ? { backend: db.backend, pendingMigrations: pending, storage, commit, region, databaseRegion: databaseRegion(), dbLatencyMs }
      : { storage: { ok: storage.ok } };
    return NextResponse.json({ ok, database, ...detail }, { status: ok ? 200 : 503, headers });
  } catch (e) {
    const failure = classifyDbError(e) ?? "error";
    console.error(`[health] database ${failure}:`, e);
    return NextResponse.json({ ok: false, database: failure, ...(operator ? { storage, commit, region } : {}) }, { status: 503, headers });
  }
}
