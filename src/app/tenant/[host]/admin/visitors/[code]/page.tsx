import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Field, Input, Textarea, Badge, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getVisitorByCode } from "@/lib/db/visitors";
import { listVisitorEvents } from "@/lib/db/events";
import { getActivePixels } from "@/lib/db/pixels";
import { selectSignal } from "@/lib/marketing/select";
import { EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { OPTIMISATION_STAGES, REPORTING_STAGES } from "@/lib/marketing/stages";
import { STAGE_LABELS, type Locale, type Stage } from "@/lib/types";
import type { SelectionReason } from "@/lib/marketing/select";
import type { AdminUiKey } from "@/lib/i18n/admin";
import { PLATFORM_SHORT, SourceBadge, StageBadge, sourceLabel } from "../../_components/badges";
import { DeliveriesBadge, DeliveryLines } from "../_components/Deliveries";
import { fmtDateTime, fmtMoney } from "../../_lib/format";
import { markStage, saveVisitorInfo } from "./actions";
import { StageButtons } from "./StageButtons";

// Stage marking / test events fan out to the ad platforms (8 s timeout each, in parallel): allow more than the 10 s default.
export const maxDuration = 30;

const MARK_STAGES: Stage[] = [...OPTIMISATION_STAGES, ...REPORTING_STAGES];
const VALUE_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];

/**
 * How the targets were chosen. The old card said "smart" and hid the fan-out in a parenthetical,
 * which is the one place a wrong word costs real budget.
 */
const REASON_LABEL: Record<SelectionReason, AdminUiKey> = { source: "source", primary: "primary_platform", all: "all", none: "none" };

function stageOption(s: Stage, locale: Locale, current: Stage, currentIdx: number) {
  const index = MARK_STAGES.indexOf(s) + 1;
  return { value: s, label: STAGE_LABELS[s][locale], index, isCurrent: current === s, done: index < currentIdx, usesValue: VALUE_STAGES.includes(s) };
}

export default async function VisitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ host: string; code: string }>;
  searchParams: SearchParams;
}) {
  const { host, code } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, locale, site } = ctx;
  const visitor = await getVisitorByCode(site.id, code);
  if (!visitor) notFound();

  const [events, pixels] = await Promise.all([listVisitorEvents(visitor.id, 100), getActivePixels(site.id)]);
  const signalMode = site.content.settings.signalMode;
  const { targets, reason, unknownSource } = selectSignal(pixels, visitor.sourcePlatform, signalMode, undefined, site.content.settings.primaryPlatform);
  // One customer counted in several ad accounts is the failure mode this card exists to expose, so it
  // is called out where the decision is made rather than explained on the settings page.
  const fanout = targets.length > 1 && unknownSource;

  const saved = sp1(sp.saved);
  const error = sp1(sp.error);
  const phoneWarn = sp1(sp.warn) === "phone";
  const flash =
    saved === "sent"
      ? { tone: "green", text: t("signal_sent") }
      : saved === "analytics"
        ? { tone: "amber", text: t("signal_analytics_only") }
        : saved === "deduped"
          ? { tone: "amber", text: t("signal_deduped") }
          : saved === "partial"
            ? { tone: "amber", text: t("signal_partial") }
            : saved === "failed"
              ? { tone: "red", text: t("signal_failed") }
              : saved === "nosignal"
                ? { tone: "amber", text: t("stage_saved_no_signal") }
                : saved === "same"
                  ? { tone: "amber", text: t("same_stage") }
                  : saved
                    ? { tone: "green", text: t("saved") }
                    : error
                      ? { tone: "red", text: `${t("error")}: ${error === "invalid_stage" ? t("invalid_stage") : error === "value_required" ? t("value_required") : error}` }
                      : null;
  const flashCls: Record<string, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };

  const mark = markStage.bind(null, host, visitor.code);
  const saveInfo = saveVisitorInfo.bind(null, host, visitor.code);
  const stageOrder = ["new", ...MARK_STAGES];
  const currentIdx = stageOrder.indexOf(visitor.stage);

  return (
    <Panel ctx={ctx} active="visitors">
      <BackLink href="/admin/visitors" label={t("visitors")} />
      <PageHeader
        title={
          <span className="font-mono tracking-[0.2em]" dir="ltr">
            {visitor.code}
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <SourceBadge source={visitor.sourcePlatform} locale={locale} />
            <StageBadge stage={visitor.stage} locale={locale} />
            {visitor.stageUpdatedAt && (
              <span className="text-xs text-slate-500">
                {t("stage_updated")}: {fmtDateTime(visitor.stageUpdatedAt, locale)}
              </span>
            )}
          </span>
        }
      />
      {flash && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${flashCls[flash.tone]}`}>{flash.text}</div>}
      {phoneWarn && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${flashCls.amber}`}>{t("invalid_kw_mobile")}</div>}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* Stage marking: the core feature */}
          <Card title={t("mark_as")}>
            <p className="mb-3 text-sm text-slate-600">{t("mark_stage_hint_honest")}</p>
            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${fanout ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="font-bold text-slate-700">
                {t("will_send_to")} ({t(REASON_LABEL[reason])}):
              </div>
              {targets.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {targets.map((p) => (
                    <Badge key={p.platform} tone="green">
                      {PLATFORM_SHORT[p.platform]}
                    </Badge>
                  ))}
                  <span className="text-xs text-slate-500">
                    · {t("source")}: {sourceLabel(visitor.sourcePlatform, locale)}
                  </span>
                </div>
              ) : pixels.length ? (
                <div className="mt-1 text-xs font-bold text-amber-700">{t("will_send_nothing")}</div>
              ) : (
                <div className="mt-1 text-xs font-bold text-amber-700">
                  {t("no_pixels")} — {t("no_pixels_hint")}
                </div>
              )}
              {fanout && <p className="mt-2 text-xs font-bold text-amber-800">{t("signal_fanout_warning")}</p>}
            </div>
            <form action={mark} className="flex flex-col gap-3">
              {/* A disabled default button blocks implicit submission (Enter in the value field) from picking a stage. */}
              <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
              {/* The phone belongs HERE, not in the details card further down. It is dispatched with the
                  signal, and it is the difference between an identifier Meta has never seen and one it
                  has: it is saved as part of the mark so the owner cannot forget the second form. */}
              <Field label={t("phone_for_ads")} hint={t("phone_for_ads_hint")}>
                <Input name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="off" defaultValue={visitor.phone ?? ""} placeholder="9655xxxxxxx" />
              </Field>
              <Field label={t("value")} hint={t("value_hint")}>
                <Input name="value" type="number" inputMode="decimal" step="0.001" min="0" dir="ltr" placeholder="0.000" />
              </Field>
              <p className="text-xs font-bold text-slate-600">{t("ad_optimisation_events")}</p>
              <StageButtons
                pendingText={t("sending")}
                resendLabel={t("resend_signal")}
                currentStage={visitor.stage}
                stages={OPTIMISATION_STAGES.map((s) => stageOption(s, locale, visitor.stage, currentIdx))}
              />
              <p className="mt-1 text-xs font-bold text-slate-600">{t("business_reporting_events")}</p>
              <StageButtons
                pendingText={t("sending")}
                resendLabel=""
                currentStage="new"
                stages={REPORTING_STAGES.map((s) => stageOption(s, locale, visitor.stage, currentIdx))}
              />
              <p className="text-xs text-slate-500">{t("attribution_window_note")}</p>
              {visitor.stage !== "new" && (
                <button type="submit" name="stage" value="new" className="self-start text-xs font-bold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                  {t("reset_stage")}
                </button>
              )}
            </form>
          </Card>

          {/* Name / phone / notes */}
          <Card title={t("visitor_details")}>
            <form action={saveInfo} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("name")}>
                  <Input name="name" defaultValue={visitor.name ?? ""} autoComplete="off" />
                </Field>
                <Field label={t("phone")}>
                  <Input name="phone" defaultValue={visitor.phone ?? ""} type="tel" inputMode="tel" dir="ltr" autoComplete="off" />
                </Field>
              </div>
              <Field label={t("notes")}>
                <Textarea name="notes" defaultValue={visitor.notes ?? ""} />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
              </div>
            </form>
            <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <div>
                <dt className="text-slate-400">{t("first_seen")}</dt>
                <dd className="font-bold">{fmtDateTime(visitor.firstSeenAt, locale)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">{t("last_seen")}</dt>
                <dd className="font-bold">{fmtDateTime(visitor.lastSeenAt, locale)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">{t("visits")}</dt>
                <dd className="font-bold tabular-nums">{visitor.visits}</dd>
              </div>
              <div>
                <dt className="text-slate-400">{t("whatsapp_clicks")}</dt>
                <dd className="font-bold tabular-nums">{visitor.whatsappClicks}</dd>
              </div>
              {visitor.landingUrl && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-400">{t("landing_url")}</dt>
                  <dd className="truncate font-mono" dir="ltr">
                    {visitor.landingUrl}
                  </dd>
                </div>
              )}
              {visitor.referrer && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-400">{t("referrer")}</dt>
                  <dd className="truncate font-mono" dir="ltr">
                    {visitor.referrer}
                  </dd>
                </div>
              )}
              {Object.keys(visitor.utm).length > 0 && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-400">{t("utm")}</dt>
                  <dd className="break-all font-mono" dir="ltr">
                    {Object.entries(visitor.utm)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ")}
                  </dd>
                </div>
              )}
              {Object.keys(visitor.clickIds).length > 0 && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-slate-400">{t("click_ids")}</dt>
                  <dd className="break-all font-mono" dir="ltr">
                    {Object.entries(visitor.clickIds)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        {/* Event history with per-platform delivery results */}
        <Card title={t("history")}>
          {events.length === 0 ? (
            <EmptyState title={t("no_events")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{EVENT_KEY_LABELS[e.eventType]?.[locale] ?? e.eventType}</Badge>
                    {e.stage && <StageBadge stage={e.stage} locale={locale} />}
                    {e.value != null && <span className="text-xs font-bold text-slate-700">{fmtMoney(e.value, e.currency || "KWD")}</span>}
                    <DeliveriesBadge deliveries={e.deliveries} locale={locale} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {fmtDateTime(e.createdAt, locale)}
                    {e.targets.length > 0 && (
                      <>
                        {" · "}
                        {t("targets")}: {e.targets.map((p) => PLATFORM_SHORT[p] ?? p).join(", ")}
                      </>
                    )}
                  </div>
                  <div className="mt-2">
                    <DeliveryLines deliveries={e.deliveries} locale={locale} />
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-slate-400" dir="ltr">
                    {t("event")} ID: {e.eventId}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Panel>
  );
}
