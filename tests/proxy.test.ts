import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_ROOT_DOMAIN = "decokuwait.com";

type Proxy = (req: NextRequest) => Response;
let proxy: Proxy;

function req(url: string, init: { headers?: Record<string, string>; cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("host", new URL(url).host);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(url, { headers });
}

/** Request headers the proxy forwards to the app are exposed as x-middleware-request-<name>. */
function forwarded(res: Response, name: string) {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe("proxy (host routing, visitor cookie, header hygiene)", () => {
  beforeAll(async () => {
    proxy = (await import("@/proxy")).default as Proxy;
  });

  it("passes the platform root through and blocks the internal /tenant tree there", () => {
    const home = proxy(req("https://decokuwait.com/templates"));
    expect(home.headers.get("x-middleware-rewrite")).toBeNull();
    expect(home.status).toBe(200);
    expect(proxy(req("https://decokuwait.com/tenant/x")).status).toBe(404);
    expect(proxy(req("https://www.decokuwait.com/")).headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites tenant hosts to /tenant/<host> and mints a 6-digit visitor id with the fresh marker", () => {
    const res = proxy(req("https://elite.decokuwait.com/?fbclid=1"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/tenant/elite.decokuwait.com");
    expect(forwarded(res, "x-dk-host")).toBe("elite.decokuwait.com");
    expect(forwarded(res, "x-dk-path")).toBe("/?fbclid=1");
    const vid = forwarded(res, "x-dk-vid");
    expect(vid).toMatch(/^\d{6}$/);
    expect(forwarded(res, "x-dk-vid-new")).toBe("1");
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain(`dk_vid=${vid}`);
    expect(setCookie).toContain("dk_vid_new=1");
  });

  it("keeps a visitor cookie pair and replaces an invalid one", () => {
    const secret = "a".repeat(32);
    const kept = proxy(req("https://elite.decokuwait.com/", { cookie: `dk_vid=123456; dk_vsec=${secret}` }));
    expect(forwarded(kept, "x-dk-vid")).toBe("123456");
    expect(forwarded(kept, "x-dk-vsec")).toBe(secret);
    expect(forwarded(kept, "x-dk-vid-new")).toBeNull();
    const replaced = proxy(req("https://elite.decokuwait.com/", { cookie: `dk_vid=012345; dk_vsec=${secret}` }));
    const vid = forwarded(replaced, "x-dk-vid");
    expect(vid).toMatch(/^[1-9]\d{5}$/);
    expect(vid).not.toBe("012345");
    expect(forwarded(replaced, "x-dk-vid-new")).toBe("1");
  });

  // A code on its own is not an identity: it is six digits in a readable cookie, so anyone can present
  // anyone's. The pair has to be complete, or the visitor is re-identified from scratch.
  it("refuses a visitor code that arrives without its secret, and mints the pair together", () => {
    const orphan = proxy(req("https://elite.decokuwait.com/", { cookie: "dk_vid=123456" }));
    expect(forwarded(orphan, "x-dk-vid")).not.toBe("123456");
    expect(forwarded(orphan, "x-dk-vid-new")).toBe("1");
    const badSecret = proxy(req("https://elite.decokuwait.com/", { cookie: "dk_vid=123456; dk_vsec=short" }));
    expect(forwarded(badSecret, "x-dk-vid")).not.toBe("123456");

    const minted = proxy(req("https://elite.decokuwait.com/"));
    const setCookie = res_setCookie(minted);
    const vsec = setCookie.match(/dk_vsec=([0-9a-f]{32})/)?.[1];
    expect(vsec).toMatch(/^[0-9a-f]{32}$/);
    expect(forwarded(minted, "x-dk-vsec")).toBe(vsec);
    // HttpOnly is the whole point: a script on the page may read the code, never the secret.
    expect(cookieAttrs(setCookie, "dk_vsec")).toMatch(/HttpOnly/i);
    expect(cookieAttrs(setCookie, "dk_vsec")).toMatch(/SameSite=lax/i);
    expect(cookieAttrs(setCookie, "dk_vid")).not.toMatch(/HttpOnly/i);
  });

  // A crawler handed a code costs a visitor row with an IP and a user agent, plus the writes to create it.
  it("mints nothing for known crawlers and marks the request as a bot", () => {
    for (const ua of ["Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"]) {
      const res = proxy(req("https://elite.decokuwait.com/", { headers: { "user-agent": ua } }));
      expect(forwarded(res, "x-dk-vid")).toBeNull();
      expect(forwarded(res, "x-dk-bot")).toBe("1");
      expect(res_setCookie(res)).not.toContain("dk_vid=");
    }
    // A real browser is untouched, and so is the headless Chromium the e2e suite drives.
    for (const ua of ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36"]) {
      const res = proxy(req("https://elite.decokuwait.com/", { headers: { "user-agent": ua } }));
      expect(forwarded(res, "x-dk-vid")).toMatch(/^\d{6}$/);
      expect(forwarded(res, "x-dk-bot")).toBeNull();
    }
  });

  // The panels render no third-party script, so they can take a policy that public tenant pages (which
  // inline the ad-pixel bootstraps) cannot. The nonce has to reach the request too, or Next cannot stamp
  // it onto the inline script it streams the RSC payload through.
  it("puts a nonced strict CSP on the admin and super panels only", () => {
    for (const url of ["https://elite.decokuwait.com/admin/login", "https://decokuwait.com/super"]) {
      const res = proxy(req(url));
      const csp = res.headers.get("content-security-policy") || "";
      const nonce = csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
      expect(nonce).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(forwarded(res, "content-security-policy")).toBe(csp);
      expect(forwarded(res, "x-nonce")).toBe(nonce);
    }
    // Public tenant pages keep their inline pixel bootstraps.
    expect(proxy(req("https://elite.decokuwait.com/")).headers.get("content-security-policy")).toBeNull();
    // And a client cannot choose the nonce Next will stamp by sending its own CSP header.
    const spoofed = proxy(req("https://elite.decokuwait.com/", { headers: { "content-security-policy": "script-src 'nonce-attacker'" } }));
    expect(forwarded(spoofed, "content-security-policy")).toBeNull();
  });

  /**
   * The panel does not upload through its own origin: `/api/upload` returns a presigned URL and the
   * browser PUTs the file straight to R2. A bare `connect-src 'self'` refuses that before it leaves the
   * page, and XHR reports the refusal as a plain network error — the owner saw "connection lost" while
   * the network was fine. Nothing caught it because local development stores uploads on disk through a
   * same-origin route, so the whole suite ran on the one configuration where the bug cannot happen.
   */
  it("lets the panel reach the storage bucket it has to upload to", async () => {
    const env = { ...process.env };
    process.env.R2_ACCOUNT_ID = "acct123";
    process.env.R2_PUBLIC_URL = "https://media.example.com/";
    try {
      // The module reads the environment when it builds the header, not at import time.
      const fresh = (await import("@/proxy")).default as Proxy;
      const csp = fresh(req("https://elite.decokuwait.com/admin/content/hero")).headers.get("content-security-policy") || "";
      const connect = csp.match(/connect-src ([^;]*)/)?.[1] ?? "";
      // The presigned PUT goes to the S3 API endpoint, which is a different host from the public bucket.
      expect(connect).toContain("https://acct123.r2.cloudflarestorage.com");
      expect(connect).toContain("https://media.example.com");
      // Still an allowlist, not a blanket `https:`.
      expect(connect).not.toContain("https:;");
      expect(connect.trim().endsWith("https:")).toBe(false);
    } finally {
      process.env = env;
    }
  });

  it("keeps connect-src closed when there is no bucket to reach", () => {
    const env = { ...process.env };
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_PUBLIC_URL;
    try {
      const csp = proxy(req("https://elite.decokuwait.com/admin")).headers.get("content-security-policy") || "";
      expect(csp).toContain("connect-src 'self'");
    } finally {
      process.env = env;
    }
  });

  it("strips spoofed internal headers from the client request", () => {
    const res = proxy(
      req("https://elite.decokuwait.com/", {
        headers: { "x-dk-vid": "999999", "x-dk-vid-new": "1", "x-dk-host": "victim.decokuwait.com", "x-dk-path": "/x", "x-dk-lang": "en" },
      }),
    );
    expect(forwarded(res, "x-dk-vid")).not.toBe("999999");
    expect(forwarded(res, "x-dk-host")).toBe("elite.decokuwait.com");
    expect(forwarded(res, "x-dk-path")).toBe("/");
    expect(forwarded(res, "x-dk-lang")).toBeNull();
  });

  it("never mints visitor ids for the admin panel or the icon route", () => {
    const admin = proxy(req("https://elite.decokuwait.com/admin/login"));
    expect(admin.headers.get("x-middleware-rewrite")).toContain("/tenant/elite.decokuwait.com/admin/login");
    expect(forwarded(admin, "x-dk-vid")).toBeNull();
    expect(res_setCookie(admin)).not.toContain("dk_vid=");
    const icon = proxy(req("https://elite.decokuwait.com/icon"));
    expect(res_setCookie(icon)).not.toContain("dk_vid=");
  });

  it("redirects www custom domains to the apex with the path and query intact", () => {
    const res = proxy(req("https://www.gulfalu.com/privacy?lang=en"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://gulfalu.com/privacy?lang=en");
  });

  it("passes API routes through with the host header only, and forwards ?lang= as x-dk-lang", () => {
    const api = proxy(req("https://gulfalu.com/api/track"));
    expect(api.headers.get("x-middleware-rewrite")).toBeNull();
    expect(forwarded(api, "x-dk-host")).toBe("gulfalu.com");
    const en = proxy(req("https://gulfalu.com/?lang=en"));
    expect(forwarded(en, "x-dk-lang")).toBe("en");
    const bad = proxy(req("https://gulfalu.com/?lang=fr"));
    expect(forwarded(bad, "x-dk-lang")).toBeNull();
  });

  it("sends platform-only paths on tenant hosts into the tenant tree (where they 404 with the site's own page)", () => {
    for (const p of ["/super", "/templates", "/template/101", "/tenant/x"]) {
      const res = proxy(req(`https://gulfalu.com${p}`));
      expect(res.headers.get("x-middleware-rewrite"), p).toContain(`/tenant/gulfalu.com${p}`);
    }
  });
});

function res_setCookie(res: Response) {
  return res.headers.get("set-cookie") || "";
}

/**
 * The attributes of one cookie inside a joined Set-Cookie header. Splitting on "," alone does not work:
 * the Expires attribute contains one ("Wed, 22 Sep 2027 ...").
 */
function cookieAttrs(setCookie: string, name: string) {
  const start = setCookie.indexOf(`${name}=`);
  if (start < 0) return "";
  const rest = setCookie.slice(start);
  const next = rest.slice(1).search(/, [A-Za-z0-9_-]+=/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
