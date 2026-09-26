import { Badge, translateCode } from "@/components/admin/ui";
import type { Delivery, Locale } from "@/lib/types";
import { ta } from "@/lib/i18n/admin";
import { DELIVERY_TONE, classifyDelivery, type DeliveryView } from "@/lib/marketing/report";
import { PLATFORM_SHORT } from "../../_components/badges";
import { shortJson } from "../../_lib/format";

/**
 * Delivery results, told apart honestly.
 *
 * The shared `DeliveryList` has two states, ok and failed, and both were lies in a case that costs
 * money: a GA4 hit is green although Google Ads cannot optimise on it, and an X pixel with no Event
 * ID mapped is red although nothing is broken. This renders the five states that actually exist, and
 * `classifyDelivery` is exported so the shared components can adopt the same vocabulary.
 */
const VIEW_LABEL: Record<DeliveryView, Parameters<typeof ta>[1]> = {
  ok: "ok",
  analytics: "analytics_only",
  queued: "queued",
  skipped: "skipped",
  alarm: "needs_attention",
  failed: "failed",
};

export function DeliveryLines({ deliveries, locale, compact = false }: { deliveries: Delivery[]; locale: Locale; compact?: boolean }) {
  if (!deliveries.length) return <span className="text-xs text-slate-500">{ta(locale, "no_targets")}</span>;
  return (
    <ul className="flex flex-col gap-1">
      {deliveries.map((d, i) => {
        const view = classifyDelivery(d);
        const detail =
          view === "alarm"
            ? translateCode(locale, d.alarm!)
            : view === "analytics"
              ? ta(locale, "analytics_only_hint")
              : d.skipped
                ? translateCode(locale, d.skipped)
                : d.error
                  ? translateCode(locale, d.error)
                  : d.ok
                    ? ""
                    : shortJson(d.response, compact ? 80 : 200);
        return (
          <li key={`${d.platform}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-bold text-slate-800">{PLATFORM_SHORT[d.platform] ?? d.platform}</span>
            <Badge tone={DELIVERY_TONE[view]}>
              {ta(locale, VIEW_LABEL[view])}
              {d.status ? ` · ${d.status}` : ""}
            </Badge>
            {d.eventName && (
              <span className="font-mono text-slate-600" dir="ltr">
                {d.eventName}
              </span>
            )}
            {detail && (
              <span className="min-w-0 break-all text-slate-500" dir="ltr">
                {detail}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One badge for the whole event. An analytics-only event is never "sent": nothing was optimised on it. */
export function DeliveriesBadge({ deliveries, locale }: { deliveries: Delivery[]; locale: Locale }) {
  if (!deliveries.length) return <Badge tone="slate">{ta(locale, "none")}</Badge>;
  const views = deliveries.map(classifyDelivery);
  if (views.includes("alarm")) return <Badge tone="red">{ta(locale, "needs_attention")}</Badge>;
  const adSignals = views.filter((v) => v === "ok" || v === "failed" || v === "queued");
  if (!adSignals.length) return <Badge tone={views.includes("analytics") ? "blue" : "amber"}>{ta(locale, views.includes("analytics") ? "analytics_only" : "skipped")}</Badge>;
  const ok = adSignals.filter((v) => v === "ok").length;
  if (ok === adSignals.length) return <Badge tone="green">{ta(locale, "sent")}</Badge>;
  if (ok === 0) return <Badge tone="red">{ta(locale, "failed")}</Badge>;
  return <Badge tone="amber">{ta(locale, "partial")}</Badge>;
}
