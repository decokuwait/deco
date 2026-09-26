import { q, one, iso } from "@/lib/db/client";
import type { Delivery, EventKey, Platform, Stage } from "@/lib/types";

/**
 * Persistence for conversion delivery: what was attempted, what has to be tried again, and what the
 * owner is shown about the health of each connection.
 *
 * It lives beside the dispatcher rather than in src/lib/db because the tables it owns
 * (`pending_deliveries`, `signal_attempts`, migration 0009) exist only for this feature, and because
 * `dispatchEvent` must stay importable — and testable — without a database.
 */

/** Attempts beyond this are not coming back: a queued delivery is dropped and left in the health log. */
export const MAX_RETRY_ATTEMPTS = 6;

/**
 * A stable, non-provider-authored code for one delivery outcome.
 * Provider prose is attacker-influenceable text that would end up rendered in the panel, so only
 * codes are stored here; the words stay in `visitor_events.deliveries` and the function log.
 */
export function deliveryCode(d: Delivery): string {
  if (d.skipped) return d.skipped;
  if (d.ok) return "ok";
  if (d.alarm) return d.alarm;
  if (typeof d.status === "number" && d.status) return `http_${d.status}`;
  return "network";
}

/**
 * Whether trying again can plausibly work.
 *
 * A 4xx is the platform telling us the request is wrong — retrying repeats the same rejection and
 * burns the queue. An expired token and a retired API version are the same story with a human in the
 * loop. Timeouts, 429s and 5xx are the ones a conversion should not be lost to.
 */
export function isRetryable(d: Delivery): boolean {
  if (d.ok || d.skipped || d.alarm) return false;
  if (typeof d.status === "number" && d.status) return d.status === 429 || d.status >= 500;
  return true; // no status at all: network error or the 8 s abort
}

/** Exponential backoff in minutes, so a platform having a bad hour is not hammered: 1, 4, 9, 16... */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60 * 6, Math.max(1, attempts * attempts));
}

export interface DispatchRecord {
  siteId: string;
  visitorId: string | null;
  eventKey: EventKey;
  eventId: string;
  eventTime: number;
  value: number | null;
  currency: string | null;
  stage: string | null;
  sourceUrl: string | null;
  test: boolean;
}

/** One attempt in the health log. Retries record here too, so the card shows recovery, not silence. */
export async function recordAttempt(siteId: string, eventKey: EventKey, d: Delivery): Promise<void> {
  await q(`insert into signal_attempts (site_id, platform, event_key, ok, code, analytics_only) values ($1, $2, $3, $4, $5, $6)`, [
    siteId,
    d.platform,
    eventKey,
    d.ok,
    deliveryCode(d),
    !!d.analyticsOnly,
  ]);
}

/** Record every attempt for the health card, and queue the ones worth retrying. */
export async function recordDispatch(rec: DispatchRecord, deliveries: Delivery[]): Promise<void> {
  if (!deliveries.length) return;
  for (const d of deliveries) {
    await recordAttempt(rec.siteId, rec.eventKey, d);
    // A test send must never queue a retry: it would re-fire against the live endpoint later.
    if (rec.test || !isRetryable(d)) continue;
    await q(
      `insert into pending_deliveries (site_id, visitor_id, platform, event_key, event_id, event_time, stage, value, currency, source_url, attempts, next_attempt_at, last_error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, now() + ($11::int * interval '1 minute'), $12)
       on conflict (event_id, platform) do nothing`,
      [rec.siteId, rec.visitorId, d.platform, rec.eventKey, rec.eventId, rec.eventTime, rec.stage, rec.value, rec.currency, rec.sourceUrl, retryDelayMinutes(1), deliveryCode(d)],
    );
  }
}

export interface PendingDelivery {
  id: string;
  siteId: string;
  visitorId: string | null;
  platform: Platform;
  eventKey: EventKey;
  eventId: string;
  eventTime: number;
  stage: string | null;
  value: number | null;
  currency: string | null;
  sourceUrl: string | null;
  attempts: number;
}

interface PendingRow {
  id: string;
  site_id: string;
  visitor_id: string | null;
  platform: Platform;
  event_key: EventKey;
  event_id: string;
  event_time: unknown;
  stage: string | null;
  value: unknown;
  currency: string | null;
  source_url: string | null;
  attempts: number;
}

export async function dueDeliveries(limit = 50): Promise<PendingDelivery[]> {
  const rows = await q<PendingRow>(
    `select * from pending_deliveries where next_attempt_at <= now() order by next_attempt_at limit ${Math.min(Math.max(limit, 1), 200)}`,
  );
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    visitorId: r.visitor_id,
    platform: r.platform,
    eventKey: r.event_key,
    eventId: r.event_id,
    eventTime: Number(r.event_time) || 0,
    stage: r.stage,
    value: r.value == null ? null : Number(r.value),
    currency: r.currency,
    sourceUrl: r.source_url,
    attempts: r.attempts,
  }));
}

export async function dropPendingDelivery(id: string): Promise<void> {
  await q(`delete from pending_deliveries where id = $1`, [id]);
}

/** Push a failed retry out to its next slot, or drop it once it has clearly stopped being transient. */
export async function rescheduleDelivery(id: string, attempts: number, code: string): Promise<void> {
  if (attempts >= MAX_RETRY_ATTEMPTS) {
    await dropPendingDelivery(id);
    return;
  }
  await q(
    `update pending_deliveries set attempts = $2, next_attempt_at = now() + ($3::int * interval '1 minute'), last_error = $4 where id = $1`,
    [id, attempts, retryDelayMinutes(attempts), code],
  );
}

/** Housekeeping for the cron: the health log is a rolling 30 days, not an archive. */
export async function trimSignalAttempts(days = 30): Promise<void> {
  await q(`delete from signal_attempts where created_at < now() - ($1::int * interval '1 day')`, [days]);
}

export interface PlatformHealth {
  platform: Platform;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastFailCode: string | null;
  failures7d: number;
  queued: number;
}

/**
 * Per-platform delivery health for the admin card. One query per platform is fine at this scale and
 * keeps the SQL readable; the indexes in 0009 make each of them an index scan.
 */
export async function signalHealth(siteId: string): Promise<Record<string, PlatformHealth>> {
  const rows = await q<{ platform: Platform; last_ok_at: unknown; last_fail_at: unknown; last_fail_code: string | null; failures_7d: unknown }>(
    `select platform,
            max(created_at) filter (where ok) as last_ok_at,
            max(created_at) filter (where not ok) as last_fail_at,
            (array_agg(code order by created_at desc) filter (where not ok))[1] as last_fail_code,
            count(*) filter (where not ok and created_at > now() - interval '7 days') as failures_7d
       from signal_attempts where site_id = $1 group by platform`,
    [siteId],
  );
  const queued = await q<{ platform: Platform; n: unknown }>(`select platform, count(*) as n from pending_deliveries where site_id = $1 group by platform`, [siteId]);
  const queuedBy = new Map(queued.map((r) => [r.platform, Number(r.n) || 0]));
  const out: Record<string, PlatformHealth> = {};
  for (const r of rows) {
    out[r.platform] = {
      platform: r.platform,
      lastOkAt: r.last_ok_at ? iso(r.last_ok_at) : null,
      lastFailAt: r.last_fail_at ? iso(r.last_fail_at) : null,
      lastFailCode: r.last_fail_code,
      failures7d: Number(r.failures_7d) || 0,
      queued: queuedBy.get(r.platform) ?? 0,
    };
  }
  for (const [platform, n] of queuedBy) {
    if (!out[platform]) out[platform] = { platform, lastOkAt: null, lastFailAt: null, lastFailCode: null, failures7d: 0, queued: n };
  }
  return out;
}

/**
 * The event id of the last signal sent for this visitor at this stage.
 *
 * "Resend signal" minted a fresh event id every time, so an owner who clicked it three times because
 * nothing visibly happened booked three separate Purchases: the ad platforms deduplicate on event id,
 * and three different ids are three different conversions. Reusing the id makes a resend idempotent
 * on their side, which is the only side that counts.
 */
export async function lastStageEventId(visitorId: string, stage: Stage): Promise<string | null> {
  const r = await one<{ event_id: string }>(
    `select event_id from visitor_events where visitor_id = $1 and stage = $2 order by created_at desc limit 1`,
    [visitorId, stage],
  );
  return r?.event_id ?? null;
}

/**
 * Bucketed uniqueness key for a stage mark, mirroring the click path's `clickDedupeKey`.
 * Two tabs (or a double tap on a slow connection) land in the same bucket, so the second insert is a
 * no-op and the second dispatch never happens.
 */
export function stageDedupeKey(visitorId: string, stage: Stage, minutes: number, now = Date.now()): string {
  return `${visitorId}:stage:${stage}:${Math.floor(now / (minutes * 60_000))}`;
}

