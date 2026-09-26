import { one, q } from "@/lib/db/client";

/**
 * Rate limiting for the public endpoints.
 *
 * The durable counter lives in the `rate_limits` table. It used to be a module-level Map, which on Vercel
 * means one counter per lambda instance: the real limit was `limit x instance_count` and a cold start reset
 * it to zero, so an attacker enumerating visitor codes only had to out-scale the fleet. The in-memory bucket
 * is kept in front of it as a fast path — it can refuse a flood without a round trip — but it is never the
 * only thing standing between a caller and the database.
 */

const buckets = new Map<string, { tokens: number; updated: number }>();
const MAX_KEYS = 20000;

/**
 * Per-instance token bucket. Synchronous, and deliberately generous: a `false` here is a certain flood, a
 * `true` only means this instance has seen nothing suspicious. Callers on a public path must follow it with
 * `rateLimit`, which consults the shared counter.
 */
export function rateLimitLocal(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const refill = limit / windowMs;
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size > MAX_KEYS) {
      const cutoff = now - windowMs;
      for (const [k, v] of buckets) if (v.updated < cutoff) buckets.delete(k);
      if (buckets.size > MAX_KEYS) buckets.clear();
    }
    b = { tokens: limit, updated: now };
    buckets.set(key, b);
  }
  b.tokens = Math.min(limit, b.tokens + (now - b.updated) * refill);
  b.updated = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// Sweeping expired rows costs a write, so it does not run on every check.
let lastSweep = 0;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * Fixed-window counter shared by every instance. One atomic upsert per check, so two instances incrementing
 * the same key at the same moment cannot both read the pre-increment value.
 *
 * Returns true when the call is within the limit. A database failure returns true: the limiter exists to
 * blunt abuse, and refusing every visit of every tenant site because one query timed out trades an abuse
 * problem for an outage. The in-memory bucket still applies in that case.
 */
export async function rateLimitShared(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const row = await one<{ count: number }>(
      `insert into rate_limits (key, count, window_start, updated_at) values ($1, 1, now(), now())
       on conflict (key) do update set
         count = case when rate_limits.window_start < now() - (interval '1 second' * $2::double precision) then 1 else rate_limits.count + 1 end,
         window_start = case when rate_limits.window_start < now() - (interval '1 second' * $2::double precision) then now() else rate_limits.window_start end,
         updated_at = now()
       returning count`,
      [key.slice(0, 200), windowSeconds],
    );
    if (Date.now() - lastSweep > SWEEP_EVERY_MS) {
      lastSweep = Date.now();
      // Fire and forget: housekeeping must never add latency to the request that happened to trigger it.
      void q(`delete from rate_limits where updated_at < now() - interval '1 day'`).catch(() => undefined);
    }
    return Number(row?.count ?? 1) <= limit;
  } catch {
    return true;
  }
}

/**
 * The check every public endpoint should use: the local bucket first (free), the shared counter second.
 * `windowSeconds` is seconds, not milliseconds — the durable window is expressed in SQL.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!rateLimitLocal(key, limit, windowSeconds * 1000)) return false;
  return rateLimitShared(key, limit, windowSeconds);
}

/** Test helper. Clears the per-instance buckets only; the shared table is ordinary data. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
