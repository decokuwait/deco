import type { Locale } from "@/lib/types";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  priority?: string;
  alternates?: { lang: string; href: string }[];
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function day(v: string | undefined) {
  return v ? v.slice(0, 10) : undefined;
}

export function renderUrlset(urls: SitemapEntry[]): string {
  const body = urls
    .map((u) => {
      const alts = (u.alternates ?? []).map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}"/>`).join("");
      const lastmod = day(u.lastmod);
      return `  <url><loc>${esc(u.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}${alts}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export function renderSitemapIndex(maps: SitemapIndexEntry[]): string {
  const body = maps
    .map((m) => {
      const lastmod = day(m.lastmod);
      return `  <sitemap><loc>${esc(m.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/**
 * Sitemaps are capped at 50,000 URLs / 50MB by the protocol. A tenant reaches neither, but once project
 * and service pages exist the number stops being "one", so the split point is decided here rather than
 * discovered in Search Console. A page this small also keeps `lastmod` meaningful: a crawler refetching
 * a 500-URL page to learn one project changed is cheap.
 */
export const SITEMAP_PAGE_SIZE = 500;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

export function pageSlice<T>(all: T[], page: number): T[] {
  const start = (Math.max(1, page) - 1) * SITEMAP_PAGE_SIZE;
  return all.slice(start, start + SITEMAP_PAGE_SIZE);
}

export interface TenantUrlInput {
  /** Absolute base URL on the site's PRIMARY host, with a trailing slash. */
  base: string;
  locales: Locale[];
  defaultLocale: Locale;
  lastmod: string;
  /** Project slugs, if the project pages are live. */
  projects?: { slug: string; lastmod?: string }[];
  /** Service slugs, if the service pages are live. */
  services?: { slug: string; lastmod?: string }[];
}

/**
 * Every indexable URL of a tenant site.
 *
 * Two things are deliberately absent. `/privacy` is `noindex` — submitting a page you have told Google
 * not to index is a contradiction Search Console reports back as an error, for no gain. And the second
 * language is only listed when `locales` says it is genuinely published: `?lang=en` full of Arabic body
 * text, annotated `hreflang="en"`, was duplicate content on every tenant at once.
 *
 * hreflang is emitted only for a cluster with more than one member, and every member lists every other
 * member including itself — Google discards a cluster that is not reciprocal and self-consistent.
 */
export function tenantUrls(input: TenantUrlInput): SitemapEntry[] {
  const { base, locales, defaultLocale, lastmod } = input;
  const paths: { path: string; priority: string; lastmod: string }[] = [
    { path: "", priority: "1.0", lastmod },
    ...(input.projects?.length ? [{ path: "projects", priority: "0.8", lastmod }] : []),
    ...(input.projects ?? []).map((p) => ({ path: `projects/${p.slug}`, priority: "0.7", lastmod: p.lastmod || lastmod })),
    ...(input.services ?? []).map((s) => ({ path: `services/${s.slug}`, priority: "0.7", lastmod: s.lastmod || lastmod })),
  ];
  const out: SitemapEntry[] = [];
  for (const p of paths) {
    const urlFor = (l: Locale) => `${base}${p.path}${l === defaultLocale ? "" : `${p.path.includes("?") ? "&" : "?"}lang=${l}`}`;
    const alternates =
      locales.length > 1
        ? [...locales.map((l) => ({ lang: l, href: urlFor(l) })), { lang: "x-default", href: urlFor(defaultLocale) }]
        : undefined;
    for (const l of locales) {
      out.push({ loc: urlFor(l), lastmod: p.lastmod, priority: l === defaultLocale ? p.priority : "0.5", alternates });
    }
  }
  return out;
}

export interface PlatformUrlInput {
  rootUrl: (path: string) => string;
  categories: readonly string[];
  lastmod: string;
}

/**
 * The platform's own indexable pages.
 *
 * The 60 `/template/<code>` previews are gone from here on purpose: they are the same Arabic demo body
 * text sixty times over, they are now `noindex, follow`, and 60 near-duplicates on the money domain were
 * spending the crawl budget that `/templates` and the four category pages need.
 */
export function platformUrls(input: PlatformUrlInput): SitemapEntry[] {
  const { rootUrl, lastmod } = input;
  return [
    { loc: rootUrl("/"), lastmod, priority: "1.0" },
    { loc: rootUrl("/templates"), lastmod, priority: "0.9" },
    ...input.categories.map((c) => ({ loc: rootUrl(`/templates/${c}`), lastmod, priority: "0.8" })),
  ];
}
