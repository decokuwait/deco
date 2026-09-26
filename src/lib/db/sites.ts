import { q, one, iso, isoOrNull, isUuid, json, parseJson, getDb } from "./client";
import type { BillingCycle, Category, Plan, SiteBilling, SiteContent, SiteData, SiteRecord } from "@/lib/types";
import { deepMerge, normalizeContent } from "@/lib/content/defaults";
import { listProjects } from "./projects";

interface SiteSummaryRow {
  id: string;
  slug: string;
  name: string;
  category: Category;
  template_code: string;
  status: "active" | "paused";
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
  plan: Plan;
  price_fils: unknown;
  billing_cycle: BillingCycle;
  paid_until: string | null;
  last_invoice_ref: string | null;
}

interface SiteRow extends SiteSummaryRow {
  content: unknown;
}

/** A site without its content blob. Every listing uses this: `content` is ~10KB a row and no list renders it. */
export type SiteSummary = Omit<SiteRecord, "content">;

const SITE_FIELDS = [
  "id",
  "slug",
  "name",
  "category",
  "template_code",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
  "plan",
  "price_fils",
  "billing_cycle",
  "last_invoice_ref",
];

/**
 * Explicit column list, never `select *`.
 *
 * `content` is opt-in because it is by far the biggest column in the schema, and the site list, the billing
 * cron and the pause job all read a site without ever looking at it. `paid_until` is cast to text on the way
 * out: the drivers turn a `date` into a JS Date at midnight in whichever zone they picked, which shifts the
 * day either side of it; the column means a calendar day, so it travels as one.
 */
function siteCols(alias = "s", opts: { content?: boolean } = {}) {
  const cols = SITE_FIELDS.map((c) => `${alias}.${c}`);
  cols.push(`${alias}.paid_until::text as paid_until`);
  if (opts.content) cols.push(`${alias}.content`);
  return cols.join(", ");
}

function mapSummary(r: SiteSummaryRow): SiteSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    templateCode: r.template_code,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    deletedAt: isoOrNull(r.deleted_at),
    plan: r.plan,
    priceFils: Number(r.price_fils ?? 0),
    billingCycle: r.billing_cycle,
    paidUntil: r.paid_until ? String(r.paid_until).slice(0, 10) : null,
    lastInvoiceRef: r.last_invoice_ref,
  };
}

export function mapSite(r: SiteRow): SiteRecord {
  return { ...mapSummary(r), content: normalizeContent(parseJson(r.content, {})) };
}

/** A soft-deleted site is gone as far as every lookup is concerned; only the purge job asks for them. */
export interface SiteLookupOptions {
  includeDeleted?: boolean;
}

function liveOnly(opts: SiteLookupOptions | undefined, alias = "s") {
  return opts?.includeDeleted ? "" : ` and ${alias}.deleted_at is null`;
}

export async function getSiteById(id: string, opts: SiteLookupOptions = {}): Promise<SiteRecord | null> {
  // A path param that is not a uuid is a 404, not a database error: `select ... where id = 'abc'` raises
  // SQLSTATE 22P02 and surfaced as a 500 on /super/sites/<anything>.
  if (!isUuid(id)) return null;
  const r = await one<SiteRow>(`select ${siteCols("s", { content: true })} from sites s where s.id = $1${liveOnly(opts)}`, [id]);
  return r ? mapSite(r) : null;
}

export async function getSiteBySlug(slug: string, opts: SiteLookupOptions = {}): Promise<SiteRecord | null> {
  const r = await one<SiteRow>(`select ${siteCols("s", { content: true })} from sites s where s.slug = $1${liveOnly(opts)}`, [slug.toLowerCase()]);
  return r ? mapSite(r) : null;
}

/** Resolve a site from request host candidates (custom domains / subdomain rows) or by subdomain slug. */
export async function getSiteByHost(candidates: string[], subdomain: string | null): Promise<SiteRecord | null> {
  if (candidates.length) {
    const r = await one<SiteRow>(
      `select ${siteCols("s", { content: true })} from site_domains d join sites s on s.id = d.site_id
       where d.hostname = any($1::text[]) and s.deleted_at is null limit 1`,
      [candidates],
    );
    if (r) return mapSite(r);
  }
  if (subdomain) return getSiteBySlug(subdomain);
  return null;
}

export type SiteListItem = SiteSummary & {
  domains: { hostname: string; kind: "subdomain" | "custom"; verified: boolean }[];
  visitorCount: number;
  leadCount: number;
};

export interface SiteListOptions extends SiteLookupOptions {
  limit?: number;
  offset?: number;
}

/** Clamps a page size/offset that came from a query string to a safe integer (NaN and 1e20 included). */
function clampInt(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export const SITES_PAGE_SIZE = 50;

/**
 * One page of sites, newest first, with their domains and visitor counts.
 *
 * Three things made this the slowest page on the platform:
 *  - `select s.*` shipped every site's content blob to a page that renders a name and a badge;
 *  - the counts CTE grouped over the WHOLE visitors table — every tenant's rows, on every render;
 *  - there was no LIMIT at all.
 * The page of ids is now chosen first and the counts CTE is restricted to it, so the counts cost at most
 * `limit` index probes on visitors(site_id, ...) instead of a seq scan plus hash aggregate over the platform.
 * Denormalised counters on `sites` would be cheaper still, but they need a trigger or an app-side increment
 * on the tracking path — which must never fail for a bookkeeping reason — and a counter that has drifted is
 * a support ticket nobody can explain. The restricted probe is exact and costs microseconds at this page size.
 *
 * The pager total comes from `countSites()`, kept separate so asking for a page never pays for a count the
 * caller is not going to display.
 */
export async function listSites(opts: SiteListOptions = {}): Promise<SiteListItem[]> {
  const limit = clampInt(opts.limit, SITES_PAGE_SIZE, 1, 200);
  const offset = clampInt(opts.offset, 0, 0, 1_000_000);
  const rows = await q<SiteSummaryRow & { visitor_count: unknown; lead_count: unknown; domains: unknown }>(
    `with page as (
       select ${siteCols("s")} from sites s where true${liveOnly(opts)}
       order by s.created_at desc limit $1 offset $2
     ), counts as (
       select v.site_id, count(*) as visitors, count(*) filter (where v.stage <> 'new') as leads
       from visitors v where v.site_id in (select id from page) group by v.site_id
     )
     select p.*,
       coalesce(c.visitors, 0) as visitor_count,
       coalesce(c.leads, 0) as lead_count,
       coalesce((select json_agg(json_build_object('hostname', d.hostname, 'kind', d.kind, 'verified', d.verified) order by d.kind, d.hostname)
                 from site_domains d where d.site_id = p.id), '[]'::json) as domains
     from page p left join counts c on c.site_id = p.id
     order by p.created_at desc`,
    [limit, offset],
  );
  return rows.map((r) => ({
    ...mapSummary(r),
    domains: parseJson(r.domains, []),
    visitorCount: Number(r.visitor_count || 0),
    leadCount: Number(r.lead_count || 0),
  }));
}

/** Total for the site pager. Served by the `sites_active_idx` partial index. */
export async function countSites(opts: SiteLookupOptions = {}): Promise<number> {
  const r = await one<{ n: unknown }>(`select count(*) as n from sites s where true${liveOnly(opts)}`);
  return Number(r?.n ?? 0);
}

export async function createSite(input: {
  slug: string;
  name: string;
  category: Category;
  templateCode: string;
  content?: Partial<SiteContent> | SiteContent;
  status?: "active" | "paused";
  plan?: Plan;
  priceFils?: number;
  billingCycle?: BillingCycle;
  paidUntil?: string | null;
}): Promise<SiteRecord> {
  const r = await one<SiteRow>(
    `insert into sites (slug, name, category, template_code, content, status, plan, price_fils, billing_cycle, paid_until)
     values ($1, $2, $3, $4, $5::jsonb, $6, coalesce($7, 'basic'), coalesce($8, 0), coalesce($9, 'yearly'), $10::date)
     returning ${siteCols("sites", { content: true })}`,
    [
      input.slug.toLowerCase(),
      input.name,
      input.category,
      input.templateCode,
      json(input.content ?? {}),
      input.status ?? "active",
      input.plan ?? null,
      input.priceFils ?? null,
      input.billingCycle ?? null,
      input.paidUntil || null,
    ],
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
     where id = $1 and deleted_at is null returning ${siteCols("sites", { content: true })}`,
    [id, patch.name ?? null, patch.category ?? null, patch.templateCode ?? null, patch.status ?? null, patch.slug?.toLowerCase() ?? null],
  );
  return r ? mapSite(r) : null;
}

/**
 * Billing patch. Absent fields keep their value; `paidUntil` and `lastInvoiceRef` are nullable, so they use
 * the same "keep" boolean convention as updateVisitor rather than a sentinel value that an operator could
 * plausibly type in. `priceFils` is an integer count of fils (1 KWD = 1000): money is never a float here.
 */
export async function updateSiteBilling(id: string, patch: Partial<SiteBilling>): Promise<SiteRecord | null> {
  if (patch.priceFils !== undefined && (!Number.isInteger(patch.priceFils) || patch.priceFils < 0)) throw new Error("invalid_price_fils");
  if (patch.paidUntil != null && !/^\d{4}-\d{2}-\d{2}$/.test(patch.paidUntil)) throw new Error("invalid_paid_until");
  const r = await one<SiteRow>(
    `update sites set
       plan = coalesce($2, plan),
       price_fils = coalesce($3, price_fils),
       billing_cycle = coalesce($4, billing_cycle),
       paid_until = case when $5::boolean then paid_until else $6::date end,
       last_invoice_ref = case when $7::boolean then last_invoice_ref else $8 end,
       updated_at = now()
     where id = $1 and deleted_at is null returning ${siteCols("sites", { content: true })}`,
    [
      id,
      patch.plan ?? null,
      patch.priceFils ?? null,
      patch.billingCycle ?? null,
      patch.paidUntil === undefined, patch.paidUntil || null,
      patch.lastInvoiceRef === undefined, patch.lastInvoiceRef ?? null,
    ],
  );
  return r ? mapSite(r) : null;
}

/**
 * Active sites whose subscription ran out — what the pause cron acts on. `paid_until` is compared against
 * `current_date` inside the statement so the cutoff is the database's calendar day, not the runtime's: a
 * Vercel cron runs in UTC and would otherwise pause a Kuwait site three hours before its last day ends.
 * A site that was never sold (paid_until is null) is not due: it has no subscription to lapse.
 */
export async function listSitesDueForPause(): Promise<SiteSummary[]> {
  const rows = await q<SiteSummaryRow>(
    `select ${siteCols("s")} from sites s
     where s.deleted_at is null and s.status = 'active' and s.paid_until is not null and s.paid_until < current_date
     order by s.paid_until`,
  );
  return rows.map(mapSummary);
}

/** Active sites lapsing within `days` (today included) — the reminder list. */
export async function listSitesExpiringWithin(days: number): Promise<SiteSummary[]> {
  const n = clampInt(days, 7, 0, 365);
  const rows = await q<SiteSummaryRow>(
    `select ${siteCols("s")} from sites s
     where s.deleted_at is null and s.status = 'active' and s.paid_until is not null
       and s.paid_until >= current_date and s.paid_until <= current_date + ($1::int * interval '1 day')
     order by s.paid_until`,
    [n],
  );
  return rows.map(mapSummary);
}

export async function setSiteContent(id: string, content: SiteContent): Promise<SiteRecord | null> {
  const r = await one<SiteRow>(
    `update sites set content = $2::jsonb, updated_at = now() where id = $1 and deleted_at is null returning ${siteCols("sites", { content: true })}`,
    [id, json(content)],
  );
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
    const row = await one<SiteRow & { content_hash: string }>(
      `select ${siteCols("s", { content: true })}, md5(s.content::text) as content_hash from sites s where s.id = $1 and s.deleted_at is null`,
      [id],
    );
    if (!row) return null;
    const current = normalizeContent(parseJson(row.content, {}));
    const merged = deepMerge(current, patch);
    const updated = await one<SiteRow>(
      `update sites set content = $2::jsonb, updated_at = now()
       where id = $1 and deleted_at is null and md5(content::text) = $3 returning ${siteCols("sites", { content: true })}`,
      [id, json(merged), row.content_hash],
    );
    if (updated) return mapSite(updated);
  }
  throw new Error("concurrent_update");
}

/**
 * Marks a site deleted. This is what a delete button must call: the row, its projects, its visitor history
 * and its uploaded media all survive, so an accidental click is recoverable — there is no R2 versioning and
 * no per-tenant export to restore from. `purgeDeletedSites` removes it for real once the window has passed.
 *
 * The domain rows are deliberately left alone. They cascade on the purge, and keeping them means a restore
 * brings the site back on the same hostnames instead of a half-site nobody can reach. The cost is that the
 * slug and the hostnames stay reserved until the purge runs; reusing one means purging or renaming first.
 * Every lookup already refuses the site, so the hostname resolves to a 404 in the meantime.
 */
export async function softDeleteSite(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await one<{ id: string }>(`update sites set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null returning id`, [id]);
  return !!r;
}

/** Undo a soft delete: the site comes back with its content, projects, visitors and hostnames intact. */
export async function restoreSite(id: string): Promise<SiteRecord | null> {
  if (!isUuid(id)) return null;
  const r = await one<SiteRow>(
    `update sites set deleted_at = null, updated_at = now() where id = $1 and deleted_at is not null returning ${siteCols("sites", { content: true })}`,
    [id],
  );
  return r ? mapSite(r) : null;
}

/** Soft-deleted sites, oldest deletion first — the recycle bin, and what the purge job reports on. */
export async function listDeletedSites(): Promise<SiteSummary[]> {
  const rows = await q<SiteSummaryRow>(`select ${siteCols("s")} from sites s where s.deleted_at is not null order by s.deleted_at`);
  return rows.map(mapSummary);
}

/**
 * The real DELETE, cascading through projects, media rows, visitors and members. Explicit in the name because
 * nothing in the UI should reach it: `softDeleteSite` is the delete path, and this is the purge's last step.
 */
export async function hardDeleteSite(id: string) {
  await q(`delete from sites where id = $1`, [id]);
}

/** @deprecated Soft-deletes. Kept so existing callers keep compiling; say `hardDeleteSite` if you meant DELETE. */
export async function deleteSite(id: string) {
  await softDeleteSite(id);
}

/**
 * Removes sites soft-deleted more than `olderThanDays` ago, and returns the ids removed.
 *
 * The external cleanup (R2 objects, Vercel domains) is queued in the SAME transaction as the delete. The old
 * path deleted the rows first and then looped over R2 and Vercel with every failure swallowed, so a crash
 * mid-loop left orphaned objects that nothing recorded and nobody could find again. Now the delete either
 * lands together with its queue rows or does not land at all, and the cron drains the queue afterwards.
 */
export async function purgeDeletedSites(olderThanDays = 30): Promise<string[]> {
  const days = clampInt(olderThanDays, 30, 0, 3650);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const doomed = await tx.query<{ id: string }>(
      `select id from sites where deleted_at is not null and deleted_at < now() - ($1::int * interval '1 day') for update`,
      [days],
    );
    const ids = doomed.map((r) => r.id);
    if (!ids.length) return [];
    await tx.query(`insert into deletion_queue (kind, ref) select 'r2_object', key from media_assets where site_id = any($1::uuid[])`, [ids]);
    await tx.query(
      `insert into deletion_queue (kind, ref) select 'vercel_domain', hostname from site_domains where site_id = any($1::uuid[]) and kind = 'custom'`,
      [ids],
    );
    // Admins left with nothing to administer. Deleting them the moment their site was soft-deleted would
    // have been premature (the site is restorable for 30 days) and unrecoverable, so it waits until the
    // purge — but it has to happen, or the account lingers able to authenticate and reach no site at all.
    // Super admins and anyone who still belongs to another site are excluded by the NOT EXISTS.
    await tx.query(
      `insert into deletion_queue (kind, ref)
       select distinct 'user', m.user_id::text
       from site_members m join users u on u.id = m.user_id
       where m.site_id = any($1::uuid[]) and u.is_super = false
         and not exists (select 1 from site_members o where o.user_id = m.user_id and o.site_id <> all($1::uuid[]))`,
      [ids],
    );
    await tx.query(`delete from sites where id = any($1::uuid[])`, [ids]);
    return ids;
  });
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
