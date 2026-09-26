import { q, isUuid, json } from "@/lib/db/client";
import type { LText, MediaItem } from "@/lib/types";

/**
 * The two `project_media` writes `src/lib/db/projects.ts` does not expose yet: the authorable `alt`
 * column that 0005 added, the `focal` column 0008 adds, and applying a whole new order in one statement.
 *
 * This belongs in the db layer (src/lib/db/projects.ts) and should move there
 * (`addMedia`/`updateMedia` taking `alt` and `focal`, plus `reorderMedia(projectId, ids)`). It lives here
 * rather than in their file so ownership is not crossed; delete it and switch the two call sites over the
 * moment those land. Nothing else may import it.
 */

const FOCAL = new Set(["top", "center", "bottom"]);

export type Focal = NonNullable<MediaItem["focal"]>;

export function isFocal(v: string): v is Focal {
  return FOCAL.has(v);
}

/** Writes the columns the shared helper skips. A null clears; both are always supplied together. */
export async function saveMediaExtras(id: string, extras: { alt: LText | null; focal: Focal | null }) {
  if (!isUuid(id)) return;
  await q(`update project_media set alt = $2::jsonb, focal = $3 where id = $1`, [id, json(extras.alt), extras.focal]);
}

/** `id -> focal` for one project, since `mapMedia` does not read the column yet. */
export async function readFocals(projectId: string): Promise<Record<string, Focal>> {
  if (!isUuid(projectId)) return {};
  const rows = await q<{ id: string; focal: string | null }>(`select id, focal from project_media where project_id = $1`, [projectId]);
  const out: Record<string, Focal> = {};
  for (const r of rows) if (r.focal && isFocal(r.focal)) out[r.id] = r.focal;
  return out;
}

/**
 * Applies a whole order in one statement.
 *
 * The alternative is `moveMedia` once per adjacent swap: moving the tenth photo to the front is nine
 * swaps and twenty-seven queries, and Next dispatches Server Actions one at a time per client, so they
 * would also be serialised. The order arrives already decided by the editor, so it is written once.
 */
export async function reorderMedia(projectId: string, orderedIds: string[]) {
  const ids = orderedIds.filter(isUuid);
  if (!isUuid(projectId) || ids.length === 0) return;
  // Bound parameters, never interpolation: these ids came from a form.
  const cases = ids.map((_, i) => `when $${i + 2}::uuid then ${i}`).join(" ");
  const list = ids.map((_, i) => `$${i + 2}::uuid`).join(", ");
  await q(`update project_media set sort_order = case id ${cases} else sort_order end where project_id = $1 and id in (${list})`, [projectId, ...ids]);
}
