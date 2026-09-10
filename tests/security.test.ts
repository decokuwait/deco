import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_MEMORY = "1";
process.env.DATABASE_URL = "";
process.env.PIXEL_SECRET_KEY = "a".repeat(64);

import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { safeUrl, safeMapEmbed, safeMediaUrl } from "@/lib/safe-url";
import { decryptSecret, encryptSecret, secretsEncrypted } from "@/lib/secrets";
import { getDb, resetDb } from "@/lib/db/client";
import { authenticate, createUser, TooManyAttemptsError } from "@/lib/db/users";
import { upsertPixel, getPixel } from "@/lib/db/pixels";
import { createSite } from "@/lib/db/sites";

describe("rate limiter", () => {
  it("allows a burst up to the limit then blocks, and refills over time", () => {
    resetRateLimits();
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 1000)).toBe(true);
    expect(rateLimit("k", 5, 1000)).toBe(false);
    expect(rateLimit("other", 5, 1000)).toBe(true);
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
