import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDomainToVercel, getDomainStatus, recommendedRecords, removeDomainFromVercel } from "@/lib/vercel";

describe("recommended DNS records", () => {
  it("apex domains get an A record plus the www CNAME; subdomains a single CNAME", () => {
    expect(recommendedRecords("gulfalu.com")).toEqual([
      { type: "A", name: "@", value: "76.76.21.21" },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
    ]);
    expect(recommendedRecords("gulfalu.com.kw")[0]).toEqual({ type: "A", name: "@", value: "76.76.21.21" });
    expect(recommendedRecords("shop.gulfalu.com.kw")).toEqual([{ type: "CNAME", name: "shop", value: "cname.vercel-dns.com" }]);
    expect(recommendedRecords("www.example.com")).toEqual([{ type: "CNAME", name: "www", value: "cname.vercel-dns.com" }]);
  });
  it("prefers the project-specific values Vercel returns", () => {
    expect(recommendedRecords("gulfalu.com", { ipv4: "76.76.21.98", cname: "abc123.vercel-dns-017.com" })).toEqual([
      { type: "A", name: "@", value: "76.76.21.98" },
      { type: "CNAME", name: "www", value: "abc123.vercel-dns-017.com" },
    ]);
  });
});

describe("Vercel domains API client", () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  beforeEach(() => {
    calls.length = 0;
    process.env.VERCEL_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_1";
    delete process.env.VERCEL_TEAM_ID;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
  });

  function stub(handler: (url: string, init: RequestInit) => { status: number; body: unknown } | Error) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
        const u = String(url);
        calls.push({ url: u, method: init.method || "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
        const r = handler(u, init);
        if (r instanceof Error) throw r;
        return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
      }),
    );
  }

  it("registers an apex domain, its www redirect twin, and reads the config-derived records", async () => {
    stub((url, init) => {
      if (init.method === "POST") return { status: 200, body: { name: "x", verified: false, verification: [{ type: "TXT", domain: "_vercel.gulfalu.com", value: "vc-domain-verify=abc" }] } };
      if (url.includes("/config")) return { status: 200, body: { misconfigured: true, recommendedIPv4: [{ rank: 1, value: ["76.76.21.98"] }], recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns-017.com" }] } };
      return { status: 200, body: { verified: false, verification: [{ type: "TXT", domain: "_vercel.gulfalu.com", value: "vc-domain-verify=abc" }] } };
    });
    const r = await addDomainToVercel("gulfalu.com");
    const posts = calls.filter((c) => c.method === "POST").map((c) => c.body as { name: string; redirect?: string; redirectStatusCode?: number });
    expect(posts.map((p) => p.name)).toEqual(["gulfalu.com", "www.gulfalu.com"]);
    expect(posts[1]).toMatchObject({ redirect: "gulfalu.com", redirectStatusCode: 308 });
    expect(r.ok).toBe(true);
    expect(r.configured).toBe(false);
    expect(r.verified).toBe(false);
    expect(r.verification?.[0].type).toBe("TXT");
    expect(r.recommended).toEqual([
      { type: "A", name: "@", value: "76.76.21.98" },
      { type: "CNAME", name: "www", value: "abc.vercel-dns-017.com" },
    ]);
  });

  it("treats domain_already_exists as success and other 4xx as a failure with the generic records", async () => {
    stub((url, init) => {
      if (init.method === "POST") return { status: 409, body: { error: { code: "domain_already_exists", message: "exists" } } };
      if (url.includes("/config")) return { status: 200, body: { misconfigured: false } };
      return { status: 200, body: { verified: true } };
    });
    const ok = await addDomainToVercel("shop.gulfalu.com");
    expect(ok.ok).toBe(true);
    expect(ok.configured).toBe(true);
    expect(ok.verified).toBe(true);
    stub(() => ({ status: 403, body: { error: { code: "forbidden", message: "Not authorized" } } }));
    const bad = await addDomainToVercel("shop.gulfalu.com");
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe("Not authorized");
    expect(bad.recommended).toEqual([{ type: "CNAME", name: "shop", value: "cname.vercel-dns.com" }]);
  });

  it("never throws when the API is unreachable", async () => {
    stub(() => new Error("getaddrinfo ENOTFOUND api.vercel.com"));
    const add = await addDomainToVercel("gulfalu.com");
    expect(add.ok).toBe(false);
    expect(add.error).toMatch(/^vercel_unreachable/);
    const status = await getDomainStatus("gulfalu.com");
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/^vercel_unreachable/);
    expect(await removeDomainFromVercel("gulfalu.com")).toBe(false);
  });

  it("removes the www twin together with an apex domain", async () => {
    stub(() => ({ status: 200, body: {} }));
    expect(await removeDomainFromVercel("gulfalu.com")).toBe(true);
    expect(calls.filter((c) => c.method === "DELETE").map((c) => decodeURIComponent(c.url.split("/domains/")[1]))).toEqual(["gulfalu.com", "www.gulfalu.com"]);
  });

  it("reports when Vercel is not configured", async () => {
    delete process.env.VERCEL_TOKEN;
    const r = await addDomainToVercel("gulfalu.com");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("vercel_not_configured");
    expect(r.recommended?.length).toBe(2);
  });
});
