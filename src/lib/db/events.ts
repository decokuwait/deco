import { q, one, iso, isUuid, json, parseJson } from "./client";
import type { Delivery, EventKey, Platform, Stage, VisitorEvent } from "@/lib/types";

interface Row {
  id: string;
  visitor_id: string;
  site_id: string;
  event_type: EventKey;
  stage: Stage | null;
  value: unknown;
  currency: string | null;
  event_id: string;
  targets: unknown;
  deliveries: unknown;
  created_by: string | null;
  created_at: unknown;
}

function map(r: Row): VisitorEvent {
  return {
    id: r.id,
    visitorId: r.visitor_id,
    siteId: r.site_id,
    eventType: r.event_type,
    stage: r.stage,
    value: r.value == null ? null : Number(r.value),
    currency: r.currency,
    eventId: r.event_id,
    targets: parseJson<Platform[]>(r.targets, []),
    deliveries: parseJson<Delivery[]>(r.deliveries, []),
    createdBy: r.created_by,
    createdAt: iso(r.created_at),
  };
}

export async function createEvent(input: {
  visitorId: string;
  siteId: string;
  eventType: EventKey;
  stage?: Stage | null;
  value?: number | null;
  currency?: string | null;
  eventId: string;
  targets?: Platform[];
  deliveries?: Delivery[];
  createdBy?: string | null;
  /**
   * Server-derived uniqueness key. When given, the insert is skipped (null is returned) if an event with
   * the same key already exists, so two parallel requests cannot both fire the same conversion.
   */
  dedupeKey?: string | null;
}): Promise<VisitorEvent | null> {
  const r = await one<Row>(
    `insert into visitor_events (visitor_id, site_id, event_type, stage, value, currency, event_id, targets, deliveries, created_by, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
     on conflict (dedupe_key) where dedupe_key is not null do nothing
     returning *`,
    [
      input.visitorId,
      input.siteId,
      input.eventType,
      input.stage ?? null,
      input.value ?? null,
      input.currency ?? null,
      input.eventId,
      json(input.targets ?? []),
      json(input.deliveries ?? []),
      input.createdBy ?? null,
      input.dedupeKey ?? null,
    ],
  );
  return r ? map(r) : null;
}

/** Bucketed dedupe key for a click event: the same visitor clicking again inside the window collides. */
export function clickDedupeKey(visitorId: string, eventType: EventKey, minutes: number, now = Date.now()): string {
  return `${visitorId}:${eventType}:${Math.floor(now / (minutes * 60_000))}`;
}

export async function setEventDeliveries(id: string, targets: Platform[], deliveries: Delivery[]) {
  await q(`update visitor_events set targets = $2::jsonb, deliveries = $3::jsonb where id = $1`, [id, json(targets), json(deliveries)]);
}

export async function listVisitorEvents(visitorId: string, limit = 100): Promise<VisitorEvent[]> {
  const rows = await q<Row>(`select * from visitor_events where visitor_id = $1 order by created_at desc limit ${Math.min(limit, 500)}`, [visitorId]);
  return rows.map(map);
}

export async function listRecentEvents(siteId: string, limit = 20): Promise<(VisitorEvent & { visitorCode: string })[]> {
  const rows = await q<Row & { visitor_code: string }>(
    `select e.*, v.code as visitor_code from visitor_events e join visitors v on v.id = e.visitor_id
     where e.site_id = $1 and e.event_type <> 'page_view' order by e.created_at desc limit ${Math.min(limit, 200)}`,
    [siteId],
  );
  return rows.map((r) => ({ ...map(r), visitorCode: r.visitor_code }));
}

/** True when the visitor already has an event of this type within the last `minutes` (click dedupe). */
export async function hasRecentEvent(visitorId: string, eventType: EventKey, minutes: number): Promise<boolean> {
  const r = await one<{ ok: number }>(
    `select 1 as ok from visitor_events where visitor_id = $1 and event_type = $2 and created_at > now() - ($3::int * interval '1 minute') limit 1`,
    [visitorId, eventType, minutes],
  );
  return !!r;
}

export async function getEvent(id: string): Promise<VisitorEvent | null> {
  if (!isUuid(id)) return null;
  const r = await one<Row>(`select * from visitor_events where id = $1`, [id]);
  return r ? map(r) : null;
}
