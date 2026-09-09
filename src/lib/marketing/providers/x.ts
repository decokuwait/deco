import { createHmac, randomBytes } from "node:crypto";
import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { hashPhoneE164, hashExternalId } from "../hash";

/**
 * X (Twitter) Conversion API. Requires an X Ads pixel id (tw-xxxxx), the Event ID of the event to fire
 * (created in X Events Manager, e.g. tw-o8vjt-oa7ve) and OAuth 1.0a user-context credentials:
 * consumer key/secret (app) + access token/secret (user), stored in pixel.extra / pixel.accessToken.
 */
const API_BASE = "https://ads-api.x.com/12/measurement/conversions";

function enc(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export interface OAuth1Creds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  tokenSecret: string;
}

/** Builds an OAuth 1.0a (HMAC-SHA1) Authorization header for a JSON POST without query params. */
export function oauth1Header(method: string, url: string, creds: OAuth1Creds, nonce = randomBytes(16).toString("hex"), timestamp = Math.floor(Date.now() / 1000)): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(paramString)}`;
  const key = `${enc(creds.consumerSecret)}&${enc(creds.tokenSecret)}`;
  const signature = createHmac("sha1", key).update(base).digest("base64");
  const all: Record<string, string> = { ...params, oauth_signature: signature };
  return `OAuth ${Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}="${enc(all[k])}"`)
    .join(", ")}`;
}

export function xCreds(ctx: SendContext): OAuth1Creds | null {
  const e = (ctx.pixel.extra ?? {}) as Record<string, string | undefined>;
  if (!e.consumerKey || !e.consumerSecret || !ctx.pixel.accessToken || !e.tokenSecret) return null;
  return { consumerKey: e.consumerKey, consumerSecret: e.consumerSecret, accessToken: ctx.pixel.accessToken, tokenSecret: e.tokenSecret };
}

export function buildX(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const identifiers: Record<string, string>[] = [];
  const twclid = visitor.clickIds?.twclid || twclidFromCookie(visitor.cookies?._twclid);
  if (twclid) identifiers.push({ twclid });
  const ph = hashPhoneE164(visitor.phone);
  if (ph) identifiers.push({ hashed_phone_number: ph });
  // X accepts hashed_email as an identifier; we expose the visitor id as an opaque hashed value there only
  // when no other identifier is available so the conversion is still attributable server-side.
  if (!identifiers.length) identifiers.push({ hashed_email: hashExternalId(`${visitor.code}@visitor.decokuwait`) });

  const conversion: Record<string, unknown> = {
    conversion_time: new Date(ctx.eventTime * 1000).toISOString(),
    event_id: ctx.eventName,
    identifiers,
    conversion_id: ctx.eventId,
    description: `visitor ${visitor.code}${ctx.stage ? ` ${ctx.stage}` : ""}${ctx.test ? " (test)" : ""}`,
  };
  if (ctx.value != null) {
    conversion.value = String(ctx.value);
    conversion.currency = ctx.currency || "KWD";
  }
  const body = { conversions: [conversion] };
  const url = `${API_BASE}/${encodeURIComponent(pixel.pixelId)}`;
  const creds = xCreds(ctx);
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(creds ? { Authorization: oauth1Header("POST", url, creds) } : {}) },
    body: JSON.stringify(body),
  };
  return { url, init, redacted: body };
}

function twclidFromCookie(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { twclid?: string };
    if (parsed && typeof parsed.twclid === "string") return parsed.twclid;
  } catch {
    /* not json */
  }
  return /^[A-Za-z0-9_-]{8,}$/.test(raw) ? raw : undefined;
}

export const xProvider: Provider = {
  build: buildX,
  async send(ctx) {
    if (!ctx.eventName) return { platform: "x", ok: false, eventName: "", skipped: "missing_event_id" };
    if (!xCreds(ctx)) return { platform: "x", ok: false, eventName: ctx.eventName, skipped: "missing_oauth_credentials" };
    const { url, init } = buildX(ctx);
    return postJson(ctx, url, init, ctx.eventName);
  },
};
