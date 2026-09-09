import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRequestSite, getRequestLocale, getRequestVisitorCode } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getActivePixels } from "@/lib/db/pixels";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { SiteRuntime, type BrowserPixel } from "@/components/site/SiteRuntime";
import { resolveEventName } from "@/lib/marketing/mapping";
import { lt } from "@/lib/i18n/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  const seo = site.content.seo;
  const title = lt(locale, seo.title) || lt(locale, site.content.brand.name) || site.name;
  const description = lt(locale, seo.description) || lt(locale, site.content.brand.tagline);
  return {
    title,
    description,
    keywords: seo.keywords || undefined,
    openGraph: { title, description, images: seo.ogImageUrl ? [seo.ogImageUrl] : site.content.hero.imageUrl ? [site.content.hero.imageUrl] : [] },
    alternates: { languages: { ar: "/", en: "/" } },
  };
}

export default async function TenantSite({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site || site.status !== "active") notFound();
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  const visitorCode = await getRequestVisitorCode();
  const data = await getSiteData(site, { publishedOnly: true });
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
  const pixels = await getActivePixels(site.id);
  const browserPixels: BrowserPixel[] = pixels.map((p) => ({
    platform: p.platform,
    pixelId: p.pixelId,
    adsId: p.extra?.adsId,
    events: {
      page_view: resolveEventName(p, "page_view"),
      whatsapp_click: resolveEventName(p, "whatsapp_click"),
      call_click: resolveEventName(p, "call_click"),
    },
  }));
  return (
    <>
      <TemplateRenderer ctx={ctx} />
      <SiteRuntime visitorCode={visitorCode} pixels={browserPixels} preview={false} />
    </>
  );
}
