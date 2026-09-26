import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { gaClientIdFromCookie } from "../hash";

/**
 * Google Analytics 4 Measurement Protocol.
 *
 * Read this before believing a green badge here. What is sent is an ANALYTICS hit, not an ad
 * conversion:
 *  - the `client_id` is synthesised from the visitor code when no `_ga` cookie was captured, so the
 *    hit joins no browser session;
 *  - there is no `session_id`/`gclid`, so GA4 attributes it to "Unassigned" and Google Ads gets
 *    nothing it can optimise on for the deeper stages (ordered / first_payment / order_complete);
 *  - `gclid`/`gbraid`/`wbraid` ARE captured in src/lib/visitor/attribution.ts and no provider reads them.
 *
 * The real fix is the Google Ads API offline conversion import
 * (`customers/{id}:uploadClickConversions` with a `ClickConversion` carrying the stored click id).
 * It needs a developer token, a manager-account customer id, per-tenant OAuth2 refresh tokens with
 * token refresh and revocation handling, and a conversion-action resource name per stage — roughly the
 * size of this whole module and a new admin flow, so it is out of scope for this pass. Until it lands,
 * every delivery from here is flagged `analyticsOnly` and the admin says so instead of "sent".
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

export function googleReady(pixel: import("@/lib/types").PixelConfig): boolean {
  return !!(pixel.pixelId && pixel.extra?.apiSecret);
}

export const googleProvider: Provider = {
  build: buildGoogle,
  ready: googleReady,
  async send(ctx) {
    if (!ctx.pixel.extra?.apiSecret) {
      return { platform: "google", ok: false, eventName: ctx.eventName, skipped: "missing_api_secret" };
    }
    const { url, init } = buildGoogle(ctx);
    const d = await postJson(ctx, url, init, ctx.eventName);
    d.analyticsOnly = true;
    // The debug endpoint returns validationMessages; treat any message as failure.
    const msgs = (d.response as { validationMessages?: unknown[] } | null)?.validationMessages;
    if (ctx.test && Array.isArray(msgs) && msgs.length) d.ok = false;
    return d;
  },
};
