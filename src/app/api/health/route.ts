import { NextResponse, type NextRequest } from "next/server";
import { classifyDbError, getDb, pendingMigrations } from "@/lib/db/client";
import { clientIp } from "@/lib/site-request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Region token of a Supabase pooler host (aws-0-ap-south-1.pooler.supabase.com -> ap-south-1); nothing else is revealed. */
function databaseRegion(): string | null {
  const m = /@[^/?]*?aws-\d+-([a-z]{2}-[a-z]+-\d)\./.exec(process.env.DATABASE_URL || "");
  return m ? m[1] : null;
}

/**
 * Deployment check for the operator: is the database reachable and is its schema current? Only a failure
 * category is reported (never the connection string or the raw error, which goes to the function logs),
 * so this is the first thing to open after a deploy or after a "server error" on a login page.
 * `region` / `databaseRegion` / `dbLatencyMs` show whether the function runs next to the database — every
 * tenant page pays several round trips, so a transatlantic pair is the usual cause of slow first loads.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`health:${clientIp(req.headers) || "unknown"}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const headers = { "cache-control": "no-store" };
  const region = process.env.VERCEL_REGION || null;
  try {
    const db = await getDb();
    const pending = await pendingMigrations(db);
    const t0 = performance.now();
    await db.query(`select 1`);
    const dbLatencyMs = Math.round(performance.now() - t0);
    const ok = pending.length === 0;
    return NextResponse.json({ ok, database: ok ? "ok" : "schema", backend: db.backend, pendingMigrations: pending, region, databaseRegion: databaseRegion(), dbLatencyMs }, { status: ok ? 200 : 503, headers });
  } catch (e) {
    const failure = classifyDbError(e) ?? "error";
    console.error(`[health] database ${failure}:`, e);
    return NextResponse.json({ ok: false, database: failure, region }, { status: 503, headers });
  }
}
