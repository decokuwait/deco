import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTemplate, neighbours, TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { CATEGORY_LABELS, type Locale } from "@/lib/types";
import { getRequestLocale } from "@/lib/site-request";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ code: t.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const def = getTemplate(code);
  if (!def) return { title: "Template not found" };
  return { title: `${def.code} — ${def.name.ar} | ${def.name.en}`, description: def.description.en };
}

export default async function TemplatePreview({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const def = getTemplate(code);
  if (!def) notFound();
  const cookieLocale = await getRequestLocale("ar");
  const locale: Locale = sp.lang === "en" ? "en" : sp.lang === "ar" ? "ar" : cookieLocale;
  const site = previewSiteData(def);
  const ctx = buildCtx({ site, def, locale, visitorCode: "123456", preview: true });
  const { prev, next } = neighbours(def.code);
  const other = locale === "ar" ? "en" : "ar";
  return (
    <div>
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 bg-[#0b1220] px-4 py-2 text-xs text-white sm:text-sm" dir="rtl">
        <div className="flex items-center gap-3">
          <Link href="/templates" className="rounded-full bg-white/10 px-3 py-1 font-bold hover:bg-white/20">
            ← القوالب
          </Link>
          <span className="rounded bg-amber-400 px-2 py-0.5 font-black text-black">{def.code}</span>
          <span className="hidden font-bold sm:inline">
            {def.name.ar} · {CATEGORY_LABELS[def.category].ar}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/template/${def.code}?lang=${other}`} className="rounded-full bg-white/10 px-3 py-1 font-bold hover:bg-white/20">
            {other === "en" ? "English" : "العربية"}
          </Link>
          {prev && (
            <Link href={`/template/${prev.code}`} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" title={prev.name.en}>
              {prev.code}
            </Link>
          )}
          {next && (
            <Link href={`/template/${next.code}`} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20" title={next.name.en}>
              {next.code}
            </Link>
          )}
        </div>
      </div>
      <TemplateRenderer ctx={ctx} />
    </div>
  );
}
