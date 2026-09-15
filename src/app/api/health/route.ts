import { NextResponse, type NextRequest } from "next/server";
import { classifyDbError, getDb, pendingMigrations } from "@/lib/db/client";
import { clientIp } from "@/lib/site-request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deployment check for the operator: is the database reachable and is its schema current? Only a failure
 * category is reported (never the connection string or the raw error, which goes to the function logs),
 * so this is the first thing to open after a deploy or after a "server error" on a login page.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`health:${clientIp(req.headers) || "unknown"}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const headers = { "cache-control": "no-store" };
  try {
    const db = await getDb();
    const pending = await pendingMigrations(db);
    const ok = pending.length === 0;
    return NextResponse.json({ ok, database: ok ? "ok" : "schema", backend: db.backend, pendingMigrations: pending }, { status: ok ? 200 : 503, headers });
  } catch (e) {
    const failure = classifyDbError(e) ?? "error";
    console.error(`[health] database ${failure}:`, e);
    return NextResponse.json({ ok: false, database: failure }, { status: 503, headers });
  }
}
