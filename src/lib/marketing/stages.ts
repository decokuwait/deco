import type { Stage } from "@/lib/types";
import type { Delivery } from "@/lib/types";

/** Stages that may carry an amount (sent as value/currency to the ad platforms). */
export const VALUE_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];
/** Purchase-type stages must carry an amount so the ad platforms receive a valid value/currency. */
export const VALUE_REQUIRED: Stage[] = ["first_payment", "order_complete"];

export type MarkOutcome = "saved" | "sent" | "partial" | "failed" | "nosignal";

export function stageAcceptsValue(stage: Stage): boolean {
  return VALUE_STAGES.includes(stage);
}

/** True when marking this stage without a (non-negative) amount must be refused. */
export function stageNeedsValue(stage: Stage, value: number | null | undefined): boolean {
  return VALUE_REQUIRED.includes(stage) && (value == null || Number.isNaN(value) || value < 0);
}

/** Summarises the delivery results of one signal for the admin flash message. */
export function deliveryOutcome(deliveries: Pick<Delivery, "ok">[]): MarkOutcome {
  if (!deliveries.length) return "nosignal";
  const ok = deliveries.filter((d) => d.ok).length;
  if (ok === deliveries.length) return "sent";
  if (ok === 0) return "failed";
  return "partial";
}
