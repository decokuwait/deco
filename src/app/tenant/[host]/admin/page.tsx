import { requireSiteAdmin, sp1, type SearchParams } from "./_lib/guard";
import { Panel } from "./_components/Panel";
import { Card, PageHeader, LinkButton, EmptyState, Badge, Flash } from "@/components/admin/ui";
import { visitorStats } from "@/lib/db/visitors";
import { listRecentEvents } from "@/lib/db/events";
import { siteUrl } from "@/lib/config";
import { PLATFORMS, STAGES, STAGE_LABELS, type SourcePlatform, type Stage } from "@/lib/types";
import { EVENT_KEY_LABELS } from "@/lib/marketing/mapping";
import { DeliverySummary, DeliveryList, sourceLabel, StageBadge } from "./_components/badges";
import { fmtDateTime, fmtMoney } from "./_lib/format";

const SOURCES: SourcePlatform[] = [...PLATFORMS, "direct", "other"];

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
  const [stats, events] = await Promise.all([visitorStats(site.id), listRecentEvents(site.id, 20)]);

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
