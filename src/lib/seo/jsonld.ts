import { lt } from "@/lib/i18n/site";
import { safeMediaUrl, safeUrl } from "@/lib/safe-url";
import { whatsappDigits } from "@/lib/content/defaults";
import type { Locale, SiteContent } from "@/lib/types";

/** Serialize for a `<script type="application/ld+json">` body: `<` can never start a tag inside it. */
export function ldJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Make a stored media URL absolute. `/api/files/...` is valid in an `<img src>` and useless in JSON-LD. */
export function absolute(url: string, base: string): string {
  const v = safeMediaUrl(url);
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  try {
    return new URL(v, base).toString();
  } catch {
    return "";
  }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Normalize a stored day to a schema.org DayOfWeek name.
 *
 * The stored format is the English day name; three-letter and lowercase forms are accepted so an admin
 * field that ships later cannot silently produce values schema.org does not know.
 */
function dayName(v: string): string | null {
  const s = (v || "").trim().toLowerCase();
  if (!s) return null;
  return DAYS.find((d) => d.toLowerCase() === s || d.toLowerCase().startsWith(s.slice(0, 3))) ?? null;
}

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * `openingHoursSpecification` from the structured hours.
 *
 * The free-text `contact.hours` this replaces ("السبت - الخميس ٩ص - ٧م") is a display string, not data:
 * nothing could parse it, so the old `openingHours` property was a string search engines discarded.
 */
export function openingHours(spec: SiteContent["contact"]["hoursSpec"]): unknown[] | undefined {
  const out = (spec ?? [])
    .map((s) => {
      const days = (s.days ?? []).map(dayName).filter((d): d is string => !!d);
      if (!days.length || !TIME.test(s.opens || "") || !TIME.test(s.closes || "")) return null;
      return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: s.opens, closes: s.closes };
    })
    .filter(Boolean);
  return out.length ? out : undefined;
}

/**
 * `geo` from the stored coordinates.
 *
 * Google asks for at least five decimal places: `29.37` is the middle of Kuwait City and matches a
 * business to nothing. A value that coarse is dropped rather than published as a false precise claim.
 */
export function geoPoint(geo: SiteContent["contact"]["geo"]): unknown | undefined {
  const lat = Number(geo?.lat);
  const lng = Number(geo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  const decimals = (v: string | undefined) => ((v || "").split(".")[1] || "").length;
  if (decimals(geo?.lat) < 5 || decimals(geo?.lng) < 5) return undefined;
  return { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
}

/** PostalAddress from the structured parts, falling back to the free-text line as `streetAddress`. */
export function postalAddress(locale: Locale, contact: SiteContent["contact"]): unknown | undefined {
  const parts = contact.addressParts;
  const street = lt(locale, parts?.street) || lt(locale, contact.address);
  const area = lt(locale, parts?.area);
  const governorate = lt(locale, parts?.governorate);
  if (!street && !area && !governorate) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: street || undefined,
    addressLocality: area || undefined,
    addressRegion: governorate || undefined,
    addressCountry: "KW",
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList, or undefined: Google ignores a trail with fewer than two items, so none is emitted. */
export function breadcrumbList(items: BreadcrumbItem[], id: string): unknown | undefined {
  if (items.length < 2) return undefined;
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export interface TenantGraphInput {
  content: SiteContent;
  locale: Locale;
  /** Absolute URL of the site's primary host, with trailing slash. Never the request host. */
  siteUrl: string;
  /** Absolute canonical URL of the page this graph is emitted on. */
  pageUrl: string;
  siteName: string;
  pageTitle: string;
  description?: string;
  /** Extra images for this page (project photos and the like), most representative first. */
  images?: string[];
  breadcrumb?: BreadcrumbItem[];
}

/**
 * One `@graph` for the page, with `@id` cross-references, instead of a loose LocalBusiness blob.
 *
 * A graph lets the business, the website and the page be stated once and referred to by id, which is how
 * a knowledge-panel entity is actually assembled. Three deliberate omissions:
 *  - **no `AggregateRating` / `Review`.** `testimonials[].rating` exists and is tempting. Google's
 *    review-snippet policy: when the entity being reviewed controls the reviews about itself, pages using
 *    LocalBusiness or an Organization type are ineligible for the star feature — explicitly including
 *    embedded third-party widgets. Emitting it buys a manual action, not stars.
 *  - **no `hasMap`.** Not a documented Google property for LocalBusiness; `sameAs` to the Google Business
 *    Profile is the signal that does work, and it is emitted first.
 *  - **no `Service` nodes here.** `Service` has no rich result; the service pages carry them as an
 *    entity signal on their own URLs, where they describe that page.
 */
export function tenantGraph(input: TenantGraphInput): unknown {
  const { content: c, locale, siteUrl: base, pageUrl } = input;
  const businessId = `${base}#business`;
  const websiteId = `${base}#website`;
  const phone = whatsappDigits(c.contact.phone) || whatsappDigits(c.contact.whatsapp);
  const logo = absolute(c.brand.logoUrl || "", base);
  const images = [
    ...(input.images ?? []),
    c.seo.ogImageUrl || "",
    c.hero.imageUrl || "",
    ...(c.hero.images ?? []),
    c.about.imageUrl || "",
  ]
    .map((u) => absolute(u, base))
    .filter((u, i, arr) => u && arr.indexOf(u) === i)
    .slice(0, 6);
  // The Google Business Profile URL is the strongest entity signal a small local business can give, so it
  // leads `sameAs`; the social profiles corroborate it.
  const sameAs = [safeUrl(c.contact.googleBusinessUrl), ...Object.values(c.socials || {}).map((u) => safeUrl(u))].filter(
    (u, i, arr) => u && arr.indexOf(u) === i,
  );
  const areas = (c.contact.areasServed ?? []).map((a) => lt(locale, a).trim()).filter(Boolean);
  const address = postalAddress(locale, c.contact);

  const business: Record<string, unknown> = {
    "@type": "HomeAndConstructionBusiness",
    "@id": businessId,
    name: lt(locale, c.brand.name) || input.siteName,
    url: base,
    inLanguage: locale,
    description: lt(locale, c.seo.description) || lt(locale, c.brand.tagline) || undefined,
    telephone: phone ? `+${phone}` : undefined,
    email: c.contact.email || undefined,
    logo: logo ? { "@type": "ImageObject", "@id": `${base}#logo`, url: logo } : undefined,
    image: images.length ? images : undefined,
    address,
    geo: geoPoint(c.contact.geo),
    openingHoursSpecification: openingHours(c.contact.hoursSpec),
    // 100 characters is the documented maximum; a longer string invalidates the property.
    priceRange: (c.seo.priceRange || "").trim().slice(0, 100) || undefined,
    // A floor, not a claim: every tenant is in Kuwait, and the configured governorates say where exactly.
    areaServed: areas.length ? areas.map((name) => ({ "@type": "AdministrativeArea", name })) : { "@type": "Country", name: "Kuwait" },
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const website: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": websiteId,
    url: base,
    name: lt(locale, c.brand.name) || input.siteName,
    inLanguage: locale,
    publisher: { "@id": businessId },
  };

  const crumbs = breadcrumbList(input.breadcrumb ?? [], `${pageUrl}#breadcrumb`);
  const page: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: input.pageTitle,
    description: input.description || undefined,
    isPartOf: { "@id": websiteId },
    about: { "@id": businessId },
    inLanguage: locale,
    primaryImageOfPage: images[0] ? { "@type": "ImageObject", url: images[0] } : undefined,
    breadcrumb: crumbs ? { "@id": `${pageUrl}#breadcrumb` } : undefined,
  };

  return { "@context": "https://schema.org", "@graph": [business, website, page, ...(crumbs ? [crumbs] : [])] };
}

/**
 * `Organization` + `WebSite` for the platform itself, which carried no entity markup at all.
 *
 * No `potentialAction: SearchAction`: the sitelinks searchbox was retired, and the markup is inert.
 */
export function platformGraph(input: { url: string; name: string; description: string; logo: string; sameAs?: string[] }): unknown {
  const orgId = `${input.url}#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: input.name,
        url: input.url,
        description: input.description,
        logo: { "@type": "ImageObject", "@id": `${input.url}#logo`, url: input.logo },
        areaServed: { "@type": "Country", name: "Kuwait" },
        sameAs: input.sameAs?.length ? input.sameAs : undefined,
      },
      {
        "@type": "WebSite",
        "@id": `${input.url}#website`,
        url: input.url,
        name: input.name,
        inLanguage: "ar",
        publisher: { "@id": orgId },
      },
    ],
  };
}
