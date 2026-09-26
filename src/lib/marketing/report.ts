import type { Delivery } from "@/lib/types";

/**
 * How one delivery should be presented to the owner.
 *
 * Three states used to collapse into "green or red", and each collapse cost money:
 *  - `analytics`: a GA4 Measurement Protocol hit. Real, but it is not a conversion Google Ads can
 *    optimise on, and a green "sent" badge told the owner their spend was working when it was not.
 *  - `skipped`: nothing was configured (X with no Event ID). A gap to fill, not a failure to fear.
 *  - `alarm`: an expired token or a retired API version. It breaks every event for every tenant until
 *    a human acts, so it must not look like the 500 that will fix itself.
 */
export type DeliveryView = "ok" | "analytics" | "queued" | "skipped" | "alarm" | "failed";

export function classifyDelivery(d: Pick<Delivery, "ok" | "skipped" | "alarm" | "analyticsOnly">): DeliveryView {
  if (d.skipped) return d.skipped === "queued_for_retry" ? "queued" : "skipped";
  if (d.alarm) return "alarm";
  if (!d.ok) return "failed";
  return d.analyticsOnly ? "analytics" : "ok";
}

export const DELIVERY_TONE: Record<DeliveryView, "green" | "amber" | "red" | "slate" | "blue"> = {
  ok: "green",
  analytics: "blue",
  queued: "amber",
  skipped: "amber",
  alarm: "red",
  failed: "red",
};
