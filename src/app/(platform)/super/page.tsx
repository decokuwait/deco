import { requireSuper, sp1, superError, type SearchParams } from "./_lib/guard";
import { SuperPanel } from "./_components/Panel";
import { PageHeader, Flash, LinkButton, Badge, EmptyState } from "@/components/admin/ui";
import { listSites } from "@/lib/db/sites";
import { CATEGORY_LABELS } from "@/lib/types";
import { getTemplate } from "@/templates/registry";
import { siteUrl, rootPort } from "@/lib/config";

export default async function SitesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const sites = await listSites();
  const port = rootPort();
  return (
    <SuperPanel ctx={ctx} active="sites">
      <PageHeader title={t("sites")} subtitle={`${sites.length}`} actions={<LinkButton href="/super/sites/new" variant="primary">+ {t("new_site")}</LinkButton>} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} translate={superError(t)} />
      {sites.length === 0 ? (
        <EmptyState title={t("no_sites")} action={<LinkButton href="/super/sites/new" variant="primary">{t("new_site")}</LinkButton>} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {sites.map((s) => {
            const tpl = getTemplate(s.templateCode);
            const primary = s.domains.find((d) => d.kind === "subdomain") ?? s.domains[0];
            const host = primary ? `${primary.hostname}${port}` : null;
            return (
              <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={`/super/sites/${s.id}`} className="block truncate text-lg font-black text-slate-900 hover:text-emerald-700">
                      {s.name}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone="violet">{CATEGORY_LABELS[s.category][locale]}</Badge>
                      <Badge tone="blue">
                        {s.templateCode} {tpl ? `· ${tpl.name[locale]}` : ""}
                      </Badge>
                      <Badge tone={s.status === "active" ? "green" : "amber"}>{s.status === "active" ? t("active") : t("paused")}</Badge>
                    </div>
                  </div>
                  <span className="h-10 w-10 shrink-0 rounded-xl" style={{ background: tpl?.tokens.primary ?? "#999" }} />
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {s.domains.map((d) => (
                    <li key={d.hostname} className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono" dir="ltr">
                      {d.hostname}
                      <span className={`h-2 w-2 rounded-full ${d.verified ? "bg-emerald-500" : "bg-amber-400"}`} title={d.verified ? t("verified") : t("pending_dns")} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {t("visitors")}: <b>{s.visitorCount}</b> · {t("leads")}: <b>{s.leadCount}</b>
                  </span>
                  <span className="flex gap-1.5">
                    {host && (
                      <>
                        <LinkButton href={siteUrl(host)} className="px-2.5 py-1.5 text-xs">
                          {t("open_site")}
                        </LinkButton>
                        <LinkButton href={siteUrl(host, "/admin")} className="px-2.5 py-1.5 text-xs">
                          {t("open_admin")}
                        </LinkButton>
                      </>
                    )}
                    <LinkButton href={`/super/sites/${s.id}`} variant="secondary" className="px-2.5 py-1.5 text-xs">
                      {t("edit")}
                    </LinkButton>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SuperPanel>
  );
}
