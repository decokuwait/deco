import { NextResponse, type NextRequest } from "next/server";
import { classifyDbError, getDb, pendingMigrations } from "@/lib/db/client";
import { clientIp } from "@/lib/site-request";
import { storageStatus } from "@/lib/storage";
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

/**
 * Deployment check for the operator: is the database reachable, is its schema current, and can a site
 * admin actually upload media from this host? Only failure categories are reported (never the connection
 * string, credentials or the raw error, which go to the function logs), so this is the first thing to open
 * after a deploy or when the admin panel fails. Call it on a tenant host to check that host's uploads.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`health:${clientIp(req.headers) || "unknown"}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const headers = { "cache-control": "no-store" };
  const region = process.env.VERCEL_REGION || null;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null;
  const storage = await storageStatus(requestOrigin(req));
  try {
    const db = await getDb();
    const pending = await pendingMigrations(db);
    const t0 = performance.now();
    await db.query(`select 1`);
    const dbLatencyMs = Math.round(performance.now() - t0);
    const database = pending.length ? "schema" : "ok";
    const ok = database === "ok" && storage.ok;
    return NextResponse.json({ ok, database, backend: db.backend, pendingMigrations: pending, storage, commit, region, databaseRegion: databaseRegion(), dbLatencyMs }, { status: ok ? 200 : 503, headers });
  } catch (e) {
    const failure = classifyDbError(e) ?? "error";
    console.error(`[health] database ${failure}:`, e);
    return NextResponse.json({ ok: false, database: failure, storage, commit, region }, { status: 503, headers });
  }
}
