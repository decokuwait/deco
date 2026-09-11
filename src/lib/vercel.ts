/**
 * Vercel Domains API. Used by the super admin to attach custom domains and subdomains to the
 * deployed project. Subdomains of the root domain resolve automatically when the root domain's
 * DNS is on Vercel (or a wildcard `*.root` record points to Vercel); custom domains need the
 * DNS records returned here to be configured manually by the owner.
 */
import { isApexDomain, subdomainLabel } from "@/lib/tenant";

export interface DnsRecord {
  type: "A" | "CNAME";
  name: string;
  value: string;
}

export interface VercelDomainResult {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason?: string }[];
  recommended?: DnsRecord[];
  error?: string;
  raw?: unknown;
}

const DEFAULT_A = "76.76.21.21";
const DEFAULT_CNAME = "cname.vercel-dns.com";
const TIMEOUT_MS = 10_000;

export function vercelConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function teamQuery(prefix = "?") {
  const t = process.env.VERCEL_TEAM_ID;
  return t ? `${prefix}teamId=${encodeURIComponent(t)}` : "";
}

/** One API call. Network failures and timeouts never throw: they come back as status 0 with an error body. */
async function api(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(`https://api.vercel.com${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: { error: { code: "vercel_unreachable", message: err instanceof Error ? err.message : String(err) } } };
  }
}

/**
 * DNS records the owner must create. Apex domains (`company.com`, `company.com.kw`) need an A record
 * plus a `www` CNAME so both hosts reach the site; subdomains need a single CNAME. When Vercel's config
 * endpoint returned project-specific values they replace the generic defaults.
 */
export function recommendedRecords(hostname: string, hints?: { ipv4?: string; cname?: string }): DnsRecord[] {
  const a = hints?.ipv4 || DEFAULT_A;
  const cname = hints?.cname || DEFAULT_CNAME;
  if (isApexDomain(hostname)) {
    return [
      { type: "A", name: "@", value: a },
      { type: "CNAME", name: "www", value: cname },
    ];
  }
  return [{ type: "CNAME", name: subdomainLabel(hostname) || hostname, value: cname }];
}

interface ConfigBody {
  misconfigured?: boolean;
  recommendedIPv4?: { rank?: number; value?: string[] | string }[];
  recommendedCNAME?: { rank?: number; value?: string }[];
}

function hintsFrom(cfg: ConfigBody | null): { ipv4?: string; cname?: string } {
  const ipv4 = cfg?.recommendedIPv4?.[0]?.value;
  const cname = cfg?.recommendedCNAME?.[0]?.value;
  return {
    ipv4: Array.isArray(ipv4) ? ipv4[0] : typeof ipv4 === "string" ? ipv4 : undefined,
    cname: typeof cname === "string" ? cname : undefined,
  };
}

function unreachable(hostname: string, body: unknown): VercelDomainResult {
  const b = body as { error?: { message?: string } } | null;
  return { ok: false, configured: false, verified: false, error: `vercel_unreachable: ${b?.error?.message || "network"}`, recommended: recommendedRecords(hostname) };
}

/**
 * Registers a hostname with the Vercel project. For an apex domain the `www.` twin is registered as a
 * 308 redirect to the apex, so both spellings reach the site (and the proxy keeps one visitor id per person).
 */
export async function addDomainToVercel(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) {
    return { ok: false, configured: false, verified: false, error: "vercel_not_configured", recommended: recommendedRecords(hostname) };
  }
  const project = process.env.VERCEL_PROJECT_ID!;
  const add = await api(`/v10/projects/${encodeURIComponent(project)}/domains${teamQuery()}`, {
    method: "POST",
    body: JSON.stringify({ name: hostname }),
  });
  if (add.status === 0) return unreachable(hostname, add.body);
  const b = add.body as { error?: { code?: string; message?: string }; verified?: boolean; verification?: VercelDomainResult["verification"] } | null;
  if (add.status >= 400 && b?.error?.code !== "domain_already_exists") {
    return { ok: false, configured: false, verified: false, error: b?.error?.message || `vercel_${add.status}`, raw: add.body, recommended: recommendedRecords(hostname) };
  }
  if (isApexDomain(hostname)) {
    // Best effort: the www twin is a convenience redirect and must never block the apex registration.
    await api(`/v10/projects/${encodeURIComponent(project)}/domains${teamQuery()}`, {
      method: "POST",
      body: JSON.stringify({ name: `www.${hostname}`, redirect: hostname, redirectStatusCode: 308 }),
    });
  }
  const status = await getDomainStatus(hostname);
  return { ...status, verification: status.verification ?? b?.verification, raw: add.body };
}

export async function getDomainStatus(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) return { ok: false, configured: false, verified: false, error: "vercel_not_configured", recommended: recommendedRecords(hostname) };
  const project = process.env.VERCEL_PROJECT_ID!;
  const [cfg, dom] = await Promise.all([
    api(`/v6/domains/${encodeURIComponent(hostname)}/config${teamQuery()}`),
    api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}${teamQuery()}`),
  ]);
  if (dom.status === 0) return unreachable(hostname, dom.body);
  const c = cfg.body as ConfigBody | null;
  const d = dom.body as { verified?: boolean; verification?: VercelDomainResult["verification"] } | null;
  const configured = cfg.status < 400 && c?.misconfigured === false;
  return {
    ok: dom.status < 400,
    configured,
    verified: !!d?.verified,
    verification: d?.verification,
    raw: { config: cfg.body, domain: dom.body },
    recommended: recommendedRecords(hostname, cfg.status < 400 ? hintsFrom(c) : undefined),
  };
}

export async function verifyDomain(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) return { ok: false, configured: false, verified: false, error: "vercel_not_configured", recommended: recommendedRecords(hostname) };
  const project = process.env.VERCEL_PROJECT_ID!;
  const r = await api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}/verify${teamQuery()}`, { method: "POST" });
  if (r.status === 0) return unreachable(hostname, r.body);
  return getDomainStatus(hostname);
}

export async function removeDomainFromVercel(hostname: string): Promise<boolean> {
  if (!vercelConfigured()) return false;
  const project = process.env.VERCEL_PROJECT_ID!;
  const r = await api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}${teamQuery()}`, { method: "DELETE" });
  if (isApexDomain(hostname)) {
    await api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(`www.${hostname}`)}${teamQuery()}`, { method: "DELETE" });
  }
  return r.status > 0 && r.status < 400;
}
