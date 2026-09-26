import type { SiteContent } from "@/lib/types";
import { serviceSlugs } from "@/lib/seo/service-slugs";
import type { ServiceEntry } from "../_components/ServicesIndex";

/**
 * The services this site publishes, each paired with its URL slug.
 *
 * The slug comes from `@/lib/seo/service-slugs` — the same function the sitemap calls — because a service
 * has no slug column and a derived slug that two callers derive differently is a sitemap full of 404s.
 * Services are hidden entirely when the section is switched off: a page nothing links to, for a service
 * the owner has taken down, is not a page.
 */
export function serviceEntries(content: SiteContent): ServiceEntry[] {
  const items = content.sections.services ? content.services.items : [];
  const slugs = serviceSlugs(items);
  return items.map((service, i) => ({ service, slug: slugs[i] }));
}

/** The service a slug addresses, or null. Case-insensitive, like every other URL segment here. */
export function findServiceEntry(entries: ServiceEntry[], slug: string): ServiceEntry | null {
  const wanted = decodeURIComponent(slug).toLowerCase();
  return entries.find((e) => e.slug.toLowerCase() === wanted) ?? null;
}
