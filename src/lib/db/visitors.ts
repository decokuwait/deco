import { q, one, iso, isoOrNull, json, parseJson } from "./client";
import type { SourcePlatform, Stage, Visitor } from "@/lib/types";
import { detectAttribution, fbcFromClickId } from "@/lib/visitor/attribution";
import { generateVisitorCode } from "@/lib/visitor/code";

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
  code: string | null;
  landingUrl?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  cookies?: Record<string, string>;
}

/**
 * Register a visit. If the code is unknown for this site a new visitor row is created with attribution.
 * Returns the visitor plus whether it was newly created (so the caller can set/refresh the cookie).
 */
export async function trackVisit(input: TrackInput): Promise<{ visitor: Visitor; created: boolean }> {
  const cookies = input.cookies ?? {};
  if (input.code) {
    const existing = await one<Row>(`select * from visitors where site_id = $1 and code = $2`, [input.siteId, input.code]);
    if (existing) {
      const mergedCookies = { ...parseJson<Record<string, string>>(existing.cookies, {}), ...cookies };
      const r = await one<Row>(
        `update visitors set last_seen_at = now(), visits = visits + 1, cookies = $3::jsonb, user_agent = coalesce($4, user_agent), ip = coalesce($5, ip)
         where id = $1 and site_id = $2 returning *`,
        [existing.id, input.siteId, json(mergedCookies), input.userAgent ?? null, input.ip ?? null],
      );
      return { visitor: mapVisitor(r!), created: false };
    }
  }

  const attr = detectAttribution(input.landingUrl, input.referrer);
  if (attr.clickIds.fbclid && !cookies._fbc) cookies._fbc = fbcFromClickId(attr.clickIds.fbclid)!;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = attempt === 0 && input.code ? input.code : generateVisitorCode();
    const r = await one<Row>(
      `insert into visitors (site_id, code, source_platform, utm, click_ids, cookies, referrer, landing_url, user_agent, ip)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
       on conflict (site_id, code) do nothing returning *`,
      [
        input.siteId,
        code,
        attr.sourcePlatform,
        json(attr.utm),
        json(attr.clickIds),
        json(cookies),
        (input.referrer || "").slice(0, 1000) || null,
        (input.landingUrl || "").slice(0, 2000) || null,
        (input.userAgent || "").slice(0, 500) || null,
        input.ip ?? null,
      ],
    );
    if (r) return { visitor: mapVisitor(r), created: true };
  }
  throw new Error("Could not allocate a visitor code");
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
    params.push(`${s.code}%`);
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

export async function visitorStats(siteId: string): Promise<VisitorStats> {
  const totals = await one<{ total: unknown; today: unknown; week: unknown; leads: unknown; wa: unknown }>(
    `select count(*) as total,
       count(*) filter (where first_seen_at >= date_trunc('day', now())) as today,
       count(*) filter (where first_seen_at >= now() - interval '7 days') as week,
       count(*) filter (where stage <> 'new') as leads,
       coalesce(sum(whatsapp_clicks), 0) as wa
     from visitors where site_id = $1`,
    [siteId],
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
