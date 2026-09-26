import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "../_lib/auth";
import { DELETION_BATCH, DELETION_MAX_ATTEMPTS, LEAD_CLOSED_RETENTION_DAYS, LEAD_SPAM_RETENTION_DAYS, LOGIN_ATTEMPT_RETENTION_DAYS, PURGE_AFTER_DAYS, VISITOR_ANONYMISE_MONTHS, VISITOR_DELETE_MONTHS } from "../_lib/schedule";
import { purgeDeletedSites } from "@/lib/db/sites";
import { deleteDeletionRow, listPendingDeletions, markDeletionFailed, type PendingDeletion } from "@/lib/db/deletions";
import { deleteUser, pruneExpiredSessions, pruneLoginAttempts } from "@/lib/db/users";
import { anonymiseOldVisitors, deleteStaleNewVisitors } from "@/lib/db/visitors";
import { pruneLeads } from "@/app/(platform)/pricing/_lib/leads";
import { deleteObject } from "@/lib/storage";
import { removeDomainFromVercel, vercelConfigured } from "@/lib/vercel";
import { reportError } from "@/lib/observability";
import { todayIso } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Storage and Vercel calls go over the network one item at a time; the batch is bounded so the run fits.
export const maxDuration = 300;

/**
 * Housekeeping. Three jobs that all existed as intentions and none of which had anywhere to run.
 *
 * 1. **Purge** soft-deleted sites past their window. `purgeDeletedSites` queues the external cleanup in the
 *    same transaction as the delete, so it runs first and this run drains what it just queued.
 * 2. **Drain the deletion queue** — the R2 objects, Vercel domains and accounts left behind. The old code
 *    did this inline at delete time with `.catch(() => undefined)` on every call and then redirected
 *    `?saved=1`, so a failure was reported as a success and the orphan was never recorded. Here a failure
 *    increments `attempts` and leaves the row, which is the only surviving evidence that the object exists.
 * 3. **Retention.** `login_attempts` had NO cleanup at all — every failed sign-in the platform had ever
 *    seen was still there. Expired sessions and closed sales leads are pruned alongside it.
 *
 * Every step is independent: one failing must not stop the others, so each reports and carries on and the
 * response says exactly which ones worked. A 500 is only returned if the whole run could not start.
 */

async function performDeletion(item: PendingDeletion): Promise<void> {
  if (item.kind === "r2_object") return deleteObject(item.ref);
  if (item.kind === "user") return deleteUser(item.ref);
  if (item.kind === "vercel_domain") {
    // Nothing to un-register when Vercel was never configured; treat it as done rather than retrying forever.
    if (!vercelConfigured()) return;
    if (!(await removeDomainFromVercel(item.ref))) throw new Error("vercel_remove_failed");
    return;
  }
  throw new Error(`unknown_kind:${item.kind}`);
}

async function drainQueue(): Promise<{ done: number; failed: number }> {
  const pending = await listPendingDeletions(DELETION_BATCH, DELETION_MAX_ATTEMPTS);
  let done = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await performDeletion(item);
      await deleteDeletionRow(item.id);
      done++;
    } catch (e) {
      failed++;
      await markDeletionFailed(item.id, e);
      console.warn(`[dk:cron] deletion failed kind=${item.kind} ref=${item.ref} attempts=${item.attempts + 1}`);
    }
  }
  return { done, failed };
}

/** Runs one step, and turns a failure into a reported result instead of aborting the whole run. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    await reportError(e, { source: "cron-maintenance", fields: { step: name } });
    return { error: "failed" };
  }
}

async function run(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return auth.response;
  const headers = { "cache-control": "no-store" };

  const purged = await step("purge", () => purgeDeletedSites(PURGE_AFTER_DAYS));
  const queue = await step("queue", drainQueue);
  const loginAttempts = await step("login_attempts", () => pruneLoginAttempts(LOGIN_ATTEMPT_RETENTION_DAYS));
  const sessions = await step("sessions", pruneExpiredSessions);
  const leads = await step("leads", () => pruneLeads(LEAD_SPAM_RETENTION_DAYS, LEAD_CLOSED_RETENTION_DAYS));
  // Visitor PII: nothing removed an IP or a user agent before, so a lead from two years ago still carried
  // the address it arrived from. The row survives anonymisation so the funnel counts stay honest.
  const visitorsAnonymised = await step("visitors_anonymise", () => anonymiseOldVisitors(VISITOR_ANONYMISE_MONTHS));
  const visitorsDeleted = await step("visitors_delete", () => deleteStaleNewVisitors(VISITOR_DELETE_MONTHS));

  return NextResponse.json(
    {
      ok: true,
      today: todayIso(),
      via: auth.via,
      purgedSites: Array.isArray(purged) ? purged.length : purged,
      deletionQueue: queue,
      pruned: { loginAttempts, sessions, leads, visitorsAnonymised, visitorsDeleted },
      retention: {
        purgeAfterDays: PURGE_AFTER_DAYS,
        loginAttemptDays: LOGIN_ATTEMPT_RETENTION_DAYS,
        leadSpamDays: LEAD_SPAM_RETENTION_DAYS,
        leadClosedDays: LEAD_CLOSED_RETENTION_DAYS,
        visitorAnonymiseMonths: VISITOR_ANONYMISE_MONTHS,
        visitorDeleteMonths: VISITOR_DELETE_MONTHS,
      },
    },
    { headers },
  );
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
