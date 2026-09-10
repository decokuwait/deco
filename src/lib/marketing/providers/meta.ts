import type { PixelConfig } from "@/lib/types";
import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { hashExternalId, hashPhone } from "../hash";

const GRAPH_VERSION = "v21.0";
const VALUE_EVENTS = new Set(["Purchase", "InitiateCheckout", "AddPaymentInfo"]);

export function metaReady(pixel: PixelConfig): boolean {
  return !!(pixel.pixelId && pixel.accessToken);
}

export function buildMeta(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const userData: Record<string, unknown> = {
    external_id: [hashExternalId(visitor.code)],
  };
  if (visitor.ip) userData.client_ip_address = visitor.ip;
  if (visitor.userAgent) userData.client_user_agent = visitor.userAgent;
  if (visitor.cookies?._fbp) userData.fbp = visitor.cookies._fbp;
  if (visitor.cookies?._fbc) userData.fbc = visitor.cookies._fbc;
  const ph = hashPhone(visitor.phone);
  if (ph) userData.ph = [ph];

  const customData: Record<string, unknown> = { visitor_id: visitor.code };
  if (ctx.stage) customData.stage = ctx.stage;
  if (ctx.value != null) {
    customData.value = ctx.value;
    customData.currency = ctx.currency || "KWD";
  } else if (VALUE_EVENTS.has(ctx.eventName)) {
    // Purchase-type events must carry value + currency; send 0 rather than an invalid payload.
    customData.value = 0;
    customData.currency = ctx.currency || "KWD";
  }

  const event: Record<string, unknown> = {
    event_name: ctx.eventName,
    event_time: ctx.eventTime,
    event_id: ctx.eventId,
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };
  const url = ctx.sourceUrl || visitor.landingUrl;
  if (url) event.event_source_url = url;

  const body: Record<string, unknown> = { data: [event] };
  // Test event codes route events to the Test Events tab only; never send them with real traffic.
  if (ctx.test && pixel.testEventCode) body.test_event_code = pixel.testEventCode;

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixel.pixelId)}/events`;
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: pixel.accessToken }),
  };
  return { url: endpoint, init, redacted: body };
}

export const metaProvider: Provider = {
  build: buildMeta,
  ready: metaReady,
  async send(ctx) {
    if (!ctx.pixel.accessToken) {
      return { platform: "meta", ok: false, eventName: ctx.eventName, skipped: "missing_access_token" };
    }
    const { url, init } = buildMeta(ctx);
    return postJson(ctx, url, init, ctx.eventName);
  },
};
