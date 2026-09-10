"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { getPixel, upsertPixel } from "@/lib/db/pixels";
import { patchSiteContent } from "@/lib/db/sites";
import { dispatchEvent, testVisitor } from "@/lib/marketing/dispatch";
import { EVENT_KEYS } from "@/lib/marketing/mapping";
import { siteUrl } from "@/lib/config";
import { isPlatform, type EventKey } from "@/lib/types";

export async function savePixel(host: string, platform: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  if (!isPlatform(platform)) redirect("/admin/marketing?error=bad_platform");
  const pixelId = readStr(fd, "pixelId", 120);
  const active = readBool(fd, "active");
  if (active && !pixelId) redirect(withQuery("/admin/marketing", { error: "pixel_id_required" }));
  try {
    const eventMap: Partial<Record<EventKey, string>> = {};
    for (const k of EVENT_KEYS) {
      const v = readStr(fd, `event.${k}`, 80);
      if (v) eventMap[k] = v;
    }
    const existing = await getPixel(site.id, platform);
    const prevExtra = (existing?.extra ?? {}) as Record<string, string | undefined>;
    const clear = readBool(fd, "clearToken");
    const tokenInput = readStr(fd, "accessToken", 2000);
    const secretInput = readStr(fd, "apiSecret", 500);
    // blank secret fields keep the stored value (so re-saving does not wipe it); "clearToken" removes them
    const keep = (input: string, prev: string | undefined) => (input ? input : clear ? undefined : prev);
    await upsertPixel(site.id, platform, {
      pixelId,
      accessToken: tokenInput ? tokenInput : clear ? null : (existing?.accessToken ?? null),
      extra: {
        ...prevExtra,
        apiSecret: keep(secretInput, prevExtra.apiSecret),
        adsId: readStr(fd, "adsId", 60) || undefined,
        adsLabel: readStr(fd, "adsLabel", 120) || undefined,
        consumerKey: platform === "x" ? readStr(fd, "consumerKey", 200) || (clear ? undefined : prevExtra.consumerKey) : prevExtra.consumerKey,
        consumerSecret: platform === "x" ? keep(readStr(fd, "consumerSecret", 200), prevExtra.consumerSecret) : prevExtra.consumerSecret,
        tokenSecret: platform === "x" ? keep(readStr(fd, "tokenSecret", 200), prevExtra.tokenSecret) : prevExtra.tokenSecret,
      },
      testEventCode: readStr(fd, "testEventCode", 60) || null,
      active,
      eventMap,
    });
  } catch (e) {
    redirect(withQuery("/admin/marketing", { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/marketing", { saved: "1", p: platform }));
}

export async function saveSignalMode(host: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const mode = readStr(fd, "signalMode", 10) === "all" ? "all" : "smart";
  await patchSiteContent(site.id, { settings: { signalMode: mode } });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/marketing", { saved: "1" }));
}

/** Sends a synthetic "contacted" event to one platform's test/debug endpoint and reports the result. */
export async function sendTestEvent(host: string, platform: string) {
  const { site } = await requireSiteAdmin(host);
  if (!isPlatform(platform)) redirect("/admin/marketing?error=bad_platform");
  const pixel = await getPixel(site.id, platform);
  if (!pixel || !pixel.pixelId) redirect(withQuery("/admin/marketing", { tested: platform, ok: "0", msg: "pixel_not_configured" }) + `#${platform}`);
  const url = siteUrl(host);
  const result = await dispatchEvent({
    activePixels: [{ ...pixel, active: true }],
    visitor: testVisitor(url),
    eventKey: "contacted",
    stage: "contacted",
    test: true,
    signalMode: "all",
    sourceUrl: url,
  });
  const d = result.deliveries[0];
  const msg = d ? (d.skipped ? d.skipped : d.error ? d.error : `${d.status ?? ""} ${JSON.stringify(d.response ?? "").slice(0, 300)}`) : "no_delivery";
  redirect(withQuery("/admin/marketing", { tested: platform, ok: d?.ok ? "1" : "0", msg }) + `#${platform}`);
}
