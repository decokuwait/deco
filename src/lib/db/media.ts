import { q } from "./client";

/** Storage keys of every file ever issued for a site (uploads are recorded in media_assets before they happen). */
export async function listMediaKeys(siteId: string): Promise<string[]> {
  const rows = await q<{ key: string }>(`select key from media_assets where site_id = $1`, [siteId]);
  return rows.map((r) => r.key);
}
