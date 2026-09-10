import { q, one, iso, isoOrNull, json, parseJson } from "./client";
import type { SourcePlatform, Stage, Visitor } from "@/lib/types";
import { detectAttribution, fbcFromClickId } from "@/lib/visitor/attribution";
import { generateVisitorCode } from "@/lib/visitor/code";

const DISPLAY_TZ = "Asia/Kuwait";

interface Row {
  id: string;
  site_id: string;
  code: string;
  source_platform: SourcePlatform;
  utm: unknown;
  click_ids: unknown;
  cookies: unknown;
  referrer: string | null;
  landing_url: string | null;
  user_agent: string | null;
  ip: string | null;
  first_seen_at: unknown;
  last_seen_at: unknown;
  visits: number;
  whatsapp_clicks: number;
  stage: Stage;
  stage_updated_at: unknown;
  notes: string | null;
  name: string | null;
  phone: string | null;
}

export function mapVisitor(r: Row): Visitor {
  return {
    id: r.id,
    siteId: r.site_id,
    code: r.code,
    sourcePlatform: r.source_platform,
    utm: parseJson(r.utm, {}),
    clickIds: parseJson(r.click_ids, {}),
    cookies: parseJson(r.cookies, {}),
    referrer: r.referrer,
    landingUrl: r.landing_url,
    userAgent: r.user_agent,
    ip: r.ip,
    firstSeenAt: iso(r.first_seen_at),
    lastSeenAt: iso(r.last_seen_at),
    visits: Number(r.visits),
    whatsappClicks: Number(r.whatsapp_clicks),
    stage: r.stage,
    stageUpdatedAt: isoOrNull(r.stage_updated_at),
    notes: r.notes,
    name: r.name,
    phone: r.phone,
  };
}

export async function getVisitorByCode(siteId: string, code: string): Promise<Visitor | null> {
  const r = await one<Row>(`select * from visitors where site_id = $1 and code = $2`, [siteId, code]);
  return r ? mapVisitor(r) : null;
}

export async function getVisitorById(id: string): Promise<Visitor | null> {
  const r = await one<Row>(`select * from visitors where id = $1`, [id]);
  return r ? mapVisitor(r) : null;
}

export interface TrackInput {
  siteId: string;
  /** Code from the visitor's cookie (null when there is none). */
  code: string | null;
  /** True when the proxy just generated this code: a collision must then allocate a new code instead of merging. */
  fresh?: boolean;
  landingUrl?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  cookies?: Record<string, string>;
}

/**
 * Register a visit. Unknown codes create a visitor row with attribution; known codes count a repeat visit
 * and refresh last-touch attribution when the new landing URL carries a click id or utm_source.
 * Concurrency-safe: the insert uses ON CONFLICT so two parallel first requests never allocate two codes.
 */
export async function trackVisit(input: TrackInput): Promise<{ visitor: Visitor; created: boolean }> {
  const cookies = input.cookies ?? {};
  const attr = detectAttribution(input.landingUrl, input.referrer);
  if (attr.clickIds.fbclid && !cookies._fbc) cookies._fbc = fbcFromClickId(attr.clickIds.fbclid)!;
  const landing = (input.landingUrl || "").slice(0, 2000) || null;
  const referrer = (input.referrer || "").slice(0, 1000) || null;
  const ua = (input.userAgent || "").slice(0, 500) || null;

  if (input.code && !input.fresh) {
    const existing = await one<Row>(`select * from visitors where site_id = $1 and code = $2`, [input.siteId, input.code]);
    if (existing) return { visitor: await touch(existing, attr, cookies, landing, referrer, ua, input.ip ?? null), created: false };
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const useOwnCode = attempt === 0 && input.code;
    const code = useOwnCode ? input.code! : generateVisitorCode();
    const r = await one<Row>(
      `insert into visitors (site_id, code, source_platform, utm, click_ids, cookies, referrer, landing_url, user_agent, ip)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
       on conflict (site_id, code) do nothing returning *`,
      [input.siteId, code, attr.sourcePlatform, json(attr.utm), json(attr.clickIds), json(cookies), referrer, landing, ua, input.ip ?? null],
    );
    if (r) return { visitor: mapVisitor(r), created: true };
    if (useOwnCode && !input.fresh) {
      // Lost a race with a parallel request for the same cookie code: treat as the existing visitor.
      const existing = await one<Row>(`select * from visitors where site_id = $1 and code = $2`, [input.siteId, code]);
      if (existing) return { visitor: await touch(existing, attr, cookies, landing, referrer, ua, input.ip ?? null), created: false };
    }
    // A fresh proxy code that collides with another visitor: allocate a new one (never merge strangers).
  }
  throw new Error("Could not allocate a visitor code");
}

async function touch(
  existing: Row,
  attr: ReturnType<typeof detectAttribution>,
  cookies: Record<string, string>,
  landing: string | null,
  referrer: string | null,
  ua: string | null,
  ip: string | null,
): Promise<Visitor> {
  const mergedCookies = { ...parseJson<Record<string, string>>(existing.cookies, {}), ...cookies };
  const knownPlatform = attr.sourcePlatform !== "direct" && attr.sourcePlatform !== "other";
  const hasClick = Object.keys(attr.clickIds).length > 0;
  // Last-touch attribution: a new campaign click updates the source; a plain revisit keeps the old one.
  const retouch = knownPlatform && (hasClick || !!attr.utm.utm_source);
  const r = await one<Row>(
    `update visitors set
       last_seen_at = now(),
       visits = visits + 1,
       cookies = $3::jsonb,
       user_agent = coalesce($4, user_agent),
       ip = coalesce($5, ip),
       source_platform = case when $6::boolean then $7 else source_platform end,
       click_ids = case when $6::boolean then click_ids || $8::jsonb else click_ids end,
       utm = case when $6::boolean then utm || $9::jsonb else utm end,
       landing_url = case when $6::boolean then coalesce($10, landing_url) else landing_url end,
       referrer = case when $6::boolean then coalesce($11, referrer) else referrer end
     where id = $1 and site_id = $2 returning *`,
    [existing.id, existing.site_id, json(mergedCookies), ua, ip, retouch, attr.sourcePlatform, json(attr.clickIds), json(attr.utm), landing, referrer],
  );
  return mapVisitor(r!);
}

export interface VisitorSearch {
  code?: string;
  stage?: Stage | "leads";
  source?: SourcePlatform;
  limit?: number;
  offset?: number;
}

export async function searchVisitors(siteId: string, s: VisitorSearch = {}): Promise<{ items: Visitor[]; total: number }> {
  const limit = Math.min(Math.max(s.limit ?? 30, 1), 200);
  const offset = Math.max(s.offset ?? 0, 0);
  const where = [`site_id = $1`];
  const params: unknown[] = [siteId];
  if (s.code) {
    params.push(`${s.code.replace(/[%_]/g, "")}%`);
    where.push(`code like $${params.length}`);
  }
  if (s.stage === "leads") where.push(`stage <> 'new'`);
  else if (s.stage) {
    params.push(s.stage);
    where.push(`stage = $${params.length}`);
  }
  if (s.source) {
    params.push(s.source);
    where.push(`source_platform = $${params.length}`);
  }
  const w = where.join(" and ");
  const totalRow = await one<{ n: unknown }>(`select count(*) as n from visitors where ${w}`, params);
  const rows = await q<Row>(`select * from visitors where ${w} order by last_seen_at desc limit ${limit} offset ${offset}`, params);
  return { items: rows.map(mapVisitor), total: Number(totalRow?.n ?? 0) };
}

export async function updateVisitor(id: string, patch: Partial<{ stage: Stage; notes: string | null; name: string | null; phone: string | null }>): Promise<Visitor | null> {
  const r = await one<Row>(
    `update visitors set
       stage = coalesce($2, stage),
       stage_updated_at = case when $2::text is null then stage_updated_at else now() end,
       notes = case when $3::text = '__keep__' then notes else $3 end,
       name = case when $4::text = '__keep__' then name else $4 end,
       phone = case when $5::text = '__keep__' then phone else $5 end
     where id = $1 returning *`,
    [id, patch.stage ?? null, patch.notes === undefined ? "__keep__" : patch.notes, patch.name === undefined ? "__keep__" : patch.name, patch.phone === undefined ? "__keep__" : patch.phone],
  );
  return r ? mapVisitor(r) : null;
}

export async function incrementWhatsappClicks(id: string) {
  await q(`update visitors set whatsapp_clicks = whatsapp_clicks + 1, last_seen_at = now() where id = $1`, [id]);
}

export interface VisitorStats {
  total: number;
  today: number;
  week: number;
  leads: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
  whatsappClicks: number;
}

/** Counts use the Kuwait calendar day so "today" matches what the admin sees. */
export async function visitorStats(siteId: string): Promise<VisitorStats> {
  const totals = await one<{ total: unknown; today: unknown; week: unknown; leads: unknown; wa: unknown }>(
    `select count(*) as total,
       count(*) filter (where first_seen_at >= (date_trunc('day', now() at time zone $2) at time zone $2)) as today,
       count(*) filter (where first_seen_at >= now() - interval '7 days') as week,
       count(*) filter (where stage <> 'new') as leads,
       coalesce(sum(whatsapp_clicks), 0) as wa
     from visitors where site_id = $1`,
    [siteId, DISPLAY_TZ],
  );
  const stages = await q<{ stage: string; n: unknown }>(`select stage, count(*) as n from visitors where site_id = $1 group by stage`, [siteId]);
  const sources = await q<{ source_platform: string; n: unknown }>(`select source_platform, count(*) as n from visitors where site_id = $1 group by source_platform`, [siteId]);
  const byStage: Record<string, number> = {};
  for (const s of stages) byStage[s.stage] = Number(s.n);
  const bySource: Record<string, number> = {};
  for (const s of sources) bySource[s.source_platform] = Number(s.n);
  return {
    total: Number(totals?.total ?? 0),
    today: Number(totals?.today ?? 0),
    week: Number(totals?.week ?? 0),
    leads: Number(totals?.leads ?? 0),
    byStage,
    bySource,
    whatsappClicks: Number(totals?.wa ?? 0),
  };
}
