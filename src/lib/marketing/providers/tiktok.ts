import type { PixelConfig } from "@/lib/types";
import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { hashExternalId, hashPhoneE164 } from "../hash";

export function tiktokReady(pixel: PixelConfig): boolean {
  return !!(pixel.pixelId && pixel.accessToken);
}

export function buildTikTok(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const user: Record<string, unknown> = { external_id: hashExternalId(visitor.code) };
  if (visitor.ip) user.ip = visitor.ip;
  if (visitor.userAgent) user.user_agent = visitor.userAgent;
  if (visitor.clickIds?.ttclid) user.ttclid = visitor.clickIds.ttclid;
  if (visitor.cookies?._ttp) user.ttp = visitor.cookies._ttp;
  // TikTok hashes phone numbers in E.164 form (leading +).
  const ph = hashPhoneE164(visitor.phone);
  if (ph) user.phone = ph;

  const properties: Record<string, unknown> = { description: `visitor ${visitor.code}` };
  if (ctx.stage) properties.content_name = ctx.stage;
  if (ctx.value != null) {
    properties.value = ctx.value;
    properties.currency = ctx.currency || "KWD";
  }

  const page: Record<string, unknown> = {};
  const url = ctx.sourceUrl || visitor.landingUrl;
  if (url) page.url = url;
  if (visitor.referrer) page.referrer = visitor.referrer;

  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixel.pixelId,
    data: [
      {
        event: ctx.eventName,
        event_time: ctx.eventTime,
        event_id: ctx.eventId,
        user,
        page,
        properties,
      },
    ],
  };
  // Test event codes keep events out of reporting; only attach them for admin test sends.
  if (ctx.test && pixel.testEventCode) body.test_event_code = pixel.testEventCode;

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": pixel.accessToken || "" },
    body: JSON.stringify(body),
  };
  return { url: "https://business-api.tiktok.com/open_api/v1.3/event/track/", init, redacted: body };
}

export const tiktokProvider: Provider = {
  build: buildTikTok,
  ready: tiktokReady,
  async send(ctx) {
    if (!ctx.pixel.accessToken) {
      return { platform: "tiktok", ok: false, eventName: ctx.eventName, skipped: "missing_access_token" };
    }
    const { url, init } = buildTikTok(ctx);
    const d = await postJson(ctx, url, init, ctx.eventName);
    // TikTok returns HTTP 200 with a non-zero code on errors.
    const code = (d.response as { code?: number } | null)?.code;
    if (d.ok && typeof code === "number" && code !== 0) d.ok = false;
    return d;
  },
};
