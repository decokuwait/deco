import { getVisitorById } from "@/lib/db/visitors";
import { getPixel } from "@/lib/db/pixels";
import type { Delivery } from "@/lib/types";
import { PROVIDERS, serverReady } from "./dispatch";
import { resolveEventName } from "./mapping";
import { MAX_RETRY_ATTEMPTS, deliveryCode, dropPendingDelivery, dueDeliveries, recordAttempt, rescheduleDelivery, trimSignalAttempts, type PendingDelivery } from "./store";
import type { SendContext } from "./types";

export interface DrainResult {
  attempted: number;
  delivered: number;
  dropped: number;
  rescheduled: number;
}

/**
 * Re-send the conversions that a transient failure lost.
 *
 * Called by the cron in src/app/api/cron/**. It rebuilds each request from the visitor
 * and the pixel AS THEY ARE NOW rather than replaying a stored payload — the token may have been
 * rotated, and the visitor may have gained a phone number since, which is the difference between a
 * 2/10 and a 7/10 match. `event_id` is preserved, so a retry that crosses with a late success is
 * deduplicated by the ad platform instead of counted twice.
 *
 * Never throws: a cron that dies on one bad row stops draining the queue for everybody.
 */
export async function drainPendingDeliveries(limit = 50, fetchImpl?: typeof fetch): Promise<DrainResult> {
  const out: DrainResult = { attempted: 0, delivered: 0, dropped: 0, rescheduled: 0 };
  let due: PendingDelivery[] = [];
  try {
    due = await dueDeliveries(limit);
  } catch (err) {
    console.error("[marketing] reading the retry queue failed", err);
    return out;
  }
  for (const row of due) {
    out.attempted += 1;
    try {
      const result = await retryOne(row, fetchImpl);
      if (result === "delivered") out.delivered += 1;
      else if (result === "dropped") out.dropped += 1;
      else out.rescheduled += 1;
    } catch (err) {
      console.error("[marketing] retry failed", err);
      await rescheduleDelivery(row.id, row.attempts + 1, "network").catch(() => {});
      out.rescheduled += 1;
    }
  }
  try {
    await trimSignalAttempts();
  } catch {
    /* housekeeping is best effort */
  }
  return out;
}

async function retryOne(row: PendingDelivery, fetchImpl?: typeof fetch): Promise<"delivered" | "dropped" | "rescheduled"> {
  const [visitor, pixel] = await Promise.all([row.visitorId ? getVisitorById(row.visitorId) : Promise.resolve(null), getPixel(row.siteId, row.platform)]);
  // The visitor was deleted, or the owner disconnected/broke the pixel: there is nothing left to send.
  if (!visitor || !pixel || !pixel.active || !serverReady(pixel)) {
    await dropPendingDelivery(row.id);
    return "dropped";
  }
  const ctx: SendContext = {
    pixel,
    eventKey: row.eventKey,
    eventName: resolveEventName(pixel, row.eventKey),
    eventId: row.eventId,
    eventTime: row.eventTime,
    visitor,
    sourceUrl: row.sourceUrl,
    value: row.value,
    currency: row.currency,
    stage: row.stage,
    fetchImpl,
  };
  let delivery: Delivery;
  try {
    delivery = await PROVIDERS[row.platform].send(ctx);
  } catch (err) {
    delivery = { platform: row.platform, ok: false, eventName: ctx.eventName, error: err instanceof Error ? err.message : String(err) };
  }
  await recordAttempt(row.siteId, row.eventKey, delivery).catch(() => {});
  if (delivery.ok || delivery.skipped) {
    await dropPendingDelivery(row.id);
    return delivery.ok ? "delivered" : "dropped";
  }
  await rescheduleDelivery(row.id, row.attempts + 1, deliveryCode(delivery));
  return row.attempts + 1 >= MAX_RETRY_ATTEMPTS ? "dropped" : "rescheduled";
}
