import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { gaClientIdFromCookie } from "../hash";

/**
 * Google Analytics 4 Measurement Protocol. Events sent here can be marked as conversions in GA4
 * and imported into Google Ads. Requires the GA4 measurement id (G-XXXX) as pixel id and an
 * API secret (GA4 -> Admin -> Data streams -> Measurement Protocol API secrets).
 */
export function buildGoogle(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const clientId = gaClientIdFromCookie(visitor.cookies?._ga) || stableClientId(visitor.code, visitor.firstSeenAt);
  const params: Record<string, unknown> = {
    visitor_id: visitor.code,
    engagement_time_msec: 100,
  };
  if (ctx.stage) params.stage = ctx.stage;
  if (ctx.value != null) {
    params.value = ctx.value;
    params.currency = ctx.currency || "KWD";
    params.transaction_id = ctx.eventId;
  }
  const body = {
    client_id: clientId,
    user_id: visitor.code,
    timestamp_micros: ctx.eventTime * 1_000_000,
    non_personalized_ads: false,
    events: [{ name: ctx.eventName, params }],
  };
  const base = ctx.test ? "https://www.google-analytics.com/debug/mp/collect" : "https://www.google-analytics.com/mp/collect";
  const url = `${base}?measurement_id=${encodeURIComponent(pixel.pixelId)}&api_secret=${encodeURIComponent(pixel.extra?.apiSecret || "")}`;
  const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  return { url, init, redacted: body };
}

function stableClientId(code: string, firstSeen: string): string {
  const ts = Math.floor(new Date(firstSeen || Date.now()).getTime() / 1000) || 0;
  return `${Number(code) || 100000}.${ts}`;
}

export const googleProvider: Provider = {
  build: buildGoogle,
  async send(ctx) {
    if (!ctx.pixel.extra?.apiSecret) {
      return { platform: "google", ok: false, eventName: ctx.eventName, skipped: "missing_api_secret" };
    }
    const { url, init } = buildGoogle(ctx);
    const d = await postJson(ctx, url, init, ctx.eventName);
    // The debug endpoint returns validationMessages; treat any message as failure.
    const msgs = (d.response as { validationMessages?: unknown[] } | null)?.validationMessages;
    if (ctx.test && Array.isArray(msgs) && msgs.length) d.ok = false;
    return d;
  },
};
