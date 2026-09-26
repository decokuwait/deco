import { createHash } from "node:crypto";

/** Hidden field carrying the version of the content a form was rendered from. */
export const VERSION_FIELD = "__version";

/**
 * Stable JSON: keys in sorted order, so the same content always hashes to the same string no matter what
 * order the driver handed the object back in.
 */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

/**
 * Fingerprint of the content a section form was built from.
 *
 * The lost update this guards against is at the *form* layer, not the database layer. A list section
 * renders `rows.count` and every `rows.N.id` into the HTML at page load, and the action rebuilds the whole
 * array from exactly those rows; arrays replace wholesale on merge. So a second tab — or the same tab left
 * open over lunch — saves a list that no longer has the service the other tab just added, and the panel
 * says "saved". The compare-and-set inside `patchSiteContent` cannot see any of this: it reads the content
 * and writes it back microseconds later, and both writes are individually consistent.
 *
 * Deriving the version from the content rather than `sites.updated_at` is deliberate: switching the
 * template bumps `updated_at` without changing a word of content, and that must not throw away an
 * editor the owner has open.
 */
export function contentVersion(content: unknown): string {
  return createHash("sha1").update(stable(content)).digest("hex").slice(0, 16);
}
