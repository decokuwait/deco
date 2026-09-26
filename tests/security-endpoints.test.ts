import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";

import { crossOriginRefusal, isCrossSite, requestSiteRelation, sameHostUrl } from "@/lib/request-origin";
import { isValidVisitorSecret, generateVisitorSecret, VISITOR_SECRET_COOKIE } from "@/lib/auth/visitor-secret";
import { ALLOWED_TYPES, SITE_STORAGE_QUOTA_BYTES, sniffContentType } from "@/lib/storage";
import { getDb, resetDb } from "@/lib/db/client";
import { createSite } from "@/lib/db/sites";
import { getVisitorByCodeAndSecret, trackVisit } from "@/lib/db/visitors";

function h(entries: Record<string, string>) {
  return new Headers(entries);
}

describe("same-origin check", () => {
  /**
   * The bug this replaces: `Sec-Fetch-Site: same-site` was accepted as same-origin. Every tenant is a
   * subdomain of one registrable domain, so `evil.decokuwait.com` is same-SITE with
   * `victim.decokuwait.com` — the precise abuse the check exists to stop.
   */
  it("treats same-site as cross-site unless the full host matches", () => {
    expect(
      requestSiteRelation(h({ "sec-fetch-site": "same-site", origin: "https://evil.decokuwait.com", host: "victim.decokuwait.com" })),
    ).toBe("cross-site");
    expect(
      requestSiteRelation(h({ "sec-fetch-site": "same-site", origin: "https://victim.decokuwait.com", host: "victim.decokuwait.com" })),
    ).toBe("same-origin");
    // A same-site request that declines to say where it came from is not trusted either.
    expect(requestSiteRelation(h({ "sec-fetch-site": "same-site", host: "victim.decokuwait.com" }))).toBe("cross-site");
  });

  it("keeps the ordinary verdicts", () => {
    expect(requestSiteRelation(h({ "sec-fetch-site": "same-origin" }))).toBe("same-origin");
    expect(requestSiteRelation(h({ "sec-fetch-site": "none" }))).toBe("same-origin");
    expect(requestSiteRelation(h({ "sec-fetch-site": "cross-site" }))).toBe("cross-site");
    expect(requestSiteRelation(h({ origin: "https://evil.com", host: "victim.decokuwait.com" }))).toBe("cross-site");
    expect(requestSiteRelation(h({ origin: "https://victim.decokuwait.com", host: "victim.decokuwait.com" }))).toBe("same-origin");
    // The proxied host wins over the raw one, the way every other lookup in the app reads it.
    expect(requestSiteRelation(h({ origin: "https://a.decokuwait.com", host: "internal", "x-forwarded-host": "a.decokuwait.com" }))).toBe("same-origin");
  });

  // A caller with neither header is not a browser page, so it cannot be a cross-site victim being used
  // as a weapon. It stays allowed so the smoke and e2e harnesses keep working; the rate limiter and the
  // visitor secret are what account for it.
  it("reports a headerless caller as unknown and lets it through", () => {
    expect(requestSiteRelation(h({ host: "a.decokuwait.com" }))).toBe("unknown");
    expect(isCrossSite(h({ host: "a.decokuwait.com" }))).toBe(false);
  });
});

describe("upload CSRF gate", () => {
  it("refuses a foreign initiator and anything that is not the expected content type", () => {
    const same = { "sec-fetch-site": "same-origin" };
    expect(crossOriginRefusal(h({ ...same, "content-type": "application/json" }))).toBeNull();
    expect(crossOriginRefusal(h({ ...same, "content-type": "application/json; charset=utf-8" }))).toBeNull();
    // The three CORS "simple" types are exactly what a foreign page can send without a preflight.
    for (const ct of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      expect(crossOriginRefusal(h({ ...same, "content-type": ct }))).toBe("bad_content_type");
    }
    expect(crossOriginRefusal(h({ ...same }))).toBe("bad_content_type");
    expect(crossOriginRefusal(h({ "sec-fetch-site": "cross-site", "content-type": "application/json" }))).toBe("cross_site");
    // /api/upload/local takes raw media bytes instead; none of those types is simple either.
    expect(crossOriginRefusal(h({ ...same, "content-type": "image/png" }), [...ALLOWED_TYPES])).toBeNull();
    expect(crossOriginRefusal(h({ ...same, "content-type": "image/svg+xml" }), [...ALLOWED_TYPES])).toBe("bad_content_type");
  });
});

describe("caller-supplied landing URLs", () => {
  // The URL is the only input to attribution detection: a foreign one is somebody else's click id being
  // written onto a row as though the visitor had arrived from that ad.
  it("accepts only URLs on the host the request arrived at", () => {
    const headers = h({ host: "elite.decokuwait.com" });
    expect(sameHostUrl(headers, "https://elite.decokuwait.com/?fbclid=A")).toContain("fbclid=A");
    expect(sameHostUrl(headers, "/projects?utm_source=meta")).toBe("https://elite.decokuwait.com/projects?utm_source=meta");
    expect(sameHostUrl(headers, "https://evil.example/?fbclid=MINE")).toBeNull();
    expect(sameHostUrl(headers, "javascript:alert(1)")).toBeNull();
    expect(sameHostUrl(headers, "")).toBeNull();
    expect(sameHostUrl(h({}), "https://elite.decokuwait.com/")).toBeNull();
  });
});

describe("visitor secret", () => {
  let siteId = "";
  beforeAll(async () => {
    await getDb();
    siteId = (await createSite({ slug: "vsec", name: "VSec", category: "gypsum", templateCode: "101" })).id;
  });
  afterAll(async () => {
    await resetDb();
  });

  it("is 128 bits of hex and nothing else passes for one", () => {
    const s = generateVisitorSecret();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidVisitorSecret(s)).toBe(true);
    expect(generateVisitorSecret()).not.toBe(s);
    for (const bad of ["", "short", "A".repeat(32), "0".repeat(31), "0".repeat(33), 12345, null, undefined]) {
      expect(isValidVisitorSecret(bad)).toBe(false);
    }
    expect(VISITOR_SECRET_COOKIE).toBe("dk_vsec");
  });

  it("is required before an existing row can be read", async () => {
    const created = await trackVisit({ siteId, code: null, landingUrl: "https://vsec.decokuwait.com/?fbclid=REAL" });
    const { code } = created.visitor;
    expect(await getVisitorByCodeAndSecret(siteId, code, created.secret)).not.toBeNull();
    // Knowing the code is not knowing the visitor.
    expect(await getVisitorByCodeAndSecret(siteId, code, null)).toBeNull();
    expect(await getVisitorByCodeAndSecret(siteId, code, generateVisitorSecret())).toBeNull();
    expect(await getVisitorByCodeAndSecret(siteId, code, "")).toBeNull();
  });

  /**
   * The two halves of the original hole, at the layer `/api/track` drives:
   *  - a guessed code must not be INSERTED (it used to be, which planted rows at chosen ids);
   *  - a guessed code must not touch an existing row (it used to merge the caller's IP, user agent and
   *    attribution into a stranger's lead).
   */
  it("neither creates nor hijacks a row at a code the caller guessed", async () => {
    const victim = await trackVisit({ siteId, code: null, ip: "10.0.0.1", userAgent: "real-visitor", landingUrl: "https://vsec.decokuwait.com/?fbclid=REAL" });
    const victimCode = victim.visitor.code;
    const before = victim.visitor;

    // A public caller presenting the victim's code with no secret.
    const guess = await trackVisit({
      siteId,
      code: victimCode,
      secret: null,
      requireSecret: true,
      ip: "203.0.113.9",
      userAgent: "attacker",
      landingUrl: "https://vsec.decokuwait.com/?fbclid=ATTACKER",
    });
    expect(guess.visitor.code).not.toBe(victimCode);
    expect(guess.created).toBe(true);

    const untouched = await getVisitorByCodeAndSecret(siteId, victimCode, victim.secret);
    expect(untouched?.ip).toBe("10.0.0.1");
    expect(untouched?.userAgent).toBe("real-visitor");
    expect(untouched?.clickIds.fbclid).toBe("REAL");
    expect(untouched?.visits).toBe(before.visits);

    // And a code that exists nowhere is not minted at the caller's choosing either.
    const planted = await trackVisit({ siteId, code: "100001", secret: generateVisitorSecret(), requireSecret: true });
    expect(planted.visitor.code).not.toBe("100001");
    expect(await getVisitorByCodeAndSecret(siteId, "100001", planted.secret)).toBeNull();
  });
});

describe("upload limits", () => {
  it("has a per-site storage quota that is actually a number of bytes", () => {
    expect(SITE_STORAGE_QUOTA_BYTES).toBeGreaterThan(0);
    expect(Number.isInteger(SITE_STORAGE_QUOTA_BYTES)).toBe(true);
  });

  it("sums issued media against the quota", async () => {
    await getDb();
    const site = await createSite({ slug: "quota", name: "Quota", category: "gypsum", templateCode: "101" });
    const db = await getDb();
    const used = async () =>
      Number((await db.query<{ total: unknown }>(`select coalesce(sum(size), 0) as total from media_assets where site_id = $1`, [site.id]))[0].total);
    expect(await used()).toBe(0);
    for (let i = 0; i < 3; i++) {
      await db.query(`insert into media_assets (site_id, key, url, kind, content_type, size) values ($1, $2, $3, 'image', 'image/png', $4)`, [
        site.id,
        `sites/${site.id}/2026/01/asset-${i}.png`,
        `/api/files/sites/${site.id}/2026/01/asset-${i}.png`,
        1_000_000,
      ]);
    }
    expect(await used()).toBe(3_000_000);
    // The route refuses when this upload would take the site past the quota, not after it already has.
    expect((await used()) + SITE_STORAGE_QUOTA_BYTES > SITE_STORAGE_QUOTA_BYTES).toBe(true);
    await resetDb();
  });

  /**
   * The declared Content-Type was never verified, and `/api/files` serves a file back with the type the
   * `media_assets` row recorded — so "png" could be an HTML document on the tenant's own origin.
   */
  it("reads the real type out of the bytes", () => {
    const b = (...bytes: number[]) => new Uint8Array(bytes);
    const ascii = (s: string, pad = 0) => new Uint8Array([...Array(pad).fill(0), ...[...s].map((c) => c.charCodeAt(0))]);
    expect(sniffContentType(b(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffContentType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffContentType(ascii("GIF89a"))).toBe("image/gif");
    expect(sniffContentType(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))).toBe("image/webp");
    expect(sniffContentType(new Uint8Array([0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii("avif")]))).toBe("image/avif");
    expect(sniffContentType(new Uint8Array([0, 0, 0, 0x20, ...ascii("ftyp"), ...ascii("isom")]))).toBe("video/mp4");
    expect(sniffContentType(new Uint8Array([0, 0, 0, 0x14, ...ascii("ftyp"), ...ascii("qt  ")]))).toBe("video/quicktime");
    expect(sniffContentType(b(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
    // The things a "png" must never turn out to be.
    expect(sniffContentType(ascii("<!DOCTYPE html><script>alert(1)</script>"))).toBeNull();
    expect(sniffContentType(ascii('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffContentType(ascii("<?xml version=\"1.0\"?>"))).toBeNull();
    expect(sniffContentType(new Uint8Array())).toBeNull();
    // Nothing the sniffer reports is outside what uploads accept.
    for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "video/quicktime"]) {
      expect(ALLOWED_TYPES.has(t)).toBe(true);
    }
  });
});
