import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { createHash } from "node:crypto";
import { getRequestSite, getRequestLocale, getRequestVisitorCode, clientIp } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getActivePixels } from "@/lib/db/pixels";
import { trackVisit } from "@/lib/db/visitors";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx, effectiveTokens } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { socialLinks } from "@/templates/ui/primitives";
import { SiteRuntime, type BrowserPixel } from "@/components/site/SiteRuntime";
import { VisitorCookie } from "@/components/site/VisitorCookie";
import { resolveEventName } from "@/lib/marketing/mapping";
import { lt } from "@/lib/i18n/site";
import { safeMediaUrl, safeUrl } from "@/lib/safe-url";
import { whatsappDigits } from "@/lib/content/defaults";
import { siteUrl } from "@/lib/config";
import type { Locale, SiteData } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { ComingSoon } from "./ComingSoon";

export const dynamic = "force-dynamic";

/** Canonical URL of the home page in a given language (the default language lives on the bare URL). */
function langUrl(host: string, locale: Locale, defaultLocale: Locale) {
  return locale === defaultLocale ? siteUrl(host) : `${siteUrl(host)}?lang=${locale}`;
}

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const defaultLocale = site.content.settings.defaultLocale;
  const locale = await getRequestLocale(defaultLocale);
  const seo = site.content.seo;
  const brand = site.content.brand;
  const brandName = lt(locale, brand.name) || site.name;
  const title = lt(locale, seo.title) || brandName;
  if (site.status !== "active") return { title, robots: { index: false, follow: false } };
  const description = lt(locale, seo.description) || lt(locale, brand.tagline);
  const icon = safeMediaUrl(brand.faviconUrl) || safeMediaUrl(brand.logoUrl);
  const og = safeMediaUrl(seo.ogImageUrl) || safeMediaUrl(site.content.hero.imageUrl);
  const canonical = langUrl(host, locale, defaultLocale);
  const multilingual = site.content.settings.showLangToggle;
  return {
    title,
    description,
    keywords: seo.keywords || undefined,
    icons: icon ? { icon, apple: icon } : { icon: "/icon" },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: brandName,
      locale: locale === "ar" ? "ar_KW" : "en_US",
      alternateLocale: multilingual ? [locale === "ar" ? "en_US" : "ar_KW"] : undefined,
      images: og ? [og] : [],
    },
    twitter: { card: og ? "summary_large_image" : "summary", title, description, images: og ? [og] : undefined },
    alternates: {
      canonical,
      languages: multilingual
        ? { ar: langUrl(host, "ar", defaultLocale), en: langUrl(host, "en", defaultLocale), "x-default": siteUrl(host) }
        : undefined,
    },
  };
}

/** Browser chrome colour and colour scheme follow the site's theme instead of the platform's. */
export async function generateViewport({ params }: { params: Promise<{ host: string }> }): Promise<Viewport> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { width: "device-width", initialScale: 1 };
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const tokens = effectiveTokens(def, { content: site.content } as SiteData);
  return { width: "device-width", initialScale: 1, themeColor: tokens.bg, colorScheme: tokens.mode };
}

/** schema.org LocalBusiness data so search engines can show phone, hours and address next to the result. */
function structuredData(ctx: RenderCtx, host: string, siteName: string) {
  const { locale } = ctx;
  const data = ctx.site;
  const c = data.content;
  const phone = whatsappDigits(c.contact.phone) || whatsappDigits(c.contact.whatsapp);
  const logo = safeMediaUrl(c.brand.logoUrl);
  const image = safeMediaUrl(c.seo.ogImageUrl) || safeMediaUrl(c.hero.imageUrl);
  const sameAs = socialLinks(ctx).map((s) => safeUrl(s.url)).filter(Boolean);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: lt(locale, c.brand.name) || siteName,
    url: siteUrl(host),
    inLanguage: locale,
    description: lt(locale, c.seo.description) || lt(locale, c.brand.tagline) || undefined,
    telephone: phone ? `+${phone}` : undefined,
    logo: logo || undefined,
    image: image || undefined,
    address: lt(locale, c.contact.address) ? { "@type": "PostalAddress", streetAddress: lt(locale, c.contact.address), addressCountry: "KW" } : undefined,
    openingHours: lt(locale, c.contact.hours) || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    areaServed: { "@type": "Country", name: "Kuwait" },
  };
  return JSON.stringify(ld).replace(/</g, "\\u003c");
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

  const [data, pixels] = await Promise.all([getSiteData(site, { publishedOnly: true }), getActivePixels(site.id)]);
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(ctx, host, site.name) }} />
      <TemplateRenderer ctx={ctx} />
      {fresh && <VisitorCookie code={visitorCode} />}
      <SiteRuntime visitorCode={visitorCode} externalIdHash={externalIdHash} pixels={browserPixels} preview={false} />
    </>
  );
}
