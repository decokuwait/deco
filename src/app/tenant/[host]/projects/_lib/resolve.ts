import type { Project } from "@/lib/types";

/**
 * The published project a URL slug addresses, or null.
 *
 * Resolved from the published-only list the page already holds rather than with a second
 * `where slug = $1` query: that keeps a project page at the home page's three round trips, and it makes
 * an unpublished project indistinguishable from one that never existed. Both are a real 404 — a slug an
 * owner takes down has to stop being indexable, not become a soft 404 that Google keeps in its index.
 *
 * Case-insensitive, because a slug pasted from a chat app arrives capitalised often enough to matter.
 */
export function findPublishedProject(projects: Project[], slug: string): Project | null {
  let wanted = slug;
  try {
    wanted = decodeURIComponent(slug);
  } catch {
    // A malformed percent-escape is not a slug any project has; fall through and fail to find it.
  }
  const key = wanted.trim().toLowerCase();
  if (!key) return null;
  return projects.find((p) => p.published && (p.slug || "").toLowerCase() === key) ?? null;
}
