import { describe, expect, it } from "vitest";
import { primaryRedirectTarget, primaryUrl, resolvePrimaryHost, type DomainLike } from "@/lib/seo/primary-host";
import { englishIsPublished, isEnglishText, langPath, publishedLocales } from "@/lib/seo/locale";
import { robotsLines } from "@/lib/seo/robots";
import { pageCount, platformUrls, renderSitemapIndex, renderUrlset, tenantUrls } from "@/lib/seo/sitemap";
import { breadcrumbList, geoPoint, openingHours, postalAddress, tenantGraph } from "@/lib/seo/jsonld";
import { findServiceBySlug, serviceSlugs } from "@/lib/seo/service-slugs";
import { tenantTitle } from "@/lib/seo/titles";
import { isIndexableRootHost, platformRedirectTarget } from "@/lib/tenant";
import { emptyContent } from "@/lib/content/defaults";
import { CATEGORIES } from "@/lib/types";
import type { SiteContent } from "@/lib/types";

const ROOT = "decokuwait.com";

function domains(...rows: Partial<DomainLike>[]): DomainLike[] {
  return rows.map((r) => ({ hostname: "", kind: "custom", isPrimary: false, verified: false, ...r }));
}

describe("primary host", () => {
  it("prefers a verified custom domain over the subdomain, and enforces it", () => {
    const p = resolvePrimaryHost(
      domains(
        { hostname: "alfaisal.decokuwait.com", kind: "subdomain", isPrimary: true, verified: true },
        { hostname: "alfaisal-decor.com", kind: "custom", isPrimary: true, verified: true },
      ),
      { slug: "alfaisal", rootDomain: ROOT },
    );
    expect(p).toEqual({ host: "alfaisal-decor.com", source: "verified-custom", enforce: true });
    // The bug this exists for: both hosts served identical bytes and each declared ITSELF canonical.
    expect(primaryUrl(p)).toBe("https://alfaisal-decor.com/");
    expect(primaryRedirectTarget("alfaisal.decokuwait.com", p)).toBe("alfaisal-decor.com");
    expect(primaryRedirectTarget("alfaisal-decor.com", p)).toBeNull();
  });

  it("does not bounce anything while the custom domain is still unverified", () => {
    const p = resolvePrimaryHost(
      domains(
        { hostname: "alfaisal.decokuwait.com", kind: "subdomain", isPrimary: true, verified: true },
        { hostname: "alfaisal-decor.com", kind: "custom", isPrimary: true, verified: false },
      ),
      { slug: "alfaisal", rootDomain: ROOT },
    );
    expect(p.host).toBe("alfaisal.decokuwait.com");
    expect(p.enforce).toBe(false);
    expect(primaryRedirectTarget("alfaisal-decor.com", p)).toBeNull();
  });

  it("folds www into the apex even when the primary is the subdomain", () => {
    const p = resolvePrimaryHost(domains({ hostname: "elite.decokuwait.com", kind: "subdomain", verified: true }), {
      slug: "elite",
      rootDomain: ROOT,
    });
    expect(primaryRedirectTarget("www.elite.decokuwait.com", p)).toBe("elite.decokuwait.com");
    expect(primaryRedirectTarget("elite.decokuwait.com:443", p)).toBeNull();
  });

  it("falls back to the slug subdomain when no domain row exists", () => {
    expect(resolvePrimaryHost([], { slug: "newsite", rootDomain: ROOT })).toEqual({
      host: "newsite.decokuwait.com",
      source: "slug",
      enforce: false,
    });
  });
});

function withEnglish(patch: (c: SiteContent) => void): SiteContent {
  const c = emptyContent();
  c.settings.showLangToggle = true;
  c.hero.title = { ar: "ديكورات جبس", en: "Gypsum ceilings that finish on time" };
  c.about.body = { ar: "نبذة", en: "We have fitted gypsum ceilings in Kuwait since 2009." };
  c.seo.title = { ar: "جبس", en: "Gypsum board decor in Kuwait" };
  c.services.items = [{ id: "s1", title: { ar: "أسقف", en: "Suspended ceilings" }, description: { ar: "", en: "" } }];
  patch(c);
  return c;
}

describe("english variant gating", () => {
  it("rejects an empty or Arabic-filled english field", () => {
    expect(isEnglishText("Suspended ceilings")).toBe(true);
    expect(isEnglishText("")).toBe(false);
    expect(isEnglishText("   ")).toBe(false);
    // The exact failure this gate exists for: the Arabic copy pasted into the English box.
    expect(isEnglishText("ديكورات جبس بورد")).toBe(false);
    expect(isEnglishText("Kuwait — الكويت")).toBe(false);
  });

  it("publishes english only when hero, about, services and SEO are all written", () => {
    expect(englishIsPublished(withEnglish(() => {}))).toBe(true);
    expect(englishIsPublished(withEnglish((c) => (c.hero.title.en = "")))).toBe(false);
    expect(englishIsPublished(withEnglish((c) => (c.about.body.en = "")))).toBe(false);
    expect(englishIsPublished(withEnglish((c) => (c.services.items[0].title.en = "")))).toBe(false);
    expect(englishIsPublished(withEnglish((c) => ((c.seo.title.en = ""), (c.seo.description.en = ""))))).toBe(false);
    // The default: the toggle is off, so there is no english variant at all.
    expect(englishIsPublished(emptyContent())).toBe(false);
  });

  it("gates the hreflang cluster and the sitemap on the same rule", () => {
    expect(publishedLocales(emptyContent())).toEqual(["ar"]);
    expect(publishedLocales(withEnglish(() => {}))).toEqual(["ar", "en"]);
  });

  it("keeps the default language on the bare URL", () => {
    expect(langPath("/", "ar", "ar")).toBe("/");
    expect(langPath("/", "en", "ar")).toBe("/?lang=en");
    expect(langPath("/projects/villa", "en", "ar")).toBe("/projects/villa?lang=en");
  });
});

describe("robots.txt", () => {
  it("lets a crawler into a paused site so the page's noindex is readable", () => {
    const lines = robotsLines({ kind: "tenant-paused" });
    expect(lines).toContain("Allow: /");
    expect(lines).not.toContain("Disallow: /");
    expect(lines).toContain("Disallow: /admin");
  });

  it("closes deployment URLs and unknown hosts", () => {
    expect(robotsLines({ kind: "platform-blocked" })).toEqual(["User-agent: *", "Disallow: /"]);
    expect(robotsLines({ kind: "unknown" })).toEqual(["User-agent: *", "Disallow: /"]);
  });

  it("points a tenant at its own sitemap and hides the admin panel", () => {
    const lines = robotsLines({ kind: "tenant", sitemap: "https://gulfalu.com/sitemap.xml" });
    expect(lines).toContain("Disallow: /admin");
    expect(lines).toContain("Sitemap: https://gulfalu.com/sitemap.xml");
  });
});

describe("host classification", () => {
  it("treats only the root domain as indexable", () => {
    expect(isIndexableRootHost("decokuwait.com", ROOT)).toBe(true);
    expect(isIndexableRootHost("www.decokuwait.com", ROOT)).toBe(true);
    // The whole platform was served, and Allow: /, on every preview deployment.
    expect(isIndexableRootHost("decokuwait-git-main-x.vercel.app", ROOT)).toBe(false);
    expect(isIndexableRootHost("127.0.0.1", ROOT)).toBe(false);
  });

  it("names the 308 target for www on the platform and on a tenant subdomain", () => {
    expect(platformRedirectTarget("www.decokuwait.com", ROOT)).toBe("decokuwait.com");
    expect(platformRedirectTarget("www.elite.decokuwait.com", ROOT)).toBe("elite.decokuwait.com");
    expect(platformRedirectTarget("decokuwait.com", ROOT)).toBeNull();
    expect(platformRedirectTarget("www.someone-else.com", ROOT)).toBeNull();
  });
});

describe("sitemap", () => {
  const base = "https://gulfalu.com/";

  it("lists one URL per page when only one language is published, with no hreflang", () => {
    const urls = tenantUrls({ base, locales: ["ar"], defaultLocale: "ar", lastmod: "2026-02-03T10:00:00.000Z" });
    expect(urls).toEqual([{ loc: base, lastmod: "2026-02-03T10:00:00.000Z", priority: "1.0", alternates: undefined }]);
    const xml = renderUrlset(urls);
    expect(xml).toContain("<lastmod>2026-02-03</lastmod>");
    expect(xml).not.toContain("hreflang");
    expect(xml).not.toContain("?lang=en");
    // /privacy is noindex; submitting it was a contradiction.
    expect(xml).not.toContain("privacy");
  });

  it("emits a reciprocal, self-consistent cluster when english is published", () => {
    const xml = renderUrlset(tenantUrls({ base, locales: ["ar", "en"], defaultLocale: "ar", lastmod: "2026-02-03" }));
    expect(xml).toContain('hreflang="ar" href="https://gulfalu.com/"');
    expect(xml).toContain('hreflang="en" href="https://gulfalu.com/?lang=en"');
    expect(xml).toContain('hreflang="x-default" href="https://gulfalu.com/"');
    expect((xml.match(/<url>/g) ?? []).length).toBe(2);
  });

  it("includes project and service URLs on the primary host", () => {
    const urls = tenantUrls({
      base,
      locales: ["ar"],
      defaultLocale: "ar",
      lastmod: "2026-02-03",
      projects: [{ slug: "villa-salwa", lastmod: "2026-05-01" }],
      services: [{ slug: "suspended-ceilings" }],
    });
    const locs = urls.map((u) => u.loc);
    expect(locs).toContain("https://gulfalu.com/projects");
    expect(locs).toContain("https://gulfalu.com/projects/villa-salwa");
    expect(locs).toContain("https://gulfalu.com/services/suspended-ceilings");
    expect(urls.find((u) => u.loc.endsWith("villa-salwa"))?.lastmod).toBe("2026-05-01");
  });

  it("keeps the platform gallery and drops all sixty previews", () => {
    const urls = platformUrls({ rootUrl: (p) => `https://decokuwait.com${p}`, categories: CATEGORIES, lastmod: "2026-02-03" });
    expect(urls.map((u) => u.loc)).toEqual([
      "https://decokuwait.com/",
      "https://decokuwait.com/templates",
      ...CATEGORIES.map((c) => `https://decokuwait.com/templates/${c}`),
    ]);
    expect(urls.every((u) => u.lastmod === "2026-02-03")).toBe(true);
    expect(renderUrlset(urls)).not.toContain("/template/");
  });

  it("splits into a sitemap index once a tenant outgrows one page", () => {
    expect(pageCount(1)).toBe(1);
    expect(pageCount(501)).toBe(2);
    const xml = renderSitemapIndex([{ loc: `${base}sitemap.xml?page=1`, lastmod: "2026-02-03" }]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("sitemap.xml?page=1");
  });
});

describe("structured data", () => {
  it("drops coordinates too coarse to identify a place", () => {
    expect(geoPoint({ lat: "29.37", lng: "47.97" })).toBeUndefined();
    expect(geoPoint({ lat: "29.375920", lng: "47.977380" })).toEqual({ "@type": "GeoCoordinates", latitude: 29.37592, longitude: 47.97738 });
    expect(geoPoint(undefined)).toBeUndefined();
  });

  it("turns structured hours into openingHoursSpecification and rejects junk", () => {
    expect(openingHours([{ days: ["saturday", "Thursday"], opens: "09:00", closes: "19:00" }])).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday", "Thursday"], opens: "09:00", closes: "19:00" },
    ]);
    expect(openingHours([{ days: ["Funday"], opens: "09:00", closes: "19:00" }])).toBeUndefined();
    expect(openingHours([{ days: ["Monday"], opens: "9am", closes: "7pm" }])).toBeUndefined();
  });

  it("builds a PostalAddress from the parts, or from the free-text line", () => {
    expect(postalAddress("ar", { ...emptyContent().contact, address: { ar: "شارع ١، السالمية", en: "" } })).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: "شارع ١، السالمية",
      addressCountry: "KW",
    });
    expect(postalAddress("ar", emptyContent().contact)).toBeUndefined();
  });

  it("omits a breadcrumb with fewer than two items", () => {
    expect(breadcrumbList([{ name: "الرئيسية", url: "/" }], "#b")).toBeUndefined();
    expect(breadcrumbList([{ name: "الرئيسية", url: "/" }, { name: "أعمالنا", url: "/projects" }], "#b")).toMatchObject({
      "@type": "BreadcrumbList",
    });
  });

  it("emits one cross-referenced graph and never a self-served rating", () => {
    const c = emptyContent();
    c.brand.name = { ar: "الفيصل", en: "Al Faisal" };
    c.contact.googleBusinessUrl = "https://maps.google.com/?cid=123";
    c.contact.areasServed = [{ ar: "حولي", en: "Hawalli" }];
    c.seo.priceRange = "KD 15 - KD 40";
    c.testimonials.items = [{ id: "t1", name: { ar: "أحمد", en: "Ahmed" }, text: { ar: "ممتاز", en: "Great" }, rating: 5 }];
    const graph = tenantGraph({
      content: c,
      locale: "ar",
      siteUrl: "https://gulfalu.com/",
      pageUrl: "https://gulfalu.com/",
      siteName: "Gulf Alu",
      pageTitle: "الفيصل",
    }) as { "@graph": Record<string, unknown>[] };
    const types = graph["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["HomeAndConstructionBusiness", "WebSite", "WebPage"]);
    const business = graph["@graph"][0];
    expect(business["@id"]).toBe("https://gulfalu.com/#business");
    // The Google Business Profile leads sameAs: the strongest entity signal available here.
    expect(business.sameAs).toEqual(["https://maps.google.com/?cid=123"]);
    expect(business.areaServed).toEqual([{ "@type": "AdministrativeArea", name: "حولي" }]);
    expect(business.priceRange).toBe("KD 15 - KD 40");
    expect(graph["@graph"][2].about).toEqual({ "@id": "https://gulfalu.com/#business" });
    // Reviews the business controls make a LocalBusiness page ineligible for the star feature outright.
    const json = JSON.stringify(graph);
    expect(json).not.toContain("AggregateRating");
    expect(json).not.toContain('"Review"');
    expect(json).not.toContain("hasMap");
  });
});

describe("service slugs", () => {
  it("derives a stable slug per service and survives collisions", () => {
    const items = [
      { id: "svc-1", title: { ar: "أسقف", en: "Suspended Ceilings" }, description: { ar: "", en: "" } },
      { id: "svc-2", title: { ar: "أسقف", en: "Suspended Ceilings" }, description: { ar: "", en: "" } },
      { id: "svc-3", title: { ar: "كرانيش", en: "" }, description: { ar: "", en: "" } },
    ];
    expect(serviceSlugs(items)).toEqual(["suspended-ceilings", "suspended-ceilings-2", "svc-3"]);
    expect(findServiceBySlug(items, "suspended-ceilings-2")?.id).toBe("svc-2");
    expect(findServiceBySlug(items, "nope")).toBeNull();
  });
});

describe("template previews", () => {
  it("is noindex, follow with no hreflang cluster", async () => {
    const { generateMetadata } = await import("@/app/(platform)/template/[code]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ code: "101" }), searchParams: Promise.resolve({}) });
    // Sixty pages of the same demo Arabic body text on the money domain.
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toContain("/template/101");
    // The cluster pointed hreflang at ?lang= URLs that canonicalise elsewhere, so Google discarded it whole.
    expect(meta.alternates?.languages).toBeUndefined();
    // A code and two design names carried no search intent.
    expect(String(meta.title)).not.toMatch(/^101 · /);
  });
});

describe("metadata quality", () => {
  it("gives a brand-new tenant a title carrying the trade and the city", () => {
    const c = emptyContent();
    c.brand.name = { ar: "الفيصل للديكور", en: "Al Faisal Decor" };
    expect(tenantTitle("ar", c, "gypsum", "Al Faisal")).toBe("الفيصل للديكور | ديكور جبس بورد في الكويت");
    expect(tenantTitle("en", c, "ceramic", "Al Faisal")).toBe("Al Faisal Decor | Ceramic & Porcelain Tiling in Kuwait");
  });

  it("never overwrites a title the owner wrote", () => {
    const c = emptyContent();
    c.seo.title = { ar: "الفيصل — أسقف جبسية بالسالمية", en: "" };
    expect(tenantTitle("ar", c, "gypsum", "Al Faisal")).toBe("الفيصل — أسقف جبسية بالسالمية");
  });
});
