import { q, one, iso, isUuid } from "./client";

/**
 * Work that has to happen outside the database once a row is gone: an object in R2, a domain on Vercel, a
 * user account left without a site. Queued in the same transaction as the delete, drained by the cron.
 *
 * The old site delete did this inline, after the rows were already gone and with every failure swallowed:
 * a crash halfway through left orphaned R2 objects and Vercel domains that nothing recorded, so nobody
 * could even find out what had been leaked.
 */
export type DeletionKind = "r2_object" | "vercel_domain" | "user";
export const DELETION_KINDS: DeletionKind[] = ["r2_object", "vercel_domain", "user"];

export interface PendingDeletion {
  id: string;
  kind: DeletionKind;
  /** The storage key, hostname or user id to act on. Opaque to this layer. */
  ref: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  kind: DeletionKind;
  ref: string;
  attempts: number;
  last_error: string | null;
  created_at: unknown;
}

function map(r: Row): PendingDeletion {
  return { id: r.id, kind: r.kind, ref: r.ref, attempts: Number(r.attempts), lastError: r.last_error, createdAt: iso(r.created_at) };
}

const COLS = `id, kind, ref, attempts, last_error, created_at`;

/** Queues one item. `kind` is checked here as well as by the CHECK constraint so a typo fails at the call site. */
export async function enqueueDeletion(kind: DeletionKind, ref: string): Promise<PendingDeletion | null> {
  if (!DELETION_KINDS.includes(kind)) throw new Error("invalid_deletion_kind");
  if (!ref) return null;
  const r = await one<Row>(`insert into deletion_queue (kind, ref) values ($1, $2) returning ${COLS}`, [kind, ref]);
  return r ? map(r) : null;
}

/**
 * The next batch to attempt, oldest first, skipping anything that has already failed `maxAttempts` times.
 * A permanently failing row is left in place on purpose: it is the only record that the object exists, and
 * an operator needs to be able to see it.
 */
export async function listPendingDeletions(limit = 100, maxAttempts = 10): Promise<PendingDeletion[]> {
  const n = Math.min(Math.max(Math.trunc(Number(limit)) || 100, 1), 1000);
  const max = Math.min(Math.max(Math.trunc(Number(maxAttempts)) || 10, 1), 100);
  const rows = await q<Row>(`select ${COLS} from deletion_queue where attempts < $2 order by created_at limit $1`, [n, max]);
  return rows.map(map);
}

/** Records a failed attempt. The row stays queued and is retried until it hits the attempt ceiling. */
export async function markDeletionFailed(id: string, error: unknown): Promise<void> {
  if (!isUuid(id)) return;
  const message = (error instanceof Error ? error.message : String(error ?? "unknown")).slice(0, 500);
  await q(`update deletion_queue set attempts = attempts + 1, last_error = $2 where id = $1`, [id, message]);
}

/** Removes a queue row once the external delete succeeded. */
export async function deleteDeletionRow(id: string): Promise<void> {
  if (!isUuid(id)) return;
  await q(`delete from deletion_queue where id = $1`, [id]);
}

/** How much is waiting, and how much of it is stuck. For the operator dashboard. */
export async function deletionQueueStats(maxAttempts = 10): Promise<{ pending: number; failing: number }> {
  const max = Math.min(Math.max(Math.trunc(Number(maxAttempts)) || 10, 1), 100);
  const r = await one<{ pending: unknown; failing: unknown }>(
    `select count(*) as pending, count(*) filter (where attempts >= $1) as failing from deletion_queue`,
    [max],
  );
  return { pending: Number(r?.pending ?? 0), failing: Number(r?.failing ?? 0) };
}
