import type { Stage } from "@/lib/types";
import type { Delivery } from "@/lib/types";

/** Stages that may carry an amount (sent as value/currency to the ad platforms). */
export const VALUE_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];
/** Purchase-type stages must carry an amount so the ad platforms receive a valid value/currency. */
export const VALUE_REQUIRED: Stage[] = ["first_payment", "order_complete"];

/**
 * Stages that actually teach the ad platforms anything.
 *
 * Meta's longest attribution window is 7-day click, and its `event_time` ceiling is also 7 days, so a
 * conversion cannot be back-dated into the window it belongs to either. A Kuwaiti decor job runs for
 * weeks: by the time the owner marks `ordered` or `first_payment`, the click that produced it is
 * outside every window. The event is accepted, stored and reported green — and attributed to no ad.
 *
 * These two land inside the window because the owner marks them the same day they answer WhatsApp.
 */
export const OPTIMISATION_STAGES: Stage[] = ["contacted", "called_for_visit"];
/** Marked weeks later. Real business reporting, but not something ad delivery can learn from. */
export const REPORTING_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];

export function isOptimisationStage(stage: Stage): boolean {
  return OPTIMISATION_STAGES.includes(stage);
}

export type MarkOutcome = "saved" | "sent" | "partial" | "failed" | "nosignal" | "analytics" | "deduped";

export function stageAcceptsValue(stage: Stage): boolean {
  return VALUE_STAGES.includes(stage);
}

/** True when marking this stage without a (non-negative) amount must be refused. */
export function stageNeedsValue(stage: Stage, value: number | null | undefined): boolean {
  return VALUE_REQUIRED.includes(stage) && (value == null || Number.isNaN(value) || value < 0);
}

/**
 * Summarises the delivery results of one signal for the admin flash message.
 *
 * Two kinds of delivery are deliberately not counted as ad signals:
 *  - `skipped` is a configuration gap, not a failure. X's default event map is empty, so a correctly
 *    connected X account reported "signal failed" on every single stage mark, forever, until the owner
 *    found a collapsed accordion. A skip is neutral.
 *  - `analyticsOnly` is a GA4 hit. It is real, but Google Ads cannot optimise on it, so calling it a
 *    sent conversion tells the owner their money is working when it is not.
 */
export function deliveryOutcome(deliveries: Pick<Delivery, "ok" | "skipped" | "analyticsOnly">[]): MarkOutcome {
  if (!deliveries.length) return "nosignal";
  const attempted = deliveries.filter((d) => !d.skipped);
  if (!attempted.length) return "nosignal";
  const adSignals = attempted.filter((d) => !d.analyticsOnly);
  if (!adSignals.length) return attempted.some((d) => d.ok) ? "analytics" : "failed";
  const ok = adSignals.filter((d) => d.ok).length;
  if (ok === adSignals.length) return "sent";
  if (ok === 0) return "failed";
  return "partial";
}
