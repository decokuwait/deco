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
import { STAGES, type Stage } from "@/lib/types";

const VALUE_STAGES: Stage[] = ["ordered", "first_payment", "order_complete"];

function isStage(v: string): v is Stage {
  return (STAGES as string[]).includes(v);
}

/** Core feature: set the visitor's stage and fire the matching conversion signal to the ad platforms. */
export async function markStage(host: string, code: string, fd: FormData) {
  const { site, user } = await requireSiteAdmin(host);
  const back = `/admin/visitors/${code}`;
  const visitor = await getVisitorByCode(site.id, code);
  if (!visitor) redirect("/admin/visitors?error=not_found");

  const stage = readStr(fd, "stage", 40);
  if (!isStage(stage)) redirect(withQuery(back, { error: "invalid_stage" }));
  const value = VALUE_STAGES.includes(stage) ? readNum(fd, "value") : null;

  let outcome: "saved" | "sent" | "partial" | "failed" | "nosignal" = "saved";
  try {
    const updated = (await updateVisitor(visitor.id, { stage })) ?? visitor;
    const eventKey = stageToEventKey(stage);
    if (eventKey) {
      const pixels = await getActivePixels(site.id);
      const result = await dispatchEvent({
        activePixels: pixels,
        visitor: updated,
        eventKey,
        value,
        currency: "KWD",
        stage,
        signalMode: site.content.settings.signalMode,
        sourceUrl: updated.landingUrl,
      });
      await createEvent({
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
      });
      const okCount = result.deliveries.filter((d) => d.ok).length;
      if (!result.deliveries.length) outcome = "nosignal";
      else if (okCount === result.deliveries.length) outcome = "sent";
      else if (okCount === 0) outcome = "failed";
      else outcome = "partial";
    } else {
      outcome = "nosignal";
    }
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: outcome }));
}

export async function saveVisitorInfo(host: string, code: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const back = `/admin/visitors/${code}`;
  const visitor = await getVisitorByCode(site.id, code);
  if (!visitor) redirect("/admin/visitors?error=not_found");
  try {
    await updateVisitor(visitor.id, {
      name: readStr(fd, "name", 200) || null,
      phone: readStr(fd, "phone", 40) || null,
      notes: readStr(fd, "notes", 4000) || null,
    });
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}
