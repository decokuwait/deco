import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lt } from "@/lib/i18n/site";
import { ldJson, tenantGraph } from "@/lib/seo/jsonld";
import { primaryUrl } from "@/lib/seo/primary-host";
import { enforcePrimaryHost } from "@/lib/seo/primary-host";
import { tenantTitle } from "@/lib/seo/titles";
import { loadTenantContent, loadTenantPage, requestPathAndQuery, TenantChrome } from "./_lib/site-page";
import { tenantPageMetadata } from "./_lib/seo";
import { ProjectsIndex, paginate } from "./_components/ProjectsIndex";

/**
 * Deliberately dynamic. The page reads `headers()` (tenant host, visitor id, `?lang=`) and prints the
 * visitor's own id inside its WhatsApp links, so a shared cache entry would hand one visitor another
 * visitor's lead id — the same class of bug as a cross-tenant leak. Caching this safely means moving the
 * id out of the server-rendered HTML first, then `use cache` + `cacheTag("site:" + id)`; `use cache` also
 * needs `cacheComponents`, which is currently off.
 */
export const dynamic = "force-dynamic";

const PATH = "/projects";

/** `?page=` as a positive integer; anything else is page 1 rather than an error. */
function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

type Params = { params: Promise<{ host: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { host } = await params;
  const base = await loadTenantContent(host);
  if (!base) return { title: "Not found" };
  const { site, data, locale, primary } = base;
  const c = site.content;
  const brand = lt(locale, c.brand.name) || site.name;
  const heading = lt(locale, c.projects.title) || tenantTitle(locale, c, site.category, site.name);
  const page = pageParam((await searchParams).page);
  const published = data.projects.filter((p) => p.published);
  const { pageCount, page: current } = paginate(published, page);
  // A paginated series self-canonicalises: page 2 is its own URL, not a duplicate of page 1. (rel=prev/next
  // is not used — Google retired it in 2019.)
  const path = current > 1 ? `${PATH}?page=${current}` : PATH;
  const suffix = current > 1 ? ` — ${current}` : "";
  return tenantPageMetadata({
    site,
    locale,
    primary,
    path,
    title: `${heading} | ${brand}${suffix}`.slice(0, 70),
    description: lt(locale, c.projects.subtitle) || lt(locale, c.seo.description) || lt(locale, c.brand.tagline),
    image: published[0]?.coverUrl,
    // An empty portfolio is a thin page. Keep it out of the index rather than offer Google a heading and
    // a WhatsApp button; the crawler still follows the links off it. `pageCount` guards a `?page=99` URL
    // that resolves to nothing for the same reason.
    index: published.length > 0 && current <= pageCount,
  });
}

/** The tenant's whole portfolio, one link per project. */
export default async function ProjectsPage({ params, searchParams }: Params) {
  const { host } = await params;
  const page = await loadTenantPage(host);
  if (!page) notFound();
  enforcePrimaryHost(page.primary, host, (await requestPathAndQuery()) || PATH);

  const published = page.data.projects.filter((p) => p.published);
  const data = paginate(published, pageParam((await searchParams).page));
  const c = page.site.content;
  const heading = page.ctx.text(c.projects.title) || page.ctx.ui("nav_projects");
  const pagePath = data.page > 1 ? `${PATH}?page=${data.page}` : PATH;
  const pageUrl = primaryUrl(page.primary, pagePath);

  const graph = ldJson(
    tenantGraph({
      content: c,
      locale: page.locale,
      siteUrl: page.base,
      pageUrl,
      siteName: page.site.name,
      pageTitle: heading,
      description: page.ctx.text(c.projects.subtitle),
      images: data.projects.map((p) => p.coverUrl || "").filter(Boolean),
      breadcrumb: [
        { name: page.ctx.ui("nav_home"), url: page.base },
        { name: page.ctx.ui("all_projects"), url: primaryUrl(page.primary, PATH) },
      ],
    }),
  );

  return (
    <TenantChrome page={page} jsonLd={[graph]}>
      <ProjectsIndex ctx={page.ctx} data={data} />
    </TenantChrome>
  );
}
