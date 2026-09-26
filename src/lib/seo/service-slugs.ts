import type { Service } from "@/lib/types";

/** Lowercase ASCII slug, `[^a-z0-9]+` collapsed to `-`, trimmed, capped at 60 characters. */
export function slugify(input: string | null | undefined): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * One URL slug per service, in document order.
 *
 * Services have no slug column, so the slug is derived — which means the sitemap and the route MUST
 * derive it identically or the sitemap submits 404s; it
 * lives here so `src/lib/seo` and `src/app/tenant/[host]/services` share one implementation instead of
 * two that agree today.
 */
export function serviceSlugs(items: Service[]): string[] {
  const seen = new Map<string, number>();
  return items.map((item, i) => {
    const base = slugify(item.title?.en) || slugify(item.id) || `service-${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** The inverse: the service a slug addresses, or null. */
export function findServiceBySlug(items: Service[], slug: string): Service | null {
  const slugs = serviceSlugs(items);
  const i = slugs.indexOf(slug);
  return i === -1 ? null : items[i];
}
