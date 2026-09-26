import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCron } from "../_lib/auth";
import { listSites, listSitesDueForPause, updateSite } from "@/lib/db/sites";
import { EXPIRY_WARNING_DAYS, REMINDER_OFFSETS, reminderOffsetFor, todayIso, type ReminderOffset } from "@/lib/billing";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pausing is a short write per site; sixty seconds is far more than a platform this size needs and stops a
// database hiccup from turning into a half-finished run.
export const maxDuration = 60;

/**
 * The daily billing job: enforce expiry, and surface who is about to lapse.
 *
 * The `paused` status already did everything it should — the holding page, `noindex`, tracking refused, the
 * site dropped from the sitemap — it simply had no automatic trigger. The only lever for non-payment was a
 * human opening /super and flipping a select. This is the trigger.
 *
 * Two deliberate properties:
 *  - **It only ever pauses.** It never un-pauses, because a site can be paused for reasons that have
 *    nothing to do with money (content under review, a dispute), and a cron that quietly republished one
 *    of those would be worse than no cron. Re-activation happens where the payment is recorded.
 *  - **The pause set comes from SQL, not from arithmetic here.** `listSitesDueForPause` compares against
 *    the database's `current_date`, so a function running at 00:10 UTC cannot decide that a Kuwaiti
 *    customer's last paid day ended three hours early.
 *
 * Reminders are *reported*, not sent: there is no transactional email or WhatsApp API in this product, and
 * inventing one inside a cron job would be the least reliable possible place to put it. The run logs one
 * greppable line per due reminder and returns the list, and /super shows the same sites in amber.
 */
async function run(req: NextRequest) {
  const auth = await authorizeCron(req);
  if (!auth.ok) return auth.response;

  const today = todayIso();
  const headers = { "cache-control": "no-store" };
  try {
    const due = await listSitesDueForPause();
    const paused: { slug: string; paidUntil: string | null }[] = [];
    for (const site of due) {
      await updateSite(site.id, { status: "paused" });
      paused.push({ slug: site.slug, paidUntil: site.paidUntil });
      console.log(`[dk:billing] paused slug=${site.slug} paid_until=${site.paidUntil} today=${today}`);
    }
    // A tenant page that was rendered while the site was active must stop being served from the cache the
    // moment it is paused; only worth the invalidation when something actually changed.
    if (paused.length) revalidatePath("/", "layout");

    // T+3 lands on a site that this job already paused, so it cannot come from `listSitesExpiringWithin`
    // (active sites only) — the reminder set is derived from one page of sites instead. That page is 200
    // rows; a platform past that needs a `listSitesByReminderOffset` accessor in the db layer.
    const all = await listSites({ limit: 200 });
    const reminders: Record<string, { slug: string; name: string; paidUntil: string | null; status: string }[]> = {};
    for (const o of REMINDER_OFFSETS) reminders[String(o)] = [];
    for (const site of all) {
      const offset: ReminderOffset | null = reminderOffsetFor(site.paidUntil, today);
      if (offset === null) continue;
      reminders[String(offset)].push({ slug: site.slug, name: site.name, paidUntil: site.paidUntil, status: site.status });
      console.log(`[dk:billing] reminder offset=${offset} slug=${site.slug} paid_until=${site.paidUntil}`);
    }

    return NextResponse.json(
      {
        ok: true,
        today,
        via: auth.via,
        paused,
        reminders,
        warningWindowDays: EXPIRY_WARNING_DAYS,
        scanned: all.length,
      },
      { headers },
    );
  } catch (e) {
    // A cron failure is silent by nature — nobody is watching a response nobody reads — so it is reported
    // the same way a request-time error is, and answers 500 so the platform's retry sees a failure.
    await reportError(e, { source: "cron-billing", fields: { today } });
    return NextResponse.json({ ok: false, error: "cron_failed" }, { status: 500, headers });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

/** Vercel Cron issues a GET; POST exists so any other scheduler can drive the same job. */
export async function POST(req: NextRequest) {
  return run(req);
}
