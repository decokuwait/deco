export type HostInfo =
  | { kind: "root"; host: string }
  | { kind: "site"; host: string; candidates: string[]; subdomain: string | null };

function stripPort(h: string) {
  return h.replace(/:\d+$/, "");
}

/** Decide whether a request host is the platform root or a tenant site. Pure function, unit-tested. */
export function parseHost(rawHost: string | null | undefined, rootDomain: string): HostInfo {
  const host = (rawHost || "").trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase();
  if (!host) return { kind: "root", host: root };
  const hostNoPort = stripPort(host);
  const rootNoPort = stripPort(root);

  if (host === root || hostNoPort === rootNoPort) return { kind: "root", host };
  if (hostNoPort === `www.${rootNoPort}`) return { kind: "root", host };
  if (hostNoPort.endsWith(".vercel.app")) return { kind: "root", host };
  if (hostNoPort === "127.0.0.1" || hostNoPort === "0.0.0.0" || hostNoPort === "[::1]") return { kind: "root", host };

  const candidates = new Set<string>();
  candidates.add(hostNoPort);
  if (hostNoPort.startsWith("www.")) candidates.add(hostNoPort.slice(4));

  let subdomain: string | null = null;
  if (hostNoPort.endsWith(`.${rootNoPort}`)) {
    subdomain = hostNoPort.slice(0, -(rootNoPort.length + 1));
    if (subdomain.startsWith("www.")) subdomain = subdomain.slice(4);
  }
  return { kind: "site", host: hostNoPort, candidates: [...candidates], subdomain };
}

/** The one host a tenant site is served on: `www.` is never canonical (the proxy redirects it). */
export function canonicalHost(host: string): string {
  const h = stripPort(host.trim().toLowerCase());
  return h.startsWith("www.") ? h.slice(4) : h;
}

export function subdomainHost(slug: string, rootDomain: string) {
  return `${slug}.${stripPort(rootDomain.toLowerCase())}`;
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

/** Subdomain labels that are routed to the platform or reserved for mail/infrastructure; a site cannot use them. */
export const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "super",
  "app",
  "mail",
  "smtp",
  "imap",
  "pop",
  "pop3",
  "webmail",
  "ftp",
  "sftp",
  "ns",
  "ns1",
  "ns2",
  "ns3",
  "dns",
  "mx",
  "cdn",
  "static",
  "assets",
  "media",
  "files",
  "status",
  "dev",
  "staging",
  "test",
  "demo-platform",
  "localhost",
  "vercel",
  "autoconfig",
  "autodiscover",
  "_dmarc",
  "_domainkey",
]);

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug) || slug.startsWith("_") || slug.startsWith("xn--");
}

export function isValidHostname(h: string) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h.toLowerCase());
}

/**
 * Cleans a hostname typed by an operator: protocol, path, port and a leading `www.` are dropped, so a
 * custom domain is always stored as its apex (the proxy serves `www.` as a redirect to it).
 */
export function normalizeHostname(h: string) {
  const bare = stripPort(h.trim().toLowerCase()).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return bare.startsWith("www.") ? bare.slice(4) : bare;
}

/** True when the hostname is the platform itself or one of its subdomains (those come from site slugs only). */
export function isPlatformHost(hostname: string, rootDomain: string): boolean {
  const h = stripPort(hostname.trim().toLowerCase());
  const root = stripPort(rootDomain.trim().toLowerCase());
  if (!h) return true;
  if (parseHost(h, root).kind === "root") return true;
  return h === root || h.endsWith(`.${root}`);
}

/** Second-level public suffixes common in the Gulf and elsewhere (`x.com.kw` is an apex, not a subdomain). */
const SECOND_LEVEL_SUFFIX = /\.(?:com|net|org|edu|gov|mil|co|ac|sch|ind|me|info|biz|name|pro)\.[a-z]{2}$/;

/** Whether a hostname is a zone apex (needs an A record) rather than a subdomain (CNAME). */
export function isApexDomain(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  const labels = h.split(".").length;
  return SECOND_LEVEL_SUFFIX.test(h) ? labels === 3 : labels === 2;
}

/** Hostname with the public suffix removed, e.g. `shop.gulfalu.com.kw` -> `shop` (the DNS record name). */
export function subdomainLabel(hostname: string): string {
  const h = hostname.trim().toLowerCase();
  const parts = h.split(".");
  const suffixLabels = SECOND_LEVEL_SUFFIX.test(h) ? 3 : 2;
  return parts.slice(0, Math.max(0, parts.length - suffixLabels)).join(".");
}
