import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";
process.env.PIXEL_SECRET_KEY = "a".repeat(64);

import { rateLimit, rateLimitLocal, rateLimitShared, resetRateLimits } from "@/lib/rate-limit";
import { safeUrl, safeMapEmbed, safeMediaUrl } from "@/lib/safe-url";
import { decryptSecret, encryptSecret, secretsEncrypted } from "@/lib/secrets";
import { getDb, resetDb } from "@/lib/db/client";
import { authenticate, createSession, createUser, getUserBySessionToken, TooManyAttemptsError } from "@/lib/db/users";
import { upsertPixel, getPixel } from "@/lib/db/pixels";
import { createSite } from "@/lib/db/sites";

describe("rate limiter", () => {
  // The per-instance token bucket, which is now only the fast path in front of the shared counter.
  it("allows a burst up to the limit then blocks, and refills over time", () => {
    resetRateLimits();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      for (let i = 0; i < 5; i++) expect(rateLimitLocal("k", 5, 1000)).toBe(true);
      expect(rateLimitLocal("k", 5, 1000)).toBe(false);
      expect(rateLimitLocal("other", 5, 1000)).toBe(true);
      vi.setSystemTime(new Date("2026-01-01T00:00:00.250Z"));
      expect(rateLimitLocal("k", 5, 1000)).toBe(true); // a quarter of the window refills one token
      expect(rateLimitLocal("k", 5, 1000)).toBe(false);
      vi.setSystemTime(new Date("2026-01-01T00:00:05Z"));
      for (let i = 0; i < 5; i++) expect(rateLimitLocal("k", 5, 1000)).toBe(true);
      expect(rateLimitLocal("k", 5, 1000)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("safe urls", () => {
  it("accepts http(s) and our own file paths only", () => {
    expect(safeUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html;base64,AAAA")).toBe("");
    expect(safeUrl("/api/files/sites/x/y.jpg")).toBe("/api/files/sites/x/y.jpg");
    expect(safeUrl("/etc/passwd")).toBe("");
    expect(safeUrl("")).toBe("");
    expect(safeMediaUrl("https://images.unsplash.com/photo-1?w=1")).toContain("unsplash");
  });
  it("only frames Google Maps embeds", () => {
    expect(safeMapEmbed("https://www.google.com/maps/embed?pb=!1m18")).toContain("google.com/maps/embed");
    expect(safeMapEmbed("https://evil.com/maps/embed")).toBe("");
    expect(safeMapEmbed("javascript:alert(1)")).toBe("");
  });
});

describe("secret encryption", () => {
  it("round-trips and marks ciphertext", () => {
    expect(secretsEncrypted()).toBe(true);
    const ct = encryptSecret("EAAB-token")!;
    expect(ct.startsWith("enc:v1:")).toBe(true);
    expect(ct).not.toContain("EAAB-token");
    expect(decryptSecret(ct)).toBe("EAAB-token");
    expect(decryptSecret("plain")).toBe("plain");
    expect(encryptSecret("")).toBe("");
    expect(encryptSecret(null)).toBeNull();
  });
});

describe("database security behaviours", () => {
  beforeAll(async () => {
    await getDb();
  });
  afterAll(async () => {
    await resetDb();
  });
  it("throttles repeated failed logins per email", async () => {
    await createUser({ email: "victim@example.com", password: "Correct-horse-1", isSuper: false });
    for (let i = 0; i < 10; i++) expect(await authenticate("victim@example.com", "wrong", "10.0.0.1")).toBeNull();
    await expect(authenticate("victim@example.com", "Correct-horse-1", "10.0.0.1")).rejects.toBeInstanceOf(TooManyAttemptsError);
    // A different account from a different IP is unaffected.
    expect(await authenticate("nobody@example.com", "x", "10.0.0.2")).toBeNull();
  });
  it("throttles repeated failed logins per client IP across different emails", async () => {
    for (let i = 0; i < 10; i++) expect(await authenticate(`guess${i}@example.com`, "wrong", "10.0.0.9")).toBeNull();
    await expect(authenticate("victim@example.com", "Correct-horse-1", "10.0.0.9")).rejects.toBeInstanceOf(TooManyAttemptsError);
    // The same account from a clean IP is unaffected once its own email counter is not exhausted.
    await createUser({ email: "clean@example.com", password: "Correct-horse-2", isSuper: false });
    expect((await authenticate("clean@example.com", "Correct-horse-2", "10.0.0.10"))?.email).toBe("clean@example.com");
  });
  it("sessions expire absolutely", async () => {
    const u = await createUser({ email: "session@example.com", password: "Correct-horse-3", isSuper: false });
    const { token } = await createSession(u.id);
    expect((await getUserBySessionToken(token))?.id).toBe(u.id);
    await (await getDb()).query(`update sessions set expires_at = now() - interval '1 minute' where user_id = $1`, [u.id]);
    expect(await getUserBySessionToken(token)).toBeNull();
    expect(await getUserBySessionToken("short")).toBeNull();
  });
  /**
   * The counter that matters. The old limiter was a module-level Map, so on Vercel the real limit was
   * `limit x instance_count` and a cold start reset it — which is why the durable one is tested by
   * clearing the in-memory buckets between calls and checking the count still holds.
   */
  it("counts rate-limited calls in the database, not only in this instance's memory", async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      resetRateLimits(); // as if every call landed on a freshly started lambda
      expect(await rateLimit(key, 3, 60)).toBe(true);
    }
    resetRateLimits();
    expect(await rateLimit(key, 3, 60)).toBe(false);
    // A different key has its own window, and the raw shared counter agrees.
    expect(await rateLimitShared(`${key}:other`, 3, 60)).toBe(true);
    const row = await (await getDb()).query<{ count: number }>(`select count from rate_limits where key = $1`, [key]);
    expect(Number(row[0].count)).toBe(4);
  });

  // The window is a real window: an expired one starts the count again rather than staying blocked.
  it("starts a new window once the old one has passed", async () => {
    const key = `test-window:${Date.now()}`;
    expect(await rateLimit(key, 1, 60)).toBe(true);
    resetRateLimits();
    expect(await rateLimit(key, 1, 60)).toBe(false);
    await (await getDb()).query(`update rate_limits set window_start = now() - interval '2 minutes' where key = $1`, [key]);
    resetRateLimits();
    expect(await rateLimit(key, 1, 60)).toBe(true);
  });

  it("stores pixel tokens encrypted at rest and decrypts them on read", async () => {
    const site = await createSite({ slug: "sec", name: "Sec", category: "gypsum", templateCode: "101" });
    await upsertPixel(site.id, "meta", { pixelId: "1", accessToken: "secret-token", active: true, extra: { apiSecret: "s3" } });
    const p = await getPixel(site.id, "meta");
    expect(p?.accessToken).toBe("secret-token");
    expect(p?.extra.apiSecret).toBe("s3");
    const raw = await (await getDb()).query<{ access_token: string; extra: unknown }>(`select access_token, extra from pixels where site_id = $1`, [site.id]);
    expect(raw[0].access_token.startsWith("enc:v1:")).toBe(true);
    expect(JSON.stringify(raw[0].extra)).not.toContain("s3\"");
  });
});
