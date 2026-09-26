import { headers } from "next/headers";
import { isIndexableRootHost, parseHost, subdomainHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl, siteUrl } from "@/lib/config";
import { getSiteByHost, listSites } from "@/lib/db/sites";
import { listProjects } from "@/lib/db/projects";
import { CATEGORIES } from "@/lib/types";
import { getSitePrimaryHost, primaryUrl, resolvePrimaryHost } from "@/lib/seo/primary-host";
import { publishedLocales } from "@/lib/seo/locale";
import { siteLastmod } from "@/lib/seo/lastmod";
import { serviceSlugs } from "@/lib/seo/service-slugs";
import { pageCount, pageSlice, platformUrls, renderSitemapIndex, renderUrlset, tenantUrls } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

const XML = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", Vary: "X-Forwarded-Host, Host" };

function xml(body: string) {
  return new Response(body, { headers: XML });
}

/**
 * `lastmod` for the platform's own pages, which had none — and it is the one field Google actually uses.
 *
 * Evaluated once per cold start, so it tracks the deployment rather than the clock: a `lastmod` of "now"
 * on every request tells a crawler the page changed every time it looked, which is worse than omitting it.
 */
const BUILT_AT = new Date().toISOString();

/** The site list omits `is_primary`; the resolver only needs to know which host wins, and a verified custom domain always does. */
function asDomain(d: { hostname: string; kind: "subdomain" | "custom"; verified: boolean }) {
  return { ...d, isPrimary: false };
}

function pageParam(url: string): number {
  const v = Number(new URL(url).searchParams.get("page"));
  return Number.isFinite(v) && v > 0 ? Math.trunc(v) : 1;
}

/**
 * sitemap.xml per host.
 *
 * Tenant: every URL is built on the site's PRIMARY host, so the sitemap can never nominate the copy the
 * canonical tag disowns. The second language appears only when it is genuinely written (see
 * `publishedLocales`), `/privacy` is gone because it is `noindex`, and `lastmod` is the later of the
 * site's own timestamp and its newest published project — adding a project is the change that matters and
 * it never touched `sites.updated_at`. Above `SITEMAP_PAGE_SIZE` URLs the response becomes a sitemap
 * index over `?page=N`.
 *
 * Platform: a sitemap index. `?part=platform` holds the platform's own pages (the 60 preview URLs are
 * gone: they are `noindex` near-duplicates now), and each active tenant whose primary host is its
 * `*.decokuwait.com` subdomain is listed alongside. That cross-submission is legitimate because one
 * Search Console **Domain property** for `decokuwait.com` covers every subdomain — which is also the only
 * way this scales, since an account is capped at 1,000 properties and a per-site URL-prefix property
 * would spend one of them per tenant. A tenant on its own custom domain is NOT listed here: nothing
 * verifies `decokuwait.com` for `gulfalu.com`, so Google would ignore the entry.
 */
export async function GET(req: Request) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);

  if (info.kind === "site") {
    const site = await getSiteByHost(info.candidates, info.subdomain).catch(() => null);
    if (!site || site.status !== "active") return new Response("Not found", { status: 404 });
    const primary = await getSitePrimaryHost(site);
    const base = primaryUrl(primary);
    const [lastmod, projects] = await Promise.all([
      siteLastmod(site.id, site.updatedAt),
      listProjects(site.id, { publishedOnly: true }).catch(() => []),
    ]);
    const services = site.content.sections.services ? site.content.services.items : [];
    const all = tenantUrls({
      base,
      locales: publishedLocales(site.content),
      defaultLocale: site.content.settings.defaultLocale,
      lastmod,
      projects: projects.filter((p) => p.slug).map((p) => ({ slug: p.slug })),
      services: serviceSlugs(services).map((slug) => ({ slug })),
    });
    const pages = pageCount(all.length);
    if (pages === 1) return xml(renderUrlset(all));
    const page = pageParam(req.url);
    if (page > 1) return xml(renderUrlset(pageSlice(all, page)));
    return xml(renderSitemapIndex(Array.from({ length: pages }, (_, i) => ({ loc: `${base}sitemap.xml?page=${i + 1}`, lastmod }))));
  }

  if (!isIndexableRootHost(host, ROOT_DOMAIN)) return new Response("Not found", { status: 404 });

  if (new URL(req.url).searchParams.get("part") === "platform") {
    return xml(renderUrlset(platformUrls({ rootUrl, categories: CATEGORIES, lastmod: BUILT_AT })));
  }
  const sites = await listSites({ limit: 200 }).catch(() => []);
  const tenants = sites
    .filter((s) => s.status === "active")
    .map((s) => ({ site: s, primary: resolvePrimaryHost(s.domains.map(asDomain), { slug: s.slug }) }))
    // Subdomains only: nothing verifies `decokuwait.com` for a tenant's own custom domain, so an entry
    // for one would be ignored — and the subdomain 301s there anyway once the domain is verified.
    .filter(({ site, primary }) => primary.host === subdomainHost(site.slug, ROOT_DOMAIN))
    .map(({ site, primary }) => ({ loc: siteUrl(primary.host, "/sitemap.xml"), lastmod: site.updatedAt }));
  return xml(renderSitemapIndex([{ loc: rootUrl("/sitemap.xml?part=platform"), lastmod: BUILT_AT }, ...tenants]));
}
