/**
 * Small in-memory token bucket used by the public tracking endpoints. It is per server instance
 * (good enough to stop naive floods on Vercel where each instance handles many requests); pair it with
 * a Vercel WAF rate-limit rule for hard guarantees. Buckets are pruned lazily.
 */
const buckets = new Map<string, { tokens: number; updated: number }>();
const MAX_KEYS = 20000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
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

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
