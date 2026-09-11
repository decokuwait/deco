import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Field, Input, Textarea, Badge, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getVisitorByCode } from "@/lib/db/visitors";
import { listVisitorEvents } from "@/lib/db/events";
import { getActivePixels } from "@/lib/db/pixels";
import { selectTargets } from "@/lib/marketing/select";
import { EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { STAGE_LABELS, type Stage } from "@/lib/types";
import { DeliveryList, DeliverySummary, PLATFORM_SHORT, SourceBadge, StageBadge, sourceLabel } from "../../_components/badges";
import { fmtDateTime, fmtMoney } from "../../_lib/format";
import { markStage, saveVisitorInfo } from "./actions";
import { StageButtons } from "./StageButtons";

// Stage marking / test events fan out to the ad platforms (8 s timeout each, in parallel): allow more than the 10 s default.
export const maxDuration = 30;

const MARK_STAGES: Stage[] = ["contacted", "called_for_visit", "ordered", "first_payment", "order_complete"];
const VALUE_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];

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
  const targets = selectTargets(pixels, visitor.sourcePlatform, signalMode);

  const saved = sp1(sp.saved);
  const error = sp1(sp.error);
  const flash =
    saved === "sent"
      ? { tone: "green", text: t("signal_sent") }
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

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* Stage marking: the core feature */}
          <Card title={t("mark_as")}>
            <p className="mb-3 text-sm text-slate-600">{t("mark_stage_hint")}</p>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="font-bold text-slate-700">
                {t("will_send_to")} ({signalMode === "smart" ? t("send_mode_smart").split(":")[0] : t("all")}):
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
              ) : (
                <div className="mt-1 text-xs font-bold text-amber-700">
                  {t("no_pixels")} — {t("no_pixels_hint")}
                </div>
              )}
            </div>
            <form action={mark} className="flex flex-col gap-3">
              {/* A disabled default button blocks implicit submission (Enter in the value field) from picking a stage. */}
              <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
              <Field label={t("value")} hint={t("value_hint")}>
                <Input name="value" type="number" inputMode="decimal" step="0.001" min="0" dir="ltr" placeholder="0.000" />
              </Field>
              <StageButtons
                pendingText={t("sending")}
                resendLabel={t("resend_signal")}
                currentStage={visitor.stage}
                stages={MARK_STAGES.map((s, i) => ({
                  value: s,
                  label: STAGE_LABELS[s][locale],
                  index: i + 1,
                  isCurrent: visitor.stage === s,
                  done: i + 1 < currentIdx,
                  usesValue: VALUE_STAGES.includes(s),
                }))}
              />
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
                    <DeliverySummary deliveries={e.deliveries} locale={locale} />
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
                    <DeliveryList deliveries={e.deliveries} locale={locale} />
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
