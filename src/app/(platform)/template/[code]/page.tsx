import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTemplate, neighbours } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { CATEGORY_LABELS, type Locale } from "@/lib/types";
import { getRequestLocale } from "@/lib/site-request";
import { rootUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = Promise<{ code: string }>;
type Search = Promise<{ lang?: string }>;

async function previewLocale(sp: { lang?: string }): Promise<Locale> {
  if (sp.lang === "en" || sp.lang === "ar") return sp.lang;
  return getRequestLocale("ar");
}

function hasThumb(code: string) {
  return fs.existsSync(path.join(process.cwd(), "public", "templates", `${code}.jpg`));
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { code } = await params;
  const def = getTemplate(code);
  if (!def) return { title: "Template not found" };
  const locale = await previewLocale(await searchParams);
  const title = `${def.code} · ${def.name.ar} · ${def.name.en}`;
  const description = locale === "en" ? def.description.en : def.description.ar;
  const canonical = rootUrl(`/template/${def.code}`);
  const image = hasThumb(def.code) ? rootUrl(`/templates/${def.code}.jpg`) : undefined;
  return {
    title,
    description,
    alternates: { canonical, languages: { ar: `${canonical}?lang=ar`, en: `${canonical}?lang=en`, "x-default": canonical } },
    openGraph: { title, description, type: "website", url: canonical, siteName: "DecoKuwait", images: image ? [image] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function TemplatePreview({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { code } = await params;
  const sp = await searchParams;
  const def = getTemplate(code);
  if (!def) notFound();
  const locale = await previewLocale(sp);
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
