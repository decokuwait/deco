import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { createHash } from "node:crypto";
import { getRequestSite, getRequestVisitorCode, clientIp } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getActivePixels } from "@/lib/db/pixels";
import { trackVisit } from "@/lib/db/visitors";
import { VISITOR_SECRET_HEADER } from "@/lib/auth/visitor-secret";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx, effectiveTokens } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { SiteRuntime, type BrowserPixel } from "@/components/site/SiteRuntime";
import { VisitorCookie } from "@/components/site/VisitorCookie";
import { resolveEventName } from "@/lib/marketing/mapping";
import { lt } from "@/lib/i18n/site";
import { safeMediaUrl } from "@/lib/safe-url";
import { siteUrl } from "@/lib/config";
import { enforcePrimaryHost, getSitePrimaryHost, primaryUrl, type PrimaryHost } from "@/lib/seo/primary-host";
import { langPath, publishedLocales, urlLocale } from "@/lib/seo/locale";
import { ldJson, tenantGraph } from "@/lib/seo/jsonld";
import { tenantDescription, tenantTitle } from "@/lib/seo/titles";
import type { Locale, SiteData, SiteRecord } from "@/lib/types";
import { ComingSoon } from "./ComingSoon";

export const dynamic = "force-dynamic";

/** Canonical URL of the home page in a given language, always on the site's PRIMARY host. */
function langUrl(primary: PrimaryHost, locale: Locale, defaultLocale: Locale) {
  return primaryUrl(primary, langPath("/", locale, defaultLocale));
}

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const c = site.content;
  const defaultLocale = c.settings.defaultLocale;
  const locale = await urlLocale(defaultLocale);
  const primary = await getSitePrimaryHost(site);
  const base = primaryUrl(primary);
  const title = tenantTitle(locale, c, site.category, site.name);
  const brandName = lt(locale, c.brand.name) || site.name;
  if (site.status !== "active") return { title, metadataBase: new URL(base), robots: { index: false, follow: false } };

  const description = tenantDescription(locale, c, site.category);
  const icon = safeMediaUrl(c.brand.faviconUrl) || safeMediaUrl(c.brand.logoUrl);
  const og = safeMediaUrl(c.seo.ogImageUrl) || safeMediaUrl(c.hero.imageUrl);
  const canonical = langUrl(primary, locale, defaultLocale);
  // The second language is published only when it is actually written; otherwise this URL is the default
  // language's content wearing the wrong `lang` attribute, and must not be indexed or annotated.
  const locales = publishedLocales(c);
  const multilingual = locales.length > 1;
  const indexable = locales.includes(locale);
  const verification = c.seo.verification;
  return {
    // Absolute base for every relative URL below: an `/api/files/...` image is meaningless to a crawler.
    metadataBase: new URL(base),
    title,
    description,
    // `keywords` is not emitted: Google has ignored the meta tag since 2009 and it leaks the target terms
    // to competitors for nothing. The stored field is left alone.
    icons: icon ? { icon, apple: icon } : { icon: "/icon" },
    robots: indexable ? undefined : { index: false, follow: true },
    verification: { google: verification?.google || undefined, other: verification?.bing ? { "msvalidate.01": verification.bing } : undefined },
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
      // hreflang is emitted only for a cluster whose every member is real and reciprocal; a cluster
      // Google cannot make self-consistent is discarded whole, taking the good annotations with it.
      languages: multilingual
        ? { ...Object.fromEntries(locales.map((l) => [l, langUrl(primary, l, defaultLocale)])), "x-default": base }
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

/** The whole page as one schema.org `@graph`: business, website and page, cross-referenced by `@id`. */
function structuredData(site: SiteRecord, locale: Locale, primary: PrimaryHost, canonical: string) {
  const base = primaryUrl(primary);
  return ldJson(
    tenantGraph({
      content: site.content,
      locale,
      siteUrl: base,
      pageUrl: canonical,
      siteName: site.name,
      pageTitle: tenantTitle(locale, site.content, site.category, site.name),
      description: tenantDescription(locale, site.content, site.category),
    }),
  );
}

export default async function TenantSite({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) notFound();
  const primary = await getSitePrimaryHost(site);
  const h = await headers();
  // Before anything streams: once the body starts the HTTP status is fixed, and a duplicate host would
  // get a 200 carrying a canonical hint instead of the 308 that actually collapses the two copies.
  enforcePrimaryHost(primary, host, h.get("x-dk-path") || "/");
  const defaultLocale = site.content.settings.defaultLocale;
  const locale = await urlLocale(defaultLocale);
  if (site.status !== "active") return <ComingSoon site={site} locale={locale} />;

  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  let visitorCode = await getRequestVisitorCode();

  // First visit: create the visitor row before rendering (one insert), so the id printed inside the WhatsApp
  // message always exists in the database. If the proxy's provisional id collided with another visitor,
  // a new id is allocated here and the page (links + cookie) uses that one. It runs alongside the content
  // queries: every awaited round trip here is time the visitor spends on a blank screen.
  const fresh = !!visitorCode && h.get("x-dk-vid-new") === "1";
  const visit =
    visitorCode && fresh
      ? trackVisit({
          siteId: site.id,
          code: visitorCode,
          // The proxy minted the code and its HttpOnly secret together and has already put the secret in
          // the visitor's cookie, so the row this call creates must be given that same value. Without it
          // the row and the cookie disagree, the browser's first /api/track fails its own check, and the
          // endpoint answers by creating a SECOND visitor row — every first visit counted twice.
          secret: h.get(VISITOR_SECRET_HEADER),
          fresh: true,
          landingUrl: siteUrl(host) + (h.get("x-dk-path") || "").replace(/^\//, ""),
          referrer: h.get("referer"),
          userAgent: h.get("user-agent"),
          ip: clientIp(h),
        }).then(
          (r) => r.visitor.code,
          (err: unknown) => {
            console.error("server-side visit tracking failed", err);
            return visitorCode;
          },
        )
      : Promise.resolve(visitorCode);

  const [data, pixels, trackedCode] = await Promise.all([getSiteData(site, { publishedOnly: true }), getActivePixels(site.id), visit]);
  visitorCode = trackedCode;
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData(site, locale, primary, langUrl(primary, locale, defaultLocale)) }}
      />
      <TemplateRenderer ctx={ctx} />
      {fresh && <VisitorCookie code={visitorCode} />}
      {/* consentMode and locale are not optional decoration: without them SiteRuntime falls back to its
          own defaults and the owner's consent setting has no effect on the page at all. */}
      <SiteRuntime
        visitorCode={visitorCode}
        externalIdHash={externalIdHash}
        pixels={browserPixels}
        preview={false}
        consentMode={site.content.settings.consentMode}
        locale={locale}
      />
    </>
  );
}
