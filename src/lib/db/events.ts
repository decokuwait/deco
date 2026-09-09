import { q, one, iso, json, parseJson } from "./client";
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
}): Promise<VisitorEvent> {
  const r = await one<Row>(
    `insert into visitor_events (visitor_id, site_id, event_type, stage, value, currency, event_id, targets, deliveries, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10) returning *`,
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
    ],
  );
  return map(r!);
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

export async function getEvent(id: string): Promise<VisitorEvent | null> {
  const r = await one<Row>(`select * from visitor_events where id = $1`, [id]);
  return r ? map(r) : null;
}
