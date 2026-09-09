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

export function subdomainHost(slug: string, rootDomain: string) {
  return `${slug}.${stripPort(rootDomain.toLowerCase())}`;
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

export function isValidHostname(h: string) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h.toLowerCase());
}

export function normalizeHostname(h: string) {
  return stripPort(h.trim().toLowerCase()).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}
