import { Badge } from "@/components/admin/ui";
import { billingStatus, formatFils, planLabel } from "@/lib/billing";
import type { BillingCycle, Locale, Plan } from "@/lib/types";
import type { T } from "../_lib/guard";

/**
 * "Paid until / overdue" as one glance.
 *
 * Every list and page in the super panel reads this from the same function so they cannot disagree about
 * whether a site is late — the panel, the cron and the SQL all derive the answer from `paid_until` and
 * today's Kuwait calendar day, never from a status flag somebody remembered to set.
 */
export function BillingBadge({ paidUntil, t, today }: { paidUntil: string | null; t: T; today?: string }) {
  const s = billingStatus(paidUntil, today);
  if (s.state === "unsold") return <Badge tone="slate">{t("not_sold")}</Badge>;
  if (s.state === "overdue")
    return (
      <Badge tone="red">
        {t("overdue")} · {s.daysOverdue} {t("days_overdue")}
      </Badge>
    );
  if (s.state === "expiring")
    return (
      <Badge tone="amber">{s.daysLeft === 0 ? t("expires_today") : `${s.daysLeft} ${t("days_left")}`}</Badge>
    );
  return (
    <Badge tone="green">
      {t("paid_until")} {paidUntil}
    </Badge>
  );
}

/** Plan + price + cycle, the way it reads on an invoice line. */
export function PlanSummary({ plan, priceFils, cycle, locale, t }: { plan: Plan; priceFils: number; cycle: BillingCycle; locale: Locale; t: T }) {
  return (
    <span className="text-xs text-slate-600">
      {planLabel(plan, locale)} · {formatFils(priceFils, locale)} / {cycle === "yearly" ? t("yearly") : t("monthly")}
    </span>
  );
}
