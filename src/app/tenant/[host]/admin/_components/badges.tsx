import { Badge, translateCode } from "@/components/admin/ui";
import { STAGE_LABELS, type Delivery, type Locale, type Platform, type SourcePlatform, type Stage } from "@/lib/types";
import { ta } from "@/lib/i18n/admin";
import { shortJson } from "../_lib/format";

export const PLATFORM_SHORT: Record<Platform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
  x: "X",
};

const SOURCE_TONE: Record<SourcePlatform, "blue" | "slate" | "amber" | "green" | "violet" | "red"> = {
  meta: "blue",
  tiktok: "slate",
  snapchat: "amber",
  google: "green",
  x: "violet",
  direct: "slate",
  other: "slate",
};

export function sourceLabel(source: SourcePlatform, locale: Locale): string {
  if (source === "direct") return ta(locale, "direct");
  if (source === "other") return ta(locale, "other");
  return PLATFORM_SHORT[source];
}

export function SourceBadge({ source, locale }: { source: SourcePlatform; locale: Locale }) {
  return <Badge tone={SOURCE_TONE[source] ?? "slate"}>{sourceLabel(source, locale)}</Badge>;
}

const STAGE_TONE: Record<Stage, "slate" | "blue" | "amber" | "violet" | "green"> = {
  new: "slate",
  contacted: "blue",
  called_for_visit: "amber",
  ordered: "violet",
  first_payment: "green",
  order_complete: "green",
};

export function StageBadge({ stage, locale }: { stage: Stage; locale: Locale }) {
  return <Badge tone={STAGE_TONE[stage] ?? "slate"}>{STAGE_LABELS[stage]?.[locale] ?? stage}</Badge>;
}

/** One line per platform: status badge, event name and a short response/error. */
export function DeliveryList({ deliveries, locale, compact = false }: { deliveries: Delivery[]; locale: Locale; compact?: boolean }) {
  if (!deliveries.length) return <span className="text-xs text-slate-500">{ta(locale, "no_targets")}</span>;
  return (
    <ul className="flex flex-col gap-1">
      {deliveries.map((d, i) => {
        const tone = d.skipped ? "amber" : d.ok ? "green" : "red";
        const label = d.skipped ? ta(locale, "skipped") : d.ok ? ta(locale, "ok") : ta(locale, "failed");
        const detail = d.skipped ? translateCode(locale, d.skipped) : d.error ? translateCode(locale, d.error) : d.ok ? "" : shortJson(d.response, compact ? 80 : 200);
        return (
          <li key={`${d.platform}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-bold text-slate-800">{PLATFORM_SHORT[d.platform] ?? d.platform}</span>
            <Badge tone={tone}>
              {label}
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
            {!compact && d.ok && d.response != null && (
              <span className="min-w-0 break-all text-slate-400" dir="ltr">
                {shortJson(d.response, 200)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Aggregate badge for an event: sent / partial / failed / none. */
export function DeliverySummary({ deliveries, locale }: { deliveries: Delivery[]; locale: Locale }) {
  if (!deliveries.length) return <Badge tone="slate">{ta(locale, "none")}</Badge>;
  const okCount = deliveries.filter((d) => d.ok).length;
  if (okCount === deliveries.length) return <Badge tone="green">{ta(locale, "sent")}</Badge>;
  if (okCount === 0) return <Badge tone="red">{ta(locale, "failed")}</Badge>;
  return <Badge tone="amber">{ta(locale, "partial")}</Badge>;
}
