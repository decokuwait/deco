import Link from "next/link";
import { requireSuper, sp1, type SearchParams } from "../_lib/guard";
import { SuperPanel } from "../_components/Panel";
import { PageHeader } from "@/components/admin/ui";
import { CATEGORIES, CATEGORY_LABELS, isCategory, type Category } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { FONTS } from "@/templates/fonts";
import { TemplateThumb } from "@/templates/Thumb";

export default async function SuperTemplatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const catRaw = sp1(sp.cat);
  const active: Category | "all" = isCategory(catRaw) ? catRaw : "all";
  const shown: Category[] = active === "all" ? CATEGORIES : [active];
  const tabs: { key: Category | "all"; href: string; label: string }[] = [
    { key: "all", href: "/super/templates", label: t("all") },
    ...CATEGORIES.map((c) => ({ key: c as Category | "all", href: `/super/templates?cat=${c}`, label: CATEGORY_LABELS[c][locale] })),
  ];
  return (
    <SuperPanel ctx={ctx} active="templates">
      <PageHeader title={t("templates")} subtitle="101–115 · 201–215 · 301–315 · 401–415" />
      <nav aria-label={t("templates")} className="mb-6 flex flex-wrap gap-2 text-sm font-bold">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 transition ${on ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {shown.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-lg font-black text-slate-900">
            {CATEGORY_LABELS[cat][locale]} <span className="text-sm font-semibold text-slate-500">({templatesFor(cat).length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templatesFor(cat).map((tpl) => (
              <div key={tpl.code} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <TemplateThumb def={tpl}>
                  <span className="absolute start-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-black text-white">{tpl.code}</span>
                  <span className="absolute end-3 top-3 flex gap-1">
                    {[tpl.tokens.primary, tpl.tokens.secondary, tpl.tokens.accent].map((c, i) => (
                      <span key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-white/60" style={{ background: c }} />
                    ))}
                  </span>
                </TemplateThumb>
                <div className="px-3 pt-3" style={{ fontFamily: FONTS[tpl.tokens.headingFont].css }}>
                  <div className="text-xl font-black leading-tight text-slate-900">{tpl.name[locale]}</div>
                  <div className="text-xs text-slate-500">{tpl.description[locale]}</div>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 text-xs">
                  <span className="text-slate-500">
                    {tpl.layout.hero} · {tpl.layout.nav} · {tpl.layout.services}
                  </span>
                  <span className="flex gap-1.5">
                    <a href={`/template/${tpl.code}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-50">
                      {t("preview")}
                    </a>
                    <a href={`/super/sites/new?cat=${cat}&template=${tpl.code}`} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-700">
                      {t("use_template")}
                    </a>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </SuperPanel>
  );
}
