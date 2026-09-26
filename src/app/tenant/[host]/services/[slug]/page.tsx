import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lt } from "@/lib/i18n/site";
import { ldJson, tenantGraph } from "@/lib/seo/jsonld";
import { enforcePrimaryHost, primaryUrl } from "@/lib/seo/primary-host";
import { loadTenantContent, loadTenantPage, requestPathAndQuery, TenantChrome } from "../../projects/_lib/site-page";
import { serviceLd, tenantPageMetadata } from "../../projects/_lib/seo";
import { faqsFor, projectsForService } from "../../projects/_lib/match";
import { ServiceDetail } from "../_components/ServiceDetail";
import { findServiceEntry, serviceEntries } from "../_lib/entries";

/** Dynamic for the same reasons as the project pages: the visitor id is rendered into the links. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ host: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host, slug } = await params;
  const base = await loadTenantContent(host);
  if (!base) return { title: "Not found" };
  const { site, locale, primary } = base;
  const entry = findServiceEntry(serviceEntries(site.content), slug);
  if (!entry) return { title: "Not found", robots: { index: false, follow: false } };
  const brand = lt(locale, site.content.brand.name) || site.name;
  const title = lt(locale, entry.service.title);
  const description = lt(locale, entry.service.description);
  return tenantPageMetadata({
    site,
    locale,
    primary,
    path: `/services/${entry.slug}`,
    title: `${title} | ${brand}`.slice(0, 70),
    description: (description || lt(locale, site.content.seo.description) || lt(locale, site.content.brand.tagline)).slice(0, 300),
    image: entry.service.imageUrl,
    // A service with no copy at all is a heading and a button. Let it be reached and followed, not indexed.
    index: !!description,
  });
}

/** One service: its copy, the projects that prove it, the questions people ask and a CTA. */
export default async function ServicePage({ params }: Params) {
  const { host, slug } = await params;
  const page = await loadTenantPage(host);
  if (!page) notFound();
  const c = page.site.content;
  const entries = serviceEntries(c);
  const entry = findServiceEntry(entries, slug);
  if (!entry) notFound();
  const path = `/services/${entry.slug}`;
  enforcePrimaryHost(page.primary, host, (await requestPathAndQuery()) || path);

  const { ctx, locale, site } = page;
  const pageUrl = primaryUrl(page.primary, path);
  const title = ctx.text(entry.service.title);
  const published = page.data.projects.filter((p) => p.published);
  const projects = projectsForService(published, entry.service, 3);
  const faqs = c.sections.faq ? faqsFor(c.faq.items, entry.service, locale) : [];
  const others = entries.filter((e) => e.slug !== entry.slug).slice(0, 3);
  const areas = (c.contact.areasServed ?? []).map((a) => ctx.text(a).trim()).filter(Boolean);

  const graph = ldJson(
    tenantGraph({
      content: c,
      locale,
      siteUrl: page.base,
      pageUrl,
      siteName: site.name,
      pageTitle: title,
      description: ctx.text(entry.service.description),
      images: [entry.service.imageUrl || "", ...projects.map((p) => p.coverUrl || "")].filter(Boolean),
      breadcrumb: [
        { name: ctx.ui("nav_home"), url: page.base },
        { name: ctx.text(c.services.title) || ctx.ui("nav_services"), url: primaryUrl(page.primary, "/services") },
        { name: title, url: pageUrl },
      ],
    }),
  );
  // Entity signal only: `Service` has no Google rich result, so it is emitted small and left alone.
  const service = ldJson(
    serviceLd({
      name: title,
      description: ctx.text(entry.service.description),
      pageUrl,
      base: page.base,
      areaServed: areas,
      image: entry.service.imageUrl,
    }),
  );

  return (
    <TenantChrome page={page} jsonLd={[graph, service]}>
      <ServiceDetail ctx={ctx} entry={entry} projects={projects} faqs={faqs} others={others} />
    </TenantChrome>
  );
}
