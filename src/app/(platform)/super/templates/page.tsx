import { requireSuper } from "../_lib/guard";
import { SuperPanel } from "../_components/Panel";
import { PageHeader } from "@/components/admin/ui";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { FONTS } from "@/templates/fonts";

export default async function SuperTemplatesPage() {
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  return (
    <SuperPanel ctx={ctx} active="templates">
      <PageHeader title={t("templates")} subtitle="101–115 · 201–215 · 301–315 · 401–415" />
      {CATEGORIES.map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-lg font-black text-slate-900">
            {CATEGORY_LABELS[cat][locale]} <span className="text-sm font-semibold text-slate-500">({templatesFor(cat).length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templatesFor(cat).map((tpl) => (
              <div key={tpl.code} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="p-4" style={{ background: tpl.tokens.bg, color: tpl.tokens.text, fontFamily: FONTS[tpl.tokens.headingFont].css }}>
                  <div className="flex items-center justify-between">
                    <span className="rounded px-2 py-0.5 text-[10px] font-black" style={{ background: tpl.tokens.primary, color: tpl.tokens.primaryFg }}>
                      {tpl.code}
                    </span>
                    <span className="flex gap-1">
                      {[tpl.tokens.primary, tpl.tokens.secondary, tpl.tokens.accent, tpl.tokens.surface2].map((c, i) => (
                        <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  </div>
                  <div className="mt-3 text-2xl font-black leading-tight">{tpl.name[locale]}</div>
                  <div className="text-xs opacity-70">{tpl.description[locale]}</div>
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
