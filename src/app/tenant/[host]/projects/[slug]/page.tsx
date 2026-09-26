import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { lt } from "@/lib/i18n/site";
import { ldJson, tenantGraph } from "@/lib/seo/jsonld";
import { enforcePrimaryHost, primaryUrl } from "@/lib/seo/primary-host";
import { serviceSlugs } from "@/lib/seo/service-slugs";
import { coverOf } from "@/templates/sections/shared/helpers";
import { loadTenantContent, loadTenantPage, requestPathAndQuery, TenantChrome } from "../_lib/site-page";
import { imageObjects, tenantPageMetadata } from "../_lib/seo";
import { relatedProjects, servicesForProject } from "../_lib/match";
import { findPublishedProject } from "../_lib/resolve";
import { ProjectDetail, pageImages } from "../_components/ProjectDetail";

/** Dynamic for the same reasons as the index: the visitor id is rendered into the WhatsApp links. */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ host: string; slug: string }> };

/** Description for search results: the project's own prose, trimmed, then the site's. */
function metaDescription(text: string, fallback: string): string {
  const body = text.replace(/\s+/g, " ").trim();
  return (body || fallback).slice(0, 300);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { host, slug } = await params;
  const base = await loadTenantContent(host);
  if (!base) return { title: "Not found" };
  const { site, data, locale, primary } = base;
  const project = findPublishedProject(data.projects, slug);
  // A 404 body is rendered by the page; the metadata for it must not claim to be a real, indexable page.
  if (!project) return { title: "Not found", robots: { index: false, follow: false } };
  const brand = lt(locale, site.content.brand.name) || site.name;
  const title = lt(locale, project.title);
  const loc = lt(locale, project.location);
  return tenantPageMetadata({
    site,
    locale,
    primary,
    path: `/projects/${project.slug}`,
    title: `${loc ? `${title} — ${loc}` : title} | ${brand}`.slice(0, 70),
    description: metaDescription(lt(locale, project.description), lt(locale, site.content.seo.description) || lt(locale, site.content.brand.tagline)),
    image: coverOf(project),
  });
}

/**
 * One project: its photographs, its area, its own prose and a WhatsApp CTA that carries the visitor id.
 *
 * `notFound()` for an unknown or unpublished slug — a real 404 with a real status, so a slug an owner
 * unpublished stops being indexable instead of lingering as a soft 404.
 */
export default async function ProjectPage({ params }: Params) {
  const { host, slug } = await params;
  const page = await loadTenantPage(host);
  if (!page) notFound();
  const project = findPublishedProject(page.data.projects, slug);
  if (!project) notFound();
  const path = `/projects/${project.slug}`;
  enforcePrimaryHost(page.primary, host, (await requestPathAndQuery()) || path);

  const { ctx, site, locale } = page;
  const c = site.content;
  const pageUrl = primaryUrl(page.primary, path);
  const title = ctx.text(project.title);
  const loc = ctx.text(project.location);
  const published = page.data.projects.filter((p) => p.published);
  const related = relatedProjects(published, project);

  // Services are content, not rows: the slug is derived, and it is derived by the same function the
  // sitemap uses so the two can never point at different URLs.
  const items = c.sections.services ? c.services.items : [];
  const slugs = serviceSlugs(items);
  const services = servicesForProject(items, project).map((service) => ({ service, slug: slugs[items.indexOf(service)] }));

  const images = pageImages(ctx, project);
  const graph = ldJson(
    tenantGraph({
      content: c,
      locale,
      siteUrl: page.base,
      pageUrl,
      siteName: site.name,
      pageTitle: loc ? `${title} — ${loc}` : title,
      description: ctx.text(project.description),
      images: images.map((i) => i.url),
      breadcrumb: [
        { name: ctx.ui("nav_home"), url: page.base },
        { name: ctx.ui("all_projects"), url: primaryUrl(page.primary, "/projects") },
        { name: title, url: pageUrl },
      ],
    }),
  );
  const photos = imageObjects({ images, pageUrl, base: page.base, credit: ctx.text(c.brand.name) || site.name });

  return (
    <TenantChrome page={page} jsonLd={photos ? [graph, ldJson(photos)] : [graph]}>
      <ProjectDetail ctx={ctx} project={project} related={related} services={services} />
    </TenantChrome>
  );
}
