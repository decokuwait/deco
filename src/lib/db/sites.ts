import { q, one, iso, isUuid, json, parseJson } from "./client";
import type { Category, SiteContent, SiteData, SiteRecord } from "@/lib/types";
import { deepMerge, normalizeContent } from "@/lib/content/defaults";
import { listProjects } from "./projects";

interface SiteRow {
  id: string;
  slug: string;
  name: string;
  category: Category;
  template_code: string;
  status: "active" | "paused";
  content: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export function mapSite(r: SiteRow): SiteRecord {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    templateCode: r.template_code,
    status: r.status,
    content: normalizeContent(parseJson(r.content, {})),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function getSiteById(id: string): Promise<SiteRecord | null> {
  // A path param that is not a uuid is a 404, not a database error: `select ... where id = 'abc'` raises
  // SQLSTATE 22P02 and surfaced as a 500 on /super/sites/<anything>.
  if (!isUuid(id)) return null;
  const r = await one<SiteRow>(`select * from sites where id = $1`, [id]);
  return r ? mapSite(r) : null;
}

export async function getSiteBySlug(slug: string): Promise<SiteRecord | null> {
  const r = await one<SiteRow>(`select * from sites where slug = $1`, [slug.toLowerCase()]);
  return r ? mapSite(r) : null;
}

/** Resolve a site from request host candidates (custom domains / subdomain rows) or by subdomain slug. */
export async function getSiteByHost(candidates: string[], subdomain: string | null): Promise<SiteRecord | null> {
  if (candidates.length) {
    const r = await one<SiteRow>(
      `select s.* from site_domains d join sites s on s.id = d.site_id where d.hostname = any($1::text[]) limit 1`,
      [candidates],
    );
    if (r) return mapSite(r);
  }
  if (subdomain) return getSiteBySlug(subdomain);
  return null;
}

export interface SiteListItem extends SiteRecord {
  domains: { hostname: string; kind: "subdomain" | "custom"; verified: boolean }[];
  visitorCount: number;
  leadCount: number;
}

export async function listSites(): Promise<SiteListItem[]> {
  // One grouped pass over visitors instead of two correlated counts per site: the super admin's site
  // list used to run 2N subqueries, each a full count over that site's visitors.
  const rows = await q<SiteRow & { visitor_count: unknown; lead_count: unknown; domains: unknown }>(
    `with counts as (
       select site_id, count(*) as visitors, count(*) filter (where stage <> 'new') as leads
       from visitors group by site_id
     )
     select s.*,
       coalesce(c.visitors, 0) as visitor_count,
       coalesce(c.leads, 0) as lead_count,
       coalesce((select json_agg(json_build_object('hostname', d.hostname, 'kind', d.kind, 'verified', d.verified) order by d.kind, d.hostname)
                 from site_domains d where d.site_id = s.id), '[]'::json) as domains
     from sites s left join counts c on c.site_id = s.id
     order by s.created_at desc`,
  );
  return rows.map((r) => ({
    ...mapSite(r),
    domains: parseJson(r.domains, []),
    visitorCount: Number(r.visitor_count || 0),
    leadCount: Number(r.lead_count || 0),
  }));
}

export async function createSite(input: {
  slug: string;
  name: string;
  category: Category;
  templateCode: string;
  content?: Partial<SiteContent> | SiteContent;
  status?: "active" | "paused";
}): Promise<SiteRecord> {
  const r = await one<SiteRow>(
    `insert into sites (slug, name, category, template_code, content, status) values ($1, $2, $3, $4, $5::jsonb, $6) returning *`,
    [input.slug.toLowerCase(), input.name, input.category, input.templateCode, json(input.content ?? {}), input.status ?? "active"],
  );
  return mapSite(r!);
}

export async function updateSite(
  id: string,
  patch: Partial<{ name: string; category: Category; templateCode: string; status: "active" | "paused"; slug: string }>,
): Promise<SiteRecord | null> {
  const r = await one<SiteRow>(
    `update sites set
       name = coalesce($2, name),
       category = coalesce($3, category),
       template_code = coalesce($4, template_code),
       status = coalesce($5, status),
       slug = coalesce($6, slug),
       updated_at = now()
     where id = $1 returning *`,
    [id, patch.name ?? null, patch.category ?? null, patch.templateCode ?? null, patch.status ?? null, patch.slug?.toLowerCase() ?? null],
  );
  return r ? mapSite(r) : null;
}

export async function setSiteContent(id: string, content: SiteContent): Promise<SiteRecord | null> {
  const r = await one<SiteRow>(`update sites set content = $2::jsonb, updated_at = now() where id = $1 returning *`, [id, json(content)]);
  return r ? mapSite(r) : null;
}

/**
 * Deep-merge a partial patch into the stored content (arrays replace). Optimistic concurrency: the write
 * only succeeds if nobody changed the row in between, otherwise the merge is retried on fresh data.
 *
 * The version token is a hash of the content, not `updated_at`: postgres.js truncates every timestamp it
 * sends as a *parameter* to millisecond precision, while Postgres stores microseconds, so a timestamp read
 * from a row can never be compared back to it and the write would never match (every save then failed with
 * "concurrent_update"). A hash is plain text, survives the round trip untouched, and says what the check
 * actually means: write only if the content is still the content that was merged.
 */
export async function patchSiteContent(id: string, patch: unknown): Promise<SiteRecord | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await one<SiteRow & { content_hash: string }>(`select *, md5(content::text) as content_hash from sites where id = $1`, [id]);
    if (!row) return null;
    const current = normalizeContent(parseJson(row.content, {}));
    const merged = deepMerge(current, patch);
    const updated = await one<SiteRow>(
      `update sites set content = $2::jsonb, updated_at = now() where id = $1 and md5(content::text) = $3 returning *`,
      [id, json(merged), row.content_hash],
    );
    if (updated) return mapSite(updated);
  }
  throw new Error("concurrent_update");
}

export async function deleteSite(id: string) {
  await q(`delete from sites where id = $1`, [id]);
}

export async function getSiteData(site: SiteRecord, opts: { publishedOnly?: boolean } = {}): Promise<SiteData> {
  const projects = await listProjects(site.id, { publishedOnly: opts.publishedOnly ?? true });
  return {
    id: site.id,
    slug: site.slug,
    category: site.category,
    templateCode: site.templateCode,
    content: site.content,
    projects,
  };
}
