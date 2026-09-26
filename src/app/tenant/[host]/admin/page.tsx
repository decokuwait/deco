import Link from "next/link";
import { requireSiteAdmin, sp1, type SearchParams } from "./_lib/guard";
import { Panel } from "./_components/Panel";
import { Card, PageHeader, LinkButton, EmptyState, Badge, Flash } from "@/components/admin/ui";
import { searchVisitors, visitorStats } from "@/lib/db/visitors";
import { listRecentEvents } from "@/lib/db/events";
import { siteUrl } from "@/lib/config";
import { PLATFORMS, STAGES, STAGE_LABELS, type SourcePlatform, type Stage } from "@/lib/types";
import { EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { DeliverySummary, DeliveryList, sourceLabel, StageBadge } from "./_components/badges";
import { fmtDateTime, fmtMoney } from "./_lib/format";

const SOURCES: SourcePlatform[] = [...PLATFORMS, "direct", "other"];
/** How far back the unhandled-lead count looks before it says "200+". */
const UNHANDLED_SCAN = 200;

function Bars({ rows, total }: { rows: Array<{ key: string; label: string; n: number; badge?: React.ReactNode }>; total: number }) {
  if (!rows.length) return <p className="text-sm text-slate-500">—</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.n / total) * 100) : 0;
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="font-bold text-slate-700">{r.badge ?? r.label}</span>
              <span className="tabular-nums text-slate-600">
                {r.n} <span className="text-xs text-slate-400">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, locale, site } = ctx;
  // "People who messaged me and I have not dealt with yet" is the owner's actual daily to-do list, and
  // it was not a view anywhere in the panel. A WhatsApp click does not advance the stage (nothing on the
  // public site can know whether the conversation happened), so the queue is exactly: clicked WhatsApp,
  // still "new". Counted from a bounded page rather than a dedicated query —
  // the number only has to tell the owner whether there is work waiting.
  const [stats, events, newVisitors] = await Promise.all([
    visitorStats(site.id),
    listRecentEvents(site.id, 20),
    searchVisitors(site.id, { stage: "new", limit: UNHANDLED_SCAN }),
  ]);
  const unhandled = newVisitors.items.filter((v) => v.whatsappClicks > 0);
  const unhandledLabel = newVisitors.total > UNHANDLED_SCAN && unhandled.length === UNHANDLED_SCAN ? `${UNHANDLED_SCAN}+` : String(unhandled.length);

  const cards: Array<{ label: string; value: number; tone: string }> = [
    { label: t("total"), value: stats.total, tone: "text-slate-900" },
    { label: t("today"), value: stats.today, tone: "text-emerald-700" },
    { label: t("this_week"), value: stats.week, tone: "text-emerald-700" },
    { label: t("leads"), value: stats.leads, tone: "text-violet-700" },
    { label: t("whatsapp_clicks"), value: stats.whatsappClicks, tone: "text-green-700" },
  ];

  const sourceRows = SOURCES.filter((s) => stats.bySource[s]).map((s) => ({ key: s, label: sourceLabel(s, locale), n: stats.bySource[s] }));
  const stageRows = STAGES.filter((s) => stats.byStage[s]).map((s: Stage) => ({
    key: s,
    label: STAGE_LABELS[s][locale],
    n: stats.byStage[s],
    badge: <StageBadge stage={s} locale={locale} />,
  }));

  return (
    <Panel ctx={ctx} active="dashboard">
      <PageHeader
        title={t("dashboard")}
        subtitle={`${t("welcome")} ${ctx.user.name || ctx.user.email}`}
        actions={
          <>
            <LinkButton href={siteUrl(host)} variant="primary">
              {t("open_site")}
            </LinkButton>
            <LinkButton href="/admin/visitors">{t("visitors")}</LinkButton>
          </>
        }
      />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} locale={locale} />

      {unhandled.length > 0 && (
        <Link
          href="/admin/visitors?stage=unhandled"
          className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition hover:border-amber-400"
        >
          <span>
            <span className="block text-sm font-black text-amber-900">
              {t("unhandled_leads")} · <span className="tabular-nums">{unhandledLabel}</span>
            </span>
            <span className="mt-0.5 block text-xs text-amber-800">{t("unhandled_leads_hint")}</span>
          </span>
          <span className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white">{t("open_queue")}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-500">{c.label}</div>
            <div className={`mt-1 text-3xl font-black tabular-nums ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title={t("by_source")}>
          {stats.total === 0 ? <p className="text-sm text-slate-500">{t("no_visitors")}</p> : <Bars rows={sourceRows} total={stats.total} />}
        </Card>
        <Card title={t("by_stage")}>
          {stats.total === 0 ? <p className="text-sm text-slate-500">{t("no_visitors")}</p> : <Bars rows={stageRows} total={stats.total} />}
        </Card>
      </div>

      <Card title={t("recent_events")} className="mt-5" actions={<LinkButton href="/admin/visitors?stage=leads">{t("leads")}</LinkButton>}>
        {events.length === 0 ? (
          <EmptyState title={t("no_events")} hint={t("mark_stage_hint")} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/admin/visitors/${e.visitorCode}`} className="font-mono text-base font-black tracking-widest text-slate-900 hover:text-emerald-700" dir="ltr">
                      {e.visitorCode}
                    </a>
                    <Badge tone="blue">{EVENT_KEY_LABELS[e.eventType]?.[locale] ?? e.eventType}</Badge>
                    {e.stage && <StageBadge stage={e.stage} locale={locale} />}
                    {e.value != null && <span className="text-xs font-bold text-slate-600">{fmtMoney(e.value, e.currency || "KWD")}</span>}
                    <DeliverySummary deliveries={e.deliveries} locale={locale} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{fmtDateTime(e.createdAt, locale)}</div>
                </div>
                <div className="sm:max-w-[55%]">
                  <DeliveryList deliveries={e.deliveries} locale={locale} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Panel>
  );
}
