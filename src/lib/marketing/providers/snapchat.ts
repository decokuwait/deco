import type { PixelConfig } from "@/lib/types";
import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { hashExternalId, hashPhone } from "../hash";

export function snapchatReady(pixel: PixelConfig): boolean {
  return !!(pixel.pixelId && pixel.accessToken);
}

export function buildSnapchat(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const userData: Record<string, unknown> = { external_id: hashExternalId(visitor.code) };
  if (visitor.ip) userData.client_ip_address = visitor.ip;
  if (visitor.userAgent) userData.client_user_agent = visitor.userAgent;
  const clickId = visitor.clickIds?.sccid || visitor.clickIds?.sc_click_id;
  if (clickId) userData.sc_click_id = clickId;
  if (visitor.cookies?._scid) userData.sc_cookie1 = visitor.cookies._scid;
  const ph = hashPhone(visitor.phone);
  if (ph) userData.ph = ph;

  const customData: Record<string, unknown> = { event_id: ctx.eventId, description: `visitor ${visitor.code}` };
  if (ctx.stage) customData.content_category = ctx.stage;
  if (ctx.value != null) {
    customData.value = ctx.value;
    customData.currency = ctx.currency || "KWD";
  }

  const event: Record<string, unknown> = {
    event_name: ctx.eventName,
    event_time: ctx.eventTime,
    event_id: ctx.eventId,
    action_source: "WEB",
    user_data: userData,
    custom_data: customData,
  };
  const url = ctx.sourceUrl || visitor.landingUrl;
  if (url) event.event_source_url = url;

  const body = { data: [event] };
  // The validate endpoint only checks the payload; real traffic must always hit /events.
  const validate = !!ctx.test;
  const endpoint = `https://tr.snapchat.com/v3/${encodeURIComponent(pixel.pixelId)}/events${validate ? "/validate" : ""}?access_token=${encodeURIComponent(
    pixel.accessToken || "",
  )}`;
  const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  return { url: endpoint, init, redacted: body };
}

export const snapchatProvider: Provider = {
  build: buildSnapchat,
  ready: snapchatReady,
  async send(ctx) {
    if (!ctx.pixel.accessToken) {
      return { platform: "snapchat", ok: false, eventName: ctx.eventName, skipped: "missing_access_token" };
    }
    const { url, init } = buildSnapchat(ctx);
    return postJson(ctx, url, init, ctx.eventName);
  },
};
