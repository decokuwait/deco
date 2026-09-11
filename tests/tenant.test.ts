import { describe, expect, it } from "vitest";
import {parseHost, subdomainHost, isValidSlug, isValidHostname, normalizeHostname, canonicalHost, isApexDomain, subdomainLabel, isReservedSlug, isPlatformHost } from "@/lib/tenant";

describe("parseHost", () => {
  const root = "decokuwait.com";
  it("treats the root domain and www as platform root", () => {
    expect(parseHost("decokuwait.com", root).kind).toBe("root");
    expect(parseHost("www.decokuwait.com", root).kind).toBe("root");
    expect(parseHost("DECOKUWAIT.COM", root).kind).toBe("root");
  });
  it("treats vercel preview hosts and localhost as root", () => {
    expect(parseHost("my-app-abc123.vercel.app", root).kind).toBe("root");
    expect(parseHost("localhost:3000", "localhost:3000").kind).toBe("root");
    expect(parseHost("127.0.0.1:3000", "localhost:3000").kind).toBe("root");
  });
  it("detects subdomains of the root", () => {
    const r = parseHost("elite.decokuwait.com", root);
    expect(r.kind).toBe("site");
    if (r.kind === "site") {
      expect(r.subdomain).toBe("elite");
      expect(r.candidates).toContain("elite.decokuwait.com");
    }
  });
  it("detects subdomains locally with ports", () => {
    const r = parseHost("demo.localhost:3000", "localhost:3000");
    expect(r.kind).toBe("site");
    if (r.kind === "site") {
      expect(r.subdomain).toBe("demo");
      expect(r.host).toBe("demo.localhost");
    }
  });
  it("detects custom domains and strips www", () => {
    const r = parseHost("www.gulfalu.com", root);
    expect(r.kind).toBe("site");
    if (r.kind === "site") {
      expect(r.subdomain).toBeNull();
      expect(r.candidates).toEqual(expect.arrayContaining(["www.gulfalu.com", "gulfalu.com"]));
    }
  });
  it("handles empty host", () => {
    expect(parseHost(null, root).kind).toBe("root");
  });
});

describe("helpers", () => {
  it("builds subdomain hosts without the port", () => {
    expect(subdomainHost("abc", "localhost:3000")).toBe("abc.localhost");
    expect(subdomainHost("abc", "decokuwait.com")).toBe("abc.decokuwait.com");
  });
  it("validates slugs", () => {
    expect(isValidSlug("elite-decor")).toBe(true);
    expect(isValidSlug("Elite")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
    expect(isValidSlug("a")).toBe(true);
  });
  it("validates hostnames", () => {
    expect(isValidHostname("gulfalu.com")).toBe(true);
    expect(isValidHostname("shop.gulfalu.com.kw")).toBe(true);
    expect(isValidHostname("not a host")).toBe(false);
    expect(isValidHostname("localhost")).toBe(false);
  });
  it("normalizes hostnames", () => {
    // A leading www. is dropped: custom domains are stored as their apex and www redirects to it.
    expect(normalizeHostname(" HTTPS://Www.Example.com/path ")).toBe("example.com");
    expect(normalizeHostname("example.com:443")).toBe("example.com");
    expect(canonicalHost("www.gulfalu.com:443")).toBe("gulfalu.com");
    expect(canonicalHost("shop.gulfalu.com")).toBe("shop.gulfalu.com");
  });
  it("knows apex domains, including Gulf second-level suffixes", () => {
    expect(isApexDomain("gulfalu.com")).toBe(true);
    expect(isApexDomain("gulfalu.com.kw")).toBe(true);
    expect(isApexDomain("shop.gulfalu.com.kw")).toBe(false);
    expect(isApexDomain("www.example.com")).toBe(false);
    expect(subdomainLabel("shop.gulfalu.com.kw")).toBe("shop");
    expect(subdomainLabel("www.example.com")).toBe("www");
  });
  it("rejects reserved slugs and platform hostnames", () => {
    expect(isReservedSlug("www")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("_dmarc")).toBe(true);
    expect(isReservedSlug("elite-decor")).toBe(false);
    expect(isPlatformHost("decokuwait.com", "decokuwait.com")).toBe(true);
    expect(isPlatformHost("www.decokuwait.com", "decokuwait.com")).toBe(true);
    expect(isPlatformHost("sales.decokuwait.com", "decokuwait.com")).toBe(true);
    expect(isPlatformHost("myapp.vercel.app", "decokuwait.com")).toBe(true);
    expect(isPlatformHost("gulfalu.com", "decokuwait.com")).toBe(false);
  });
});
