import { q, one, iso, json, parseJson } from "./client";

export interface SiteDomain {
  id: string;
  siteId: string;
  hostname: string;
  kind: "subdomain" | "custom";
  isPrimary: boolean;
  vercelStatus: Record<string, unknown> | null;
  verified: boolean;
  createdAt: string;
}

interface Row {
  id: string;
  site_id: string;
  hostname: string;
  kind: "subdomain" | "custom";
  is_primary: boolean;
  vercel_status: unknown;
  verified: boolean;
  created_at: unknown;
}

function map(r: Row): SiteDomain {
  return {
    id: r.id,
    siteId: r.site_id,
    hostname: r.hostname,
    kind: r.kind,
    isPrimary: !!r.is_primary,
    vercelStatus: parseJson<Record<string, unknown> | null>(r.vercel_status, null),
    verified: !!r.verified,
    createdAt: iso(r.created_at),
  };
}

export async function listDomains(siteId: string): Promise<SiteDomain[]> {
  const rows = await q<Row>(`select * from site_domains where site_id = $1 order by kind, created_at`, [siteId]);
  return rows.map(map);
}

export async function findDomain(hostname: string): Promise<SiteDomain | null> {
  const r = await one<Row>(`select * from site_domains where hostname = $1`, [hostname.toLowerCase()]);
  return r ? map(r) : null;
}

export async function getDomain(id: string): Promise<SiteDomain | null> {
  const r = await one<Row>(`select * from site_domains where id = $1`, [id]);
  return r ? map(r) : null;
}

export async function addDomain(input: {
  siteId: string;
  hostname: string;
  kind: "subdomain" | "custom";
  isPrimary?: boolean;
  vercelStatus?: unknown;
  verified?: boolean;
}): Promise<SiteDomain> {
  // A hostname that already belongs to another site is never re-assigned silently.
  const r = await one<Row>(
    `insert into site_domains (site_id, hostname, kind, is_primary, vercel_status, verified)
     values ($1, $2, $3, $4, $5::jsonb, $6)
     on conflict (hostname) do update set kind = excluded.kind, is_primary = excluded.is_primary, vercel_status = excluded.vercel_status, verified = excluded.verified
       where site_domains.site_id = excluded.site_id
     returning *`,
    [input.siteId, input.hostname.toLowerCase(), input.kind, input.isPrimary ?? false, json(input.vercelStatus ?? null), input.verified ?? false],
  );
  if (!r) throw new Error("domain_taken");
  return map(r);
}

export async function updateDomainStatus(id: string, patch: { vercelStatus?: unknown; verified?: boolean }) {
  await q(`update site_domains set vercel_status = coalesce($2::jsonb, vercel_status), verified = coalesce($3, verified) where id = $1`, [
    id,
    patch.vercelStatus === undefined ? null : json(patch.vercelStatus),
    patch.verified ?? null,
  ]);
}

export async function removeDomain(id: string) {
  await q(`delete from site_domains where id = $1`, [id]);
}

export async function removeSubdomainRows(siteId: string) {
  await q(`delete from site_domains where site_id = $1 and kind = 'subdomain'`, [siteId]);
}
