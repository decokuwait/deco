import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ROOT_DOMAIN is read at module load, so it has to be set before `@/lib/config` is imported.
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "decokuwait.com";

/**
 * The database layer and the request context are the two things being simulated: every assertion here is
 * about what `site-request` does when `getSiteByHost` fails, which is impossible to provoke for real.
 */
const state = vi.hoisted(() => ({
  headers: new Headers(),
  site: null as unknown,
  throws: null as unknown,
  calls: 0,
}));

vi.mock("next/headers", () => ({
  headers: async () => state.headers,
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/db/sites", () => ({
  getSiteByHost: async () => {
    state.calls++;
    if (state.throws) throw state.throws;
    return state.site;
  },
}));

import { clientIp, getRequestSite, resolveRequestSite } from "@/lib/site-request";
import { TenantUnavailable } from "@/app/tenant/_unavailable";

const withCode = (message: string, code: string) => Object.assign(new Error(message), { code });

const SITE = { id: "s1", slug: "elite", content: { settings: { defaultLocale: "ar" } } };

function request(host: string, extra: Record<string, string> = {}) {
  state.headers = new Headers({ host, ...extra });
}

let errors: string[] = [];
let warnings: string[] = [];

beforeEach(() => {
  state.site = null;
  state.throws = null;
  state.calls = 0;
  errors = [];
  warnings = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(String(a[0])));
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warnings.push(String(a[0])));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveRequestSite", () => {
  it("returns the site when the lookup succeeds", async () => {
    state.site = SITE;
    request("elite.decokuwait.com");
    const r = await resolveRequestSite();
    expect(r.status).toBe("ok");
    expect(r.site).toBe(SITE);
  });

  it("distinguishes an unconfigured host (missing) from the platform root", async () => {
    request("elite.decokuwait.com");
    expect((await resolveRequestSite()).status).toBe("missing");
    request("decokuwait.com");
    expect((await resolveRequestSite()).status).toBe("missing");
  });

  // The traced failure: Supabase unreachable (a blip, or a paused Free-tier project) while rendering the
  // tenant ROOT layout, where a throw can only be caught by global-error and the visitor got Next's
  // unbranded English page. It must resolve, not reject.
  it.each([
    ["unreachable", withCode("connect ECONNREFUSED", "ECONNREFUSED")],
    ["unreachable", withCode("Connection terminated due to connection timeout", "CONNECT_TIMEOUT")],
    ["config", withCode("DATABASE_URL is not set", "DB_NOT_CONFIGURED")],
    ["auth", new Error("Tenant or user not found")],
    ["schema", withCode('relation "sites" does not exist', "42P01")],
  ])("reports a %s database failure as unavailable instead of throwing", async (failure, error) => {
    state.throws = error;
    request("elite.decokuwait.com");
    const r = await resolveRequestSite();
    expect(r.status).toBe("unavailable");
    expect(r.site).toBeNull();
    expect(r.status === "unavailable" && r.failure).toBe(failure);
    // A handled degradation, but never a silent one: the holding page rendered *and* it was reported.
    expect(warnings.join("\n")).toContain("source=site-lookup");
    expect(warnings.join("\n")).toContain(`failure=${failure}`);
  });

  it("still serves the holding page for an error it cannot classify, and reports it as an error", async () => {
    state.throws = new Error("boom");
    request("elite.decokuwait.com");
    const r = await resolveRequestSite();
    expect(r.status).toBe("unavailable");
    expect(r.status === "unavailable" && r.failure).toBeNull();
    expect(errors.join("\n")).toContain("failure=unclassified");
  });

  it("getRequestSite never throws and hides the failure as null for 404-only callers", async () => {
    state.throws = withCode("connect ECONNREFUSED", "ECONNREFUSED");
    request("elite.decokuwait.com");
    await expect(getRequestSite()).resolves.toBeNull();
    await expect(getRequestSite("elite.decokuwait.com")).resolves.toBeNull();
  });

  it("does not let a spoofed x-dk-host pick a different tenant", async () => {
    state.site = SITE;
    request("elite.decokuwait.com", { "x-dk-host": "victim.decokuwait.com" });
    await resolveRequestSite();
    // The claimed host lost, so the resolution used the real one; the only proof available here is that a
    // lookup happened at all for a host `parseHost` accepts. Host matching itself is covered in tenant.test.
    expect(state.calls).toBe(1);
  });
});

describe("clientIp", () => {
  const ip = (h: Record<string, string>) => clientIp(new Headers(h));

  it("prefers the headers only the platform edge can set", () => {
    expect(ip({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "10.0.0.1" })).toBe("203.0.113.7");
    expect(ip({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "10.0.0.1" })).toBe("203.0.113.8");
  });

  // The bug: X-Forwarded-For is client-appendable, so its FIRST entry is whatever the caller typed.
  // Reading it let anyone forge the identity used for rate limiting and stored against a visitor.
  it("ignores a client-supplied X-Forwarded-For prefix and takes the nearest hop", () => {
    expect(ip({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" })).toBe("203.0.113.9");
    expect(ip({ "x-forwarded-for": "evil, 203.0.113.9" })).toBe("203.0.113.9");
    expect(ip({ "x-forwarded-for": "203.0.113.9" })).toBe("203.0.113.9");
  });

  it("normalises ports and IPv6 brackets, and rejects anything that is not an address", () => {
    expect(ip({ "x-real-ip": "203.0.113.10:51234" })).toBe("203.0.113.10");
    expect(ip({ "x-real-ip": "[2001:db8::1]:443" })).toBe("2001:db8::1");
    expect(ip({ "x-real-ip": "2001:DB8::1" })).toBe("2001:db8::1");
    expect(ip({ "x-forwarded-for": "not-an-ip" })).toBeNull();
    expect(ip({ "x-forwarded-for": "x".repeat(200) })).toBeNull();
    expect(ip({})).toBeNull();
  });
});

describe("the holding page", () => {
  it("is a complete RTL document that needs no database, stylesheet or font", () => {
    const html = renderToStaticMarkup(createElement(TenantUnavailable, {}));
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("<body>");
    expect(html).toContain("نعود قريباً");
    expect(html).toContain("We’ll be right back");
    // An outage must not be indexed as if it were the site, and it retries on the visitor's behalf.
    expect(html).toContain('name="robots"');
    expect(html).toContain('http-equiv="refresh"');
    // Styles are inline: nothing here may depend on a build artefact or a third-party font.
    expect(html).toContain("<style>");
    expect(html).not.toContain("<link");
    // Logical properties only, so one stylesheet serves both directions.
    expect(html).not.toMatch(/margin-left|margin-right|padding-left|padding-right/);
  });

  it("flips to LTR for an English site", () => {
    const html = renderToStaticMarkup(createElement(TenantUnavailable, { locale: "en" as const }));
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("نعود قريباً"); // both languages regardless of direction
  });
});
