import { requireSiteAdmin, sp1, withQuery, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { Card, PageHeader, Input, Select, Button, EmptyState, LinkButton, Flash } from "@/components/admin/ui";
import { searchVisitors, type VisitorSearch } from "@/lib/db/visitors";
import { STAGES, STAGE_LABELS, type SourcePlatform, type Stage } from "@/lib/types";
import { SourceBadge, StageBadge, sourceLabel } from "../_components/badges";
import { fmtDateTime } from "../_lib/format";

const SOURCES: SourcePlatform[] = ["meta", "tiktok", "snapchat", "google", "direct", "other"];
const LIMIT = 30;

function isStageFilter(v: string): v is Stage | "leads" {
  return v === "leads" || (STAGES as string[]).includes(v);
}
function isSource(v: string): v is SourcePlatform {
  return (SOURCES as string[]).includes(v);
}

export default async function VisitorsPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, locale, site } = ctx;

  const code = sp1(sp.code).replace(/\D/g, "").slice(0, 6);
  const stageRaw = sp1(sp.stage);
  const sourceRaw = sp1(sp.source);
  const page = Math.max(1, Number.parseInt(sp1(sp.page) || "1", 10) || 1);

  const search: VisitorSearch = { limit: LIMIT, offset: (page - 1) * LIMIT };
  if (code) search.code = code;
  if (isStageFilter(stageRaw)) search.stage = stageRaw;
  if (isSource(sourceRaw)) search.source = sourceRaw;

  const { items, total } = await searchVisitors(site.id, search);
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const pageHref = (p: number) => withQuery("/admin/visitors", { code, stage: stageRaw, source: sourceRaw, page: p > 1 ? p : undefined });

  return (
    <Panel ctx={ctx} active="visitors">
      <PageHeader title={t("visitors")} subtitle={`${total} ${t("results")}`} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} />

      <Card className="mb-5">
        <form method="get" action="/admin/visitors" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t("visitor_id")}</span>
            <Input name="code" defaultValue={code} inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder={t("search_visitor")} dir="ltr" className="font-mono text-lg tracking-widest" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t("stage")}</span>
            <Select name="stage" defaultValue={stageRaw}>
              <option value="">{t("all_stages")}</option>
              <option value="leads">{t("leads")}</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s][locale]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">{t("source")}</span>
            <Select name="source" defaultValue={sourceRaw}>
              <option value="">{t("all_sources")}</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s, locale)}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" className="w-full sm:w-auto">
            {t("search")}
          </Button>
        </form>
      </Card>

      {items.length === 0 ? (
        <EmptyState title={t("no_results")} hint={total === 0 && !code && !stageRaw && !sourceRaw ? t("no_visitors") : undefined} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((v) => (
            <li key={v.id}>
              <a href={`/admin/visitors/${v.code}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-2xl font-black tracking-[0.2em] text-slate-900" dir="ltr">
                    {v.code}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <SourceBadge source={v.sourcePlatform} locale={locale} />
                    <StageBadge stage={v.stage} locale={locale} />
                  </div>
                </div>
                {(v.name || v.phone) && (
                  <div className="mt-2 text-sm font-bold text-slate-700">
                    {v.name}
                    {v.name && v.phone ? " · " : ""}
                    {v.phone && <span dir="ltr">{v.phone}</span>}
                  </div>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-400">{t("first_seen")}</dt>
                    <dd className="font-bold">{fmtDateTime(v.firstSeenAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t("last_seen")}</dt>
                    <dd className="font-bold">{fmtDateTime(v.lastSeenAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t("visits")}</dt>
                    <dd className="font-bold tabular-nums">{v.visits}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">{t("whatsapp_clicks")}</dt>
                    <dd className="font-bold tabular-nums">{v.whatsappClicks}</dd>
                  </div>
                </dl>
              </a>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          {page > 1 ? <LinkButton href={pageHref(page - 1)}>{t("prev")}</LinkButton> : <span />}
          <span className="text-sm font-bold text-slate-600">
            {t("page")} {page} / {pages}
          </span>
          {page < pages ? <LinkButton href={pageHref(page + 1)}>{t("next")}</LinkButton> : <span />}
        </div>
      )}
    </Panel>
  );
}
