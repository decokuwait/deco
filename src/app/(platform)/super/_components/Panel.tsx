import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/Shell";
import { superNav, type NavKey, type SuperCtx } from "../_lib/guard";
import { superLogout } from "../_lib/actions";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { FONTS } from "@/templates/fonts";
import { ROOT_DOMAIN } from "@/lib/config";

export function SuperPanel({ ctx, active, children }: { ctx: SuperCtx; active: NavKey; children: ReactNode }) {
  return (
    <AdminShell title={ctx.t("title")} subtitle={ROOT_DOMAIN} nav={superNav(active, ctx.t)} locale={ctx.locale} logoutAction={superLogout} logoutLabel={ctx.t("logout")}>
      {children}
    </AdminShell>
  );
}

/** Radio cards for every template, grouped by category, with colour swatches and a preview link. */
export function TemplatePicker({ name, value, category, locale, previewLabel }: { name: string; value?: string; category?: Category; locale: "ar" | "en"; previewLabel: string }) {
  const cats = category ? [category] : CATEGORIES;
  return (
    <div className="grid gap-5">
      {cats.map((cat) => (
        <div key={cat}>
          <div className="mb-2 text-sm font-black text-slate-700">{CATEGORY_LABELS[cat][locale]}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templatesFor(cat).map((t) => (
              <label key={t.code} className="relative cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-2 has-[:checked]:border-emerald-600 has-[:checked]:ring-2 has-[:checked]:ring-emerald-200">
                <input type="radio" name={name} value={t.code} defaultChecked={value === t.code} className="peer sr-only" />
                <div className="rounded-lg p-3" style={{ background: t.tokens.bg, color: t.tokens.text, fontFamily: FONTS[t.tokens.headingFont].css }}>
                  <div className="flex items-center justify-between">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: t.tokens.primary, color: t.tokens.primaryFg }}>
                      {t.code}
                    </span>
                    <span className="flex gap-1">
                      {[t.tokens.primary, t.tokens.secondary, t.tokens.accent].map((c, i) => (
                        <span key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-black leading-tight">{t.name[locale]}</div>
                  <div className="text-[11px] opacity-70">{t.description[locale]}</div>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
                  <span>
                    {t.layout.hero} · {t.layout.services}
                  </span>
                  <a href={`/template/${t.code}`} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline">
                    {previewLabel} ↗
                  </a>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
