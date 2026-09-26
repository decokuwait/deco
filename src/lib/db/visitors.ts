import { randomBytes, timingSafeEqual } from "node:crypto";
import { q, one, iso, isoOrNull, isUuid, json, parseJson } from "./client";
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

/**
 * Explicit column list, never `select *`.
 *
 * `secret` is deliberately absent: it is the bearer credential for the public endpoints, and the only code
 * allowed to hold it is the code that mints it or checks it. Keeping it out of `Row` means it cannot reach
 * `mapVisitor`, and so cannot end up in an admin JSON payload or a server-component prop by accident.
 */
const VISITOR_FIELDS = [
  "id",
  "site_id",
  "code",
  "source_platform",
  "utm",
  "click_ids",
  "cookies",
  "referrer",
  "landing_url",
  "user_agent",
  "ip",
  "first_seen_at",
  "last_seen_at",
  "visits",
  "whatsapp_clicks",
  "stage",
  "stage_updated_at",
  "notes",
  "name",
  "phone",
];
function visitorCols(alias = "v") {
  return VISITOR_FIELDS.map((c) => `${alias}.${c}`).join(", ");
}

const SECRET_RE = /^[0-9a-f]{32}$/;

/** 128 bits of randomness, hex. The HttpOnly companion to the 6-digit code, which is guessable by design. */
export function generateVisitorSecret(): string {
  return randomBytes(16).toString("hex");
}

/** Compares two secrets without letting the comparison's duration say how much of the prefix was right. */
function secretMatches(stored: string | null | undefined, supplied: string | null | undefined): boolean {
  if (!stored || !supplied) return false;
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(supplied, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak the length; compare a fixed shape.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

/**
 * Lookup by code alone. The code is a 6-digit number in a readable cookie and printed in WhatsApp messages,
 * so it proves nothing: this is for the ADMIN, behind the session guard. A public endpoint must use
 * `getVisitorByCodeAndSecret` instead.
 */
export async function getVisitorByCode(siteId: string, code: string): Promise<Visitor | null> {
  const r = await one<Row>(`select ${visitorCols("v")} from visitors v where v.site_id = $1 and v.code = $2`, [siteId, code]);
  return r ? mapVisitor(r) : null;
}

/**
 * Lookup for the public endpoints: the caller must present the HttpOnly secret that was issued with the row.
 * A row created before 0005 has no secret and can therefore never be matched here — that is intended. Those
 * visitors get a new row (and a secret) on their next visit rather than a credential anyone could guess.
 */
export async function getVisitorByCodeAndSecret(siteId: string, code: string, secret: string | null | undefined): Promise<Visitor | null> {
  if (!isUuid(siteId) || !code || !secret) return null;
  const r = await one<Row & { secret: string | null }>(
    `select ${visitorCols("v")}, v.secret from visitors v where v.site_id = $1 and v.code = $2`,
    [siteId, code],
  );
  if (!r || !secretMatches(r.secret, secret)) return null;
  return mapVisitor(r);
}

export async function getVisitorById(id: string): Promise<Visitor | null> {
  if (!isUuid(id)) return null;
  const r = await one<Row>(`select ${visitorCols("v")} from visitors v where v.id = $1`, [id]);
  return r ? mapVisitor(r) : null;
}

export interface TrackInput {
  siteId: string;
  /** Code from the visitor's cookie (null when there is none). */
  code: string | null;
  /**
   * The HttpOnly secret that goes with `code`.
   *
   * For a public caller (`requireSecret`) it is the credential being *presented*, and nothing else.
   * For a trusted caller — the server render, reading the `x-dk-vsec` header the proxy forwarded — it is
   * also the secret to STORE on a row this call creates, because the proxy has already put that value in
   * the visitor's cookie. Without it the row would get a different secret from the cookie, every first
   * visit would fail its own /api/track check, and the endpoint would answer by creating a second row.
   */
  secret?: string | null;
  /** True when the proxy just generated this code: a collision must then allocate a new code instead of merging. */
  fresh?: boolean;
  /**
   * Set by callers that cannot trust their input — i.e. the public /api/track endpoint.
   *
   * With it, a supplied `code` is honoured only when `secret` matches the stored one; otherwise the call
   * falls through to allocating a FRESH code. Without it (the server render, which reads the cookie the
   * proxy itself set), a supplied code may still mint a row at that code.
   *
   * This closes the hole in the old `useOwnCode = attempt === 0 && input.code`: an unauthenticated caller
   * could POST any 6-digit code and mint a visitor row at it, or — worse — have their attribution,
   * user agent and IP merged into a stranger's existing row by guessing that stranger's code.
   */
  requireSecret?: boolean;
  /**
   * Whether this call is a page view of its own (default true).
   *
   * A first visit reaches trackVisit twice for one page view: the server render creates the row, then the
   * browser's /api/track call enriches it with the pixel cookies. Counting both made every visitor's first
   * visit register as two, and every later page view as one.
   */
  countVisit?: boolean;
  landingUrl?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  cookies?: Record<string, string>;
}

export interface TrackResult {
  visitor: Visitor;
  created: boolean;
  /**
   * The row's secret, for the caller to (re)issue as an HttpOnly cookie. Present on every call, including a
   * returning visit, so that a row created before 0005 — or one whose cookie was lost — gets one on its
   * next visit instead of staying unauthenticatable for ever.
   */
  secret: string;
}

/**
 * Register a visit. Unknown codes create a visitor row with attribution; known codes count a repeat visit
 * and refresh last-touch attribution when the new landing URL carries a click id or utm_source.
 * Concurrency-safe: the insert uses ON CONFLICT so two parallel first requests never allocate two codes.
 */
export async function trackVisit(input: TrackInput): Promise<TrackResult> {
  const cookies = input.cookies ?? {};
  const attr = detectAttribution(input.landingUrl, input.referrer);
  if (attr.clickIds.fbclid && !cookies._fbc) cookies._fbc = fbcFromClickId(attr.clickIds.fbclid)!;
  const landing = (input.landingUrl || "").slice(0, 2000) || null;
  const referrer = (input.referrer || "").slice(0, 1000) || null;
  const ua = (input.userAgent || "").slice(0, 500) || null;

  const countVisit = input.countVisit ?? true;
  // A caller that has to prove itself may present a secret but may never choose one: that would let anyone
  // pick the credential for a row they are about to create at a code of their choosing.
  const chosenSecret = !input.requireSecret && typeof input.secret === "string" && SECRET_RE.test(input.secret) ? input.secret : null;

  if (input.code && !input.fresh) {
    const existing = await one<Row & { secret: string | null }>(
      `select ${visitorCols("v")}, v.secret from visitors v where v.site_id = $1 and v.code = $2`,
      [input.siteId, input.code],
    );
    // A caller that has to prove ownership and cannot is treated as a stranger: it gets its own new row.
    if (existing && (!input.requireSecret || secretMatches(existing.secret, input.secret))) {
      return touch(existing, attr, cookies, landing, referrer, ua, input.ip ?? null, countVisit, chosenSecret);
    }
  }

  // A code the caller supplied may only be *created* when the caller is trusted. A public caller always
  // gets a fresh one, so it can neither choose its own code nor squat on somebody else's.
  // `fresh` does NOT mean "discard the proxy's code" — it means "if that code is already taken, allocate a
  // new one instead of merging into a stranger's row". Excluding fresh here threw the proxy's code away on
  // every first visit, so the row never matched the `dk_vid` cookie (or the id already printed in the
  // WhatsApp message) and the reconciliation round trip fired every single time.
  const mayUseOwnCode = !!input.code && !input.requireSecret;
  for (let attempt = 0; attempt < 8; attempt++) {
    const useOwnCode = attempt === 0 && mayUseOwnCode;
    const code = useOwnCode ? input.code! : generateVisitorCode();
    // The same secret across retries: a collision changes the code, not the browser, and the cookie the
    // proxy already set holds this value.
    const secret = chosenSecret ?? generateVisitorSecret();
    const r = await one<Row>(
      `insert into visitors (site_id, code, secret, source_platform, utm, click_ids, cookies, referrer, landing_url, user_agent, ip)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
       on conflict (site_id, code) do nothing returning ${visitorCols("visitors")}`,
      [input.siteId, code, secret, attr.sourcePlatform, json(attr.utm), json(attr.clickIds), json(cookies), referrer, landing, ua, input.ip ?? null],
    );
    if (r) return { visitor: mapVisitor(r), created: true, secret };
    if (useOwnCode && !input.fresh) {
      // Lost a race with a parallel request for the same cookie code: treat as the existing visitor.
      // Guarded on `!fresh`: a *fresh* code that collides belongs to somebody else, and merging there
      // would hand this visitor a stranger's lead history. That case falls through and re-rolls instead.
      const existing = await one<Row & { secret: string | null }>(
        `select ${visitorCols("v")}, v.secret from visitors v where v.site_id = $1 and v.code = $2`,
        [input.siteId, code],
      );
      if (existing) return touch(existing, attr, cookies, landing, referrer, ua, input.ip ?? null, countVisit, chosenSecret);
    }
    // A fresh proxy code that collides with another visitor: allocate a new one (never merge strangers).
  }
  throw new Error("Could not allocate a visitor code");
}

async function touch(
  existing: Row & { secret: string | null },
  attr: ReturnType<typeof detectAttribution>,
  cookies: Record<string, string>,
  landing: string | null,
  referrer: string | null,
  ua: string | null,
  ip: string | null,
  countVisit: boolean,
  chosenSecret: string | null,
): Promise<TrackResult> {
  const mergedCookies = { ...parseJson<Record<string, string>>(existing.cookies, {}), ...cookies };
  const knownPlatform = attr.sourcePlatform !== "direct" && attr.sourcePlatform !== "other";
  const hasClick = Object.keys(attr.clickIds).length > 0;
  // Last-touch attribution: a new campaign click updates the source; a plain revisit keeps the old one.
  const retouch = knownPlatform && (hasClick || !!attr.utm.utm_source);
  // Rows created before 0005 have no secret. One is adopted from the trusted caller's cookie, or minted, on
  // the next visit so the visitor can be authenticated from then on. An existing secret is never rotated,
  // or the visitor's own cookie would stop matching on their next request.
  const secret = existing.secret || chosenSecret || generateVisitorSecret();
  const r = await one<Row>(
    `update visitors set
       last_seen_at = now(),
       visits = visits + case when $12::boolean then 1 else 0 end,
       cookies = $3::jsonb,
       user_agent = coalesce($4, user_agent),
       ip = coalesce($5, ip),
       secret = coalesce(secret, $13),
       source_platform = case when $6::boolean then $7 else source_platform end,
       click_ids = case when $6::boolean then click_ids || $8::jsonb else click_ids end,
       utm = case when $6::boolean then utm || $9::jsonb else utm end,
       landing_url = case when $6::boolean then coalesce($10, landing_url) else landing_url end,
       referrer = case when $6::boolean then coalesce($11, referrer) else referrer end
     where id = $1 and site_id = $2 returning ${visitorCols("visitors")}`,
    [existing.id, existing.site_id, json(mergedCookies), ua, ip, retouch, attr.sourcePlatform, json(attr.clickIds), json(attr.utm), landing, referrer, countVisit, secret],
  );
  return { visitor: mapVisitor(r!), created: false, secret };
}

export interface VisitorSearch {
  code?: string;
  stage?: Stage | "leads";
  source?: SourcePlatform;
  limit?: number;
  offset?: number;
}

/** Clamps a page-size/offset that came from a query string to a safe integer (NaN and 1e20 included). */
function clampInt(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export async function searchVisitors(siteId: string, s: VisitorSearch = {}): Promise<{ items: Visitor[]; total: number }> {
  // Bound parameters, not interpolation: `?page=100000000000000000000` produced `offset 3e+21`, which is
  // not valid SQL, so a crafted query string turned the visitors page into a 500.
  const limit = clampInt(s.limit, 30, 1, 200);
  const offset = clampInt(s.offset, 0, 0, 1_000_000);
  const where = [`v.site_id = $1`];
  const params: unknown[] = [siteId];
  if (s.code) {
    params.push(`${s.code.replace(/[%_]/g, "")}%`);
    where.push(`v.code like $${params.length}`);
  }
  if (s.stage === "leads") where.push(`v.stage <> 'new'`);
  else if (s.stage) {
    params.push(s.stage);
    where.push(`v.stage = $${params.length}`);
  }
  if (s.source) {
    params.push(s.source);
    where.push(`v.source_platform = $${params.length}`);
  }
  const w = where.join(" and ");
  const totalRow = await one<{ n: unknown }>(`select count(*) as n from visitors v where ${w}`, params);
  const rows = await q<Row>(
    `select ${visitorCols("v")} from visitors v where ${w} order by v.last_seen_at desc limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { items: rows.map(mapVisitor), total: Number(totalRow?.n ?? 0) };
}

/**
 * Updates a visitor. Fields left out of `patch` keep their value; fields set to null are cleared.
 *
 * "Keep" is signalled by a separate boolean parameter rather than a magic string in the value itself:
 * a sentinel like `'__keep__'` is also something an owner can type into the notes field, and then the
 * note they wrote was silently dropped and the old one kept.
 */
export async function updateVisitor(id: string, patch: Partial<{ stage: Stage; notes: string | null; name: string | null; phone: string | null }>): Promise<Visitor | null> {
  const r = await one<Row>(
    `update visitors set
       stage = coalesce($2, stage),
       stage_updated_at = case when $2::text is null then stage_updated_at else now() end,
       notes = case when $3::boolean then notes else $4 end,
       name  = case when $5::boolean then name  else $6 end,
       phone = case when $7::boolean then phone else $8 end
     where id = $1 returning ${visitorCols("visitors")}`,
    [
      id,
      patch.stage ?? null,
      patch.notes === undefined, patch.notes ?? null,
      patch.name === undefined, patch.name ?? null,
      patch.phone === undefined, patch.phone ?? null,
    ],
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

/**
 * Retention, for the cron.
 *
 * A visitor row holds an IP, a user agent, a referrer and a landing URL: personal data collected for
 * attribution, which stops being useful long before it stops being a liability. After `months` the
 * identifying half is nulled out and the row keeps only what the funnel reports on (code, stage, counts).
 * The stage history and the lead's own name and phone are untouched — those are the business record.
 */
export async function anonymiseOldVisitors(months = 18): Promise<number> {
  const m = clampInt(months, 18, 1, 600);
  const rows = await q<{ id: string }>(
    `update visitors set ip = null, user_agent = null, referrer = null, landing_url = null
     where last_seen_at < now() - ($1::int * interval '1 month')
       and (ip is not null or user_agent is not null or referrer is not null or landing_url is not null)
     returning id`,
    [m],
  );
  return rows.length;
}

/**
 * Visitors that never became anything: still at stage `new`, no name, no phone, no WhatsApp click, and not
 * seen for `months`. These are bounces, and keeping a personal record of a bounce for years has no defence.
 */
export async function deleteStaleNewVisitors(months = 24): Promise<number> {
  const m = clampInt(months, 24, 1, 600);
  const rows = await q<{ id: string }>(
    `delete from visitors
     where stage = 'new' and whatsapp_clicks = 0 and name is null and phone is null
       and last_seen_at < now() - ($1::int * interval '1 month')
     returning id`,
    [m],
  );
  return rows.length;
}
