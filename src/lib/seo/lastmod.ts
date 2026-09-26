import { one } from "@/lib/db/client";

/** The later of two ISO timestamps. */
export function newest(...values: (string | null | undefined)[]): string {
  const stamps = values.filter((v): v is string => !!v);
  if (!stamps.length) return new Date().toISOString();
  return stamps.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/**
 * `lastmod` for a tenant's pages: `greatest(sites.updated_at, max(projects.updated_at))`.
 *
 * `sites.updated_at` alone was wrong in the one case that matters. Adding a project — the change a decor
 * business makes weekly and the only reason to recrawl — writes to `projects`, never to `sites`, so the
 * sitemap kept advertising a months-old date and the new work was found late or not at all. `lastmod` is
 * the one sitemap field Google actually uses, and only while it is honest.
 */
export async function siteLastmod(siteId: string, siteUpdatedAt: string): Promise<string> {
  const r = await one<{ at: unknown }>(
    `select max(updated_at) as at from projects where site_id = $1 and published = true`,
    [siteId],
  ).catch(() => null);
  const at = r?.at;
  const iso = at instanceof Date ? at.toISOString() : typeof at === "string" ? at : null;
  return newest(siteUpdatedAt, iso);
}
