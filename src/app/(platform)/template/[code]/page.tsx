import Link from "next/link";
import type { CSSProperties } from "react";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTemplate, neighbours } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { CATEGORY_LABELS, type Locale } from "@/lib/types";
import { APP_NAME, rootUrl } from "@/lib/config";

// The gallery thumbnails are fixed files in public/; checking the directory once per process beats a
// synchronous existsSync on every request (a crawler walking all 60 previews paid 60 of them).
const THUMBS = new Set(
  fs.existsSync(path.join(process.cwd(), "public", "templates"))
    ? fs.readdirSync(path.join(process.cwd(), "public", "templates")).filter((f) => f.endsWith(".jpg")).map((f) => f.replace(/.jpg$/, ""))
    : [],
);

type Params = Promise<{ code: string }>;
type Search = Promise<{ lang?: string }>;

/**
 * Language of a preview comes from the URL alone.
 *
 * It used to fall back to the visitor's `dk_lang` cookie, which made the page vary per visitor for no
 * benefit: the preview toolbar always links with an explicit `?lang=`, and the canonical URL in the
 * metadata is the bare one. Depending only on the URL means the same code and language always produce
 * the same bytes, which is what makes the response cacheable at the edge.
 */
function previewLocale(sp: { lang?: string }): Locale {
  return sp.lang === "en" ? "en" : "ar";
}

function hasThumb(code: string) {
  return THUMBS.has(code);
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { code } = await params;
  const def = getTemplate(code);
  if (!def) return { title: "Template not found" };
  const locale = previewLocale(await searchParams);
  const title = `${def.name.ar} — قالب ${CATEGORY_LABELS[def.category].ar} رقم ${def.code}`;
  const description = locale === "en" ? def.description.en : def.description.ar;
  const canonical = rootUrl(`/template/${def.code}`);
  const image = hasThumb(def.code) ? rootUrl(`/templates/${def.code}.jpg`) : undefined;
  return {
    title,
    description,
    /**
     * `noindex, follow`.
     *
     * Every one of the fifteen gypsum previews renders the *same* demo Arabic body text, so to a search
     * engine this is one page published sixty times on the money domain — and the old `<title>`,
     * `101 · الديرة · Al Deera`, was a code and two design names with no search intent behind either.
     * `follow` is kept deliberately: the links out of a preview should still carry weight to `/templates`
     * and the four category pages, which are the pages that are meant to rank.
     */
    robots: { index: false, follow: true },
    /**
     * No `alternates.languages` any more. It pointed hreflang at `?lang=ar` / `?lang=en` URLs that
     * canonicalise to this bare one; Google requires an hreflang cluster to be reciprocal and
     * self-consistent and discards one that is not — wholesale, taking the valid annotations with it.
     */
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical, siteName: APP_NAME, images: image ? [image] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function TemplatePreview({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { code } = await params;
  const sp = await searchParams;
  const def = getTemplate(code);
  if (!def) notFound();
  const locale = previewLocale(sp);
  const site = previewSiteData(def);
  const ctx = buildCtx({ site, def, locale, visitorCode: "123456", preview: true });
  const { prev, next } = neighbours(def.code);
  const other = locale === "ar" ? "en" : "ar";
  return (
    <div>
      <div className="sticky top-0 z-[60] flex h-11 items-center justify-between gap-3 bg-[#0b1220] px-4 text-xs text-white sm:text-sm" dir="rtl">
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
      {/* The toolbar above owns the top of the viewport, so the template's own sticky nav rests below it. */}
      <div style={{ "--dk-chrome-top": "2.75rem" } as CSSProperties}>
        <TemplateRenderer ctx={ctx} />
      </div>
    </div>
  );
}
