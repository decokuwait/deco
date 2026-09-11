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

  it("keeps a valid visitor cookie and replaces an invalid one", () => {
    const kept = proxy(req("https://elite.decokuwait.com/", { cookie: "dk_vid=123456" }));
    expect(forwarded(kept, "x-dk-vid")).toBe("123456");
    expect(forwarded(kept, "x-dk-vid-new")).toBeNull();
    const replaced = proxy(req("https://elite.decokuwait.com/", { cookie: "dk_vid=012345" }));
    const vid = forwarded(replaced, "x-dk-vid");
    expect(vid).toMatch(/^[1-9]\d{5}$/);
    expect(vid).not.toBe("012345");
    expect(forwarded(replaced, "x-dk-vid-new")).toBe("1");
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
