import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lt } from "@/lib/i18n/site";
import { ldJson, tenantGraph } from "@/lib/seo/jsonld";
import { enforcePrimaryHost, primaryUrl } from "@/lib/seo/primary-host";
import { loadTenantContent, loadTenantPage, requestPathAndQuery, TenantChrome } from "../projects/_lib/site-page";
import { tenantPageMetadata } from "../projects/_lib/seo";
import { ServicesIndex } from "./_components/ServicesIndex";
import { serviceEntries } from "./_lib/entries";

/** Dynamic for the same reasons as the project pages: the visitor id is rendered into the links. */
export const dynamic = "force-dynamic";

const PATH = "/services";

type Params = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host } = await params;
  const base = await loadTenantContent(host);
  if (!base) return { title: "Not found" };
  const { site, locale, primary } = base;
  const c = site.content;
  const entries = serviceEntries(c);
  const brand = lt(locale, c.brand.name) || site.name;
  const heading = lt(locale, c.services.title) || lt(locale, { ar: "خدماتنا", en: "Our services" });
  return tenantPageMetadata({
    site,
    locale,
    primary,
    path: PATH,
    title: `${heading} | ${brand}`.slice(0, 70),
    description: lt(locale, c.services.subtitle) || lt(locale, c.seo.description) || lt(locale, c.brand.tagline),
    image: entries[0]?.service.imageUrl,
    // Nothing to list is a thin page; keep it out of the index but let the crawler follow its links.
    index: entries.length > 0,
  });
}

/** Every service the site offers, each one a link to its own page. */
export default async function ServicesPage({ params }: Params) {
  const { host } = await params;
  const page = await loadTenantPage(host);
  if (!page) notFound();
  enforcePrimaryHost(page.primary, host, (await requestPathAndQuery()) || PATH);

  const c = page.site.content;
  const entries = serviceEntries(c);
  const heading = page.ctx.text(c.services.title) || page.ctx.ui("nav_services");
  const pageUrl = primaryUrl(page.primary, PATH);
  const graph = ldJson(
    tenantGraph({
      content: c,
      locale: page.locale,
      siteUrl: page.base,
      pageUrl,
      siteName: page.site.name,
      pageTitle: heading,
      description: page.ctx.text(c.services.subtitle),
      images: entries.map((e) => e.service.imageUrl || "").filter(Boolean),
      breadcrumb: [
        { name: page.ctx.ui("nav_home"), url: page.base },
        { name: heading, url: pageUrl },
      ],
    }),
  );

  return (
    <TenantChrome page={page} jsonLd={[graph]}>
      <ServicesIndex ctx={page.ctx} entries={entries} />
    </TenantChrome>
  );
}
