/**
 * Vercel Domains API. Used by the super admin to attach custom domains and subdomains to the
 * deployed project. Subdomains of the root domain resolve automatically when the root domain's
 * DNS is on Vercel (or a wildcard `*.root` record points to Vercel); custom domains need the
 * DNS records returned here to be configured manually by the owner.
 */
export interface VercelDomainResult {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason?: string }[];
  recommended?: { type: "A" | "CNAME"; name: string; value: string }[];
  error?: string;
  raw?: unknown;
}

export function vercelConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function teamQuery(prefix = "?") {
  const t = process.env.VERCEL_TEAM_ID;
  return t ? `${prefix}teamId=${encodeURIComponent(t)}` : "";
}

async function api(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export function recommendedRecords(hostname: string): { type: "A" | "CNAME"; name: string; value: string }[] {
  const parts = hostname.split(".");
  const isApex = parts.length === 2;
  if (isApex) return [{ type: "A", name: "@", value: "76.76.21.21" }];
  return [{ type: "CNAME", name: parts.slice(0, -2).join("."), value: "cname.vercel-dns.com" }];
}

export async function addDomainToVercel(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) {
    return { ok: false, configured: false, verified: false, error: "vercel_not_configured", recommended: recommendedRecords(hostname) };
  }
  const project = process.env.VERCEL_PROJECT_ID!;
  const add = await api(`/v10/projects/${encodeURIComponent(project)}/domains${teamQuery()}`, {
    method: "POST",
    body: JSON.stringify({ name: hostname }),
  });
  const b = add.body as { error?: { code?: string; message?: string }; verified?: boolean; verification?: VercelDomainResult["verification"] } | null;
  if (add.status >= 400 && b?.error?.code !== "domain_already_exists") {
    return { ok: false, configured: false, verified: false, error: b?.error?.message || `vercel_${add.status}`, raw: add.body, recommended: recommendedRecords(hostname) };
  }
  const status = await getDomainStatus(hostname);
  return { ...status, verification: b?.verification, raw: add.body, recommended: recommendedRecords(hostname) };
}

export async function getDomainStatus(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) return { ok: false, configured: false, verified: false, error: "vercel_not_configured" };
  const project = process.env.VERCEL_PROJECT_ID!;
  const [cfg, dom] = await Promise.all([
    api(`/v6/domains/${encodeURIComponent(hostname)}/config${teamQuery()}`),
    api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}${teamQuery()}`),
  ]);
  const c = cfg.body as { misconfigured?: boolean } | null;
  const d = dom.body as { verified?: boolean; verification?: VercelDomainResult["verification"] } | null;
  const configured = cfg.status < 400 && c?.misconfigured === false;
  return {
    ok: dom.status < 400,
    configured,
    verified: !!d?.verified,
    verification: d?.verification,
    raw: { config: cfg.body, domain: dom.body },
    recommended: recommendedRecords(hostname),
  };
}

export async function verifyDomain(hostname: string): Promise<VercelDomainResult> {
  if (!vercelConfigured()) return { ok: false, configured: false, verified: false, error: "vercel_not_configured" };
  const project = process.env.VERCEL_PROJECT_ID!;
  await api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}/verify${teamQuery()}`, { method: "POST" });
  return getDomainStatus(hostname);
}

export async function removeDomainFromVercel(hostname: string): Promise<boolean> {
  if (!vercelConfigured()) return false;
  const project = process.env.VERCEL_PROJECT_ID!;
  const r = await api(`/v9/projects/${encodeURIComponent(project)}/domains/${encodeURIComponent(hostname)}${teamQuery()}`, { method: "DELETE" });
  return r.status < 400;
}
