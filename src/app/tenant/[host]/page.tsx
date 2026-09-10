import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { getRequestSite, getRequestLocale, getRequestVisitorCode, clientIp } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getActivePixels } from "@/lib/db/pixels";
import { trackVisit } from "@/lib/db/visitors";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { SiteRuntime, type BrowserPixel } from "@/components/site/SiteRuntime";
import { VisitorCookie } from "@/components/site/VisitorCookie";
import { resolveEventName } from "@/lib/marketing/mapping";
import { lt } from "@/lib/i18n/site";
import { safeMediaUrl } from "@/lib/safe-url";
import { siteUrl } from "@/lib/config";
import { ComingSoon } from "./ComingSoon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  const seo = site.content.seo;
  const brand = site.content.brand;
  const title = lt(locale, seo.title) || lt(locale, brand.name) || site.name;
  const description = lt(locale, seo.description) || lt(locale, brand.tagline);
  const icon = safeMediaUrl(brand.faviconUrl) || safeMediaUrl(brand.logoUrl);
  const og = safeMediaUrl(seo.ogImageUrl) || safeMediaUrl(site.content.hero.imageUrl);
  return {
    title,
    description,
    keywords: seo.keywords || undefined,
    icons: icon ? { icon, apple: icon } : undefined,
    openGraph: { title, description, type: "website", locale: locale === "ar" ? "ar_KW" : "en_US", images: og ? [og] : [] },
    twitter: { card: og ? "summary_large_image" : "summary", title, description, images: og ? [og] : undefined },
    alternates: { canonical: siteUrl(host) },
  };
}

export default async function TenantSite({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) notFound();
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  if (site.status !== "active") return <ComingSoon site={site} locale={locale} />;

  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  let visitorCode = await getRequestVisitorCode();
  const h = await headers();

  // First visit: create the visitor row synchronously (one insert), so the id printed inside the WhatsApp
  // message always exists in the database. If the proxy's provisional id collided with another visitor,
  // a new id is allocated here and the page (links + cookie) uses that one.
  const fresh = !!visitorCode && h.get("x-dk-vid-new") === "1";
  if (visitorCode && fresh) {
    try {
      const r = await trackVisit({
        siteId: site.id,
        code: visitorCode,
        fresh: true,
        landingUrl: siteUrl(host) + (h.get("x-dk-path") || "").replace(/^\//, ""),
        referrer: h.get("referer"),
        userAgent: h.get("user-agent"),
        ip: clientIp(h),
      });
      visitorCode = r.visitor.code;
    } catch (err) {
      console.error("server-side visit tracking failed", err);
    }
  }

  const data = await getSiteData(site, { publishedOnly: true });
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
  const pixels = await getActivePixels(site.id);
  const browserPixels: BrowserPixel[] = pixels.map((p) => ({
    platform: p.platform,
    pixelId: p.pixelId,
    adsId: p.extra?.adsId,
    adsLabel: p.extra?.adsLabel,
    events: {
      page_view: resolveEventName(p, "page_view"),
      whatsapp_click: resolveEventName(p, "whatsapp_click"),
      call_click: resolveEventName(p, "call_click"),
    },
  }));
  const externalIdHash = visitorCode ? createHash("sha256").update(visitorCode).digest("hex") : null;
  return (
    <>
      <TemplateRenderer ctx={ctx} />
      {fresh && <VisitorCookie code={visitorCode} />}
      <SiteRuntime visitorCode={visitorCode} externalIdHash={externalIdHash} pixels={browserPixels} preview={false} />
    </>
  );
}
