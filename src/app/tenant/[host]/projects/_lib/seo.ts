import type { Metadata } from "next";
import type { Locale, SiteRecord } from "@/lib/types";
import { lt } from "@/lib/i18n/site";
import { safeMediaUrl } from "@/lib/safe-url";
import { absolute } from "@/lib/seo/jsonld";
import { langPath, publishedLocales } from "@/lib/seo/locale";
import { primaryUrl, type PrimaryHost } from "@/lib/seo/primary-host";

/**
 * Page-level SEO for `/projects` and `/services`.
 *
 * Everything reusable (the `@graph`, breadcrumbs, the primary-host resolver, hreflang) lives in
 * `src/lib/seo/**`; this file only holds what is specific to these two page types.
 */

/**
 * ImageObject nodes for a page's photographs.
 *
 * For a trade whose entire commercial asset is its photographs this is the highest-value structured data
 * available: it is what puts a project photo in Google Images with the business attached to it. Each node
 * points back at the page through `mainEntityOfPage`, so the photos and the page are one entity rather
 * than a floating list of files.
 *
 * `representativeOfPage` is set on the first image only — that is its meaning, and setting it on all of
 * them says nothing.
 */
export function imageObjects(input: {
  images: { url: string; alt: string; caption?: string }[];
  pageUrl: string;
  base: string;
  credit: string;
}): unknown | null {
  const nodes = input.images
    .map((img) => ({ ...img, url: absolute(img.url, input.base) }))
    .filter((img) => img.url)
    .filter((img, i, arr) => arr.findIndex((o) => o.url === img.url) === i)
    .slice(0, 25)
    .map((img, i) => ({
      "@type": "ImageObject",
      contentUrl: img.url,
      url: img.url,
      name: img.alt,
      caption: img.caption || img.alt,
      representativeOfPage: i === 0 ? true : undefined,
      creditText: input.credit || undefined,
      mainEntityOfPage: { "@id": `${input.pageUrl}#webpage` },
    }));
  if (!nodes.length) return null;
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * `Service` structured data for a service page.
 *
 * Verified: **`Service` has no Google rich result.** It is an entity signal only — it tells a search
 * engine what this URL is about and ties it to the business — so it stays deliberately small. No
 * `offers` with invented prices, no `aggregateRating`: fabricated commercial data is what earns a manual
 * action, and there is nothing to gain here that would justify the risk.
 */
export function serviceLd(input: {
  name: string;
  description: string;
  pageUrl: string;
  base: string;
  areaServed: string[];
  image?: string;
}): unknown {
  const image = input.image ? absolute(input.image, input.base) : "";
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${input.pageUrl}#service`,
    name: input.name,
    description: input.description || undefined,
    url: input.pageUrl,
    image: image || undefined,
    provider: { "@id": `${input.base}#business` },
    areaServed: input.areaServed.length
      ? input.areaServed.map((name) => ({ "@type": "AdministrativeArea", name }))
      : { "@type": "Country", name: "Kuwait" },
    mainEntityOfPage: { "@id": `${input.pageUrl}#webpage` },
  };
}

/**
 * Metadata shared by every inner page: canonical on the PRIMARY host, hreflang only for the languages
 * the site actually publishes, and Open Graph/Twitter cards built from the same strings.
 *
 * `index: false` is passed for a thin page (an empty portfolio) and is forced for a demo site and for a
 * language this site has not really written — a showcase and a half-translated page must not compete in
 * the index with the tenants that paid for it.
 */
export function tenantPageMetadata(input: {
  site: SiteRecord;
  locale: Locale;
  primary: PrimaryHost;
  /** Root-relative path with no query, e.g. `/projects/villa-salmiya`. */
  path: string;
  title: string;
  description?: string;
  image?: string | null;
  index?: boolean;
}): Metadata {
  const { site, locale, primary, path } = input;
  const c = site.content;
  const defaultLocale = c.settings.defaultLocale;
  const base = primaryUrl(primary);
  const brandName = lt(locale, c.brand.name) || site.name;
  const locales = publishedLocales(c);
  const multilingual = locales.length > 1;
  const canonical = primaryUrl(primary, langPath(path, locale, defaultLocale));
  const icon = safeMediaUrl(c.brand.faviconUrl) || safeMediaUrl(c.brand.logoUrl);
  const og = safeMediaUrl(input.image) || safeMediaUrl(c.seo.ogImageUrl) || safeMediaUrl(c.hero.imageUrl);
  const indexable = input.index !== false && !c.settings.demo && locales.includes(locale);
  return {
    // Absolute base for every relative URL below: an `/api/files/...` image is meaningless to a crawler.
    metadataBase: new URL(base),
    title: input.title,
    description: input.description || undefined,
    icons: icon ? { icon, apple: icon } : { icon: "/icon" },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: input.title,
      description: input.description || undefined,
      type: "article",
      url: canonical,
      siteName: brandName,
      locale: locale === "ar" ? "ar_KW" : "en_US",
      alternateLocale: multilingual ? [locale === "ar" ? "en_US" : "ar_KW"] : undefined,
      images: og ? [og] : [],
    },
    twitter: { card: og ? "summary_large_image" : "summary", title: input.title, description: input.description || undefined, images: og ? [og] : undefined },
    alternates: {
      canonical,
      languages: multilingual
        ? { ...Object.fromEntries(locales.map((l) => [l, primaryUrl(primary, langPath(path, l, defaultLocale))])), "x-default": primaryUrl(primary, path) }
        : undefined,
    },
  };
}
