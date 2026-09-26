import { createHmac, randomBytes } from "node:crypto";
import type { EventKey, PixelConfig } from "@/lib/types";
import type { Provider, SendContext } from "../types";
import { postJson } from "../types";
import { hashPhoneE164 } from "../hash";

/**
 * X (Twitter) Conversion API. Requires an X Ads pixel id (tw-xxxxx / o8vjt), the Event ID of the event
 * to fire (created in X Events Manager, e.g. tw-o8vjt-oa7ve) and OAuth 1.0a user-context credentials:
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

export function xCredsOf(pixel: PixelConfig): OAuth1Creds | null {
  const e = (pixel.extra ?? {}) as Record<string, string | undefined>;
  if (!e.consumerKey || !e.consumerSecret || !pixel.accessToken || !e.tokenSecret) return null;
  return { consumerKey: e.consumerKey, consumerSecret: e.consumerSecret, accessToken: pixel.accessToken, tokenSecret: e.tokenSecret };
}

/**
 * X is only ready when at least one event is mapped.
 *
 * It has no standard event names: every event is an Event ID minted in X Events Manager, and the
 * default map is all empty strings. Credentials alone used to count as ready, so `send` returned
 * `skipped: "missing_event_id"` and the owner — who had connected X perfectly — was told "signal
 * failed" on every stage mark until they opened a collapsed accordion.
 */
export function xReady(pixel: PixelConfig): boolean {
  if (!pixel.pixelId || xCredsOf(pixel) === null) return false;
  return Object.values(pixel.eventMap ?? {}).some((v) => typeof v === "string" && v.trim().length > 0);
}

/** The first event key this pixel actually has an Event ID for — what a test send must use. */
export function xFirstMappedEventKey(pixel: PixelConfig): EventKey | null {
  for (const [key, value] of Object.entries(pixel.eventMap ?? {})) {
    if (typeof value === "string" && value.trim()) return key as EventKey;
  }
  return null;
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

/** Identifiers accepted by the X CAPI: twclid, hashed_phone_number, hashed_email, and ip_address + user_agent. */
export function xIdentifiers(ctx: SendContext): Record<string, string>[] {
  const { visitor } = ctx;
  const identifiers: Record<string, string>[] = [];
  const twclid = visitor.clickIds?.twclid || twclidFromCookie(visitor.cookies?._twclid);
  if (twclid) identifiers.push({ twclid });
  const ph = hashPhoneE164(visitor.phone);
  if (ph) identifiers.push({ hashed_phone_number: ph });
  if (visitor.ip && visitor.userAgent) identifiers.push({ ip_address: visitor.ip, user_agent: visitor.userAgent });
  return identifiers;
}

export function buildX(ctx: SendContext) {
  const { pixel, visitor } = ctx;
  const conversion: Record<string, unknown> = {
    conversion_time: new Date(ctx.eventTime * 1000).toISOString(),
    event_id: ctx.eventName,
    identifiers: xIdentifiers(ctx),
    conversion_id: ctx.eventId,
    description: `visitor ${visitor.code}${ctx.stage ? ` ${ctx.stage}` : ""}${ctx.test ? " (test)" : ""}`,
  };
  if (ctx.value != null) {
    conversion.value = String(ctx.value);
    conversion.price_currency = ctx.currency || "KWD";
  }
  const body = { conversions: [conversion] };
  const url = `${API_BASE}/${encodeURIComponent(pixel.pixelId)}`;
  const creds = xCredsOf(pixel);
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(creds ? { Authorization: oauth1Header("POST", url, creds) } : {}) },
    body: JSON.stringify(body),
  };
  return { url, init, redacted: body };
}

export const xProvider: Provider = {
  build: buildX,
  ready: xReady,
  async send(ctx) {
    if (!ctx.eventName) return { platform: "x", ok: false, eventName: "", skipped: "missing_event_id" };
    if (!xCredsOf(ctx.pixel)) return { platform: "x", ok: false, eventName: ctx.eventName, skipped: "missing_oauth_credentials" };
    if (!xIdentifiers(ctx).length) return { platform: "x", ok: false, eventName: ctx.eventName, skipped: "no_identifier" };
    const { url, init } = buildX(ctx);
    return postJson(ctx, url, init, ctx.eventName);
  },
};
