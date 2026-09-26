"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../../_lib/guard";
import { readNum, readStr } from "@/components/admin/ui";
import { getVisitorByCode, updateVisitor } from "@/lib/db/visitors";
import { getActivePixels } from "@/lib/db/pixels";
import { createEvent } from "@/lib/db/events";
import { dispatchEvent } from "@/lib/marketing/dispatch";
import { stageToEventKey } from "@/lib/marketing/mapping";
import { deliveryOutcome, stageAcceptsValue, stageNeedsValue, type MarkOutcome } from "@/lib/marketing/stages";
import { lastStageEventId, stageDedupeKey } from "@/lib/marketing/store";
import { internationalDigits, isKuwaitMobile } from "@/lib/content/defaults";
import { siteUrl } from "@/lib/config";
import { STAGES, type Stage } from "@/lib/types";

function isStage(v: string): v is Stage {
  return (STAGES as string[]).includes(v);
}

/**
 * Two tabs, or one impatient double tap, are the same mark. The window is short on purpose: a
 * deliberate resend a few minutes later is a real request and must still go through.
 */
const STAGE_DEDUPE_MINUTES = 1;

/**
 * Core feature: set the visitor's stage and fire the matching conversion signal to the ad platforms.
 * Re-marking the current stage is ignored unless the admin explicitly asks to resend the signal.
 */
export async function markStage(host: string, code: string, fd: FormData) {
  const { site, user } = await requireSiteAdmin(host);
  const back = `/admin/visitors/${code}`;
  const visitor = await getVisitorByCode(site.id, code);
  if (!visitor) redirect("/admin/visitors?error=not_found");

  const resend = readStr(fd, "resend", 40);
  const stage = resend || readStr(fd, "stage", 40);
  if (!isStage(stage)) redirect(withQuery(back, { error: "invalid_stage" }));
  if (!resend && visitor.stage === stage && stage !== "new") redirect(withQuery(back, { saved: "same" }));
  const value = stageAcceptsValue(stage) ? readNum(fd, "value") : null;
  if (stageNeedsValue(stage, value)) redirect(withQuery(back, { error: "value_required" }));

  // The single highest-value field in the whole tracking stack. Without it the only identifier Meta
  // gets is a SHA-256 of a 6-digit number it has never seen anywhere else, and match quality sits at
  // the floor. The owner is looking at the number in WhatsApp right now, so the field is on this form
  // rather than in a separate one further down the page that nobody fills in.
  const phoneInput = readStr(fd, "phone", 40);
  const phone = phoneInput ? internationalDigits(phoneInput) : "";
  // A number that is not a Kuwaiti mobile is still saved — foreign customers exist — but the owner is
  // told, because a typo here becomes a wa.me link to nobody and the lead dies with no error anywhere.
  const phoneWarn = !!phone && !isKuwaitMobile(phone);

  let outcome: MarkOutcome = "saved";
  try {
    const patch: Parameters<typeof updateVisitor>[1] = { stage };
    // Never blank a stored number from this form: clearing one is the job of the details form below.
    if (phone && phone !== visitor.phone) patch.phone = phone;
    const updated = (await updateVisitor(visitor.id, patch)) ?? { ...visitor, stage, phone: phone || visitor.phone };
    const eventKey = stageToEventKey(stage);
    if (eventKey) {
      const pixels = await getActivePixels(site.id);
      // A resend reuses the event id of the last signal for this visitor+stage. Every ad platform
      // deduplicates on event id, so three anxious clicks become one conversion on their side instead
      // of three separate Purchases — which is the only side that decides what the owner is charged for.
      const eventId = resend ? ((await lastStageEventId(visitor.id, stage)) ?? undefined) : undefined;
      const result = await dispatchEvent({
        activePixels: pixels,
        visitor: updated,
        eventKey,
        eventId,
        value,
        currency: "KWD",
        stage,
        signalMode: site.content.settings.signalMode,
        primaryPlatform: site.content.settings.primaryPlatform,
        sourceUrl: updated.landingUrl || siteUrl(host),
        siteId: site.id,
        visitorId: updated.id,
      });
      const ev = await createEvent({
        visitorId: updated.id,
        siteId: site.id,
        eventType: eventKey,
        stage,
        value,
        currency: "KWD",
        eventId: result.eventId,
        targets: result.targets,
        deliveries: result.deliveries,
        createdBy: user.id,
        // The click route has always passed one; stage marks did not, so two tabs double-fired.
        dedupeKey: stageDedupeKey(visitor.id, stage, STAGE_DEDUPE_MINUTES),
      });
      outcome = ev ? deliveryOutcome(result.deliveries) : "deduped";
    } else {
      outcome = "nosignal";
    }
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: outcome, warn: phoneWarn ? "phone" : undefined }));
}

export async function saveVisitorInfo(host: string, code: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const back = `/admin/visitors/${code}`;
  const visitor = await getVisitorByCode(site.id, code);
  if (!visitor) redirect("/admin/visitors?error=not_found");
  const phoneInput = readStr(fd, "phone", 40);
  const phone = phoneInput ? internationalDigits(phoneInput) : "";
  const phoneWarn = !!phone && !isKuwaitMobile(phone);
  try {
    await updateVisitor(visitor.id, {
      name: readStr(fd, "name", 200) || null,
      phone: phone || null,
      notes: readStr(fd, "notes", 4000) || null,
    });
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1", warn: phoneWarn ? "phone" : undefined }));
}
