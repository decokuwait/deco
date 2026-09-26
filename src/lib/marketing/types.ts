import type { Delivery, DeliveryAlarm, EventKey, PixelConfig, Visitor } from "@/lib/types";

export type VisitorLike = Pick<
  Visitor,
  "code" | "ip" | "userAgent" | "clickIds" | "cookies" | "phone" | "firstSeenAt" | "landingUrl" | "referrer"
>;

export interface SendContext {
  pixel: PixelConfig;
  eventKey: EventKey;
  eventName: string;
  /** Shared across browser pixel + server API for deduplication. */
  eventId: string;
  /** Unix seconds. */
  eventTime: number;
  visitor: VisitorLike;
  sourceUrl?: string | null;
  value?: number | null;
  currency?: string | null;
  stage?: string | null;
  /** When true, providers use their test/validation endpoints or test codes. */
  test?: boolean;
  fetchImpl?: typeof fetch;
}

export type Provider = {
  build: (ctx: SendContext) => { url: string; init: RequestInit; redacted: unknown };
  send: (ctx: SendContext) => Promise<Delivery>;
  /** True when the pixel has the server-side credentials needed to deliver events. */
  ready: (pixel: PixelConfig) => boolean;
};

export const FETCH_TIMEOUT_MS = 8000;

/**
 * Every secret this pixel holds, longest first. GA4's Measurement Protocol only accepts `api_secret` as a
 * query parameter, so a URL carrying a secret can still reach an error message — and delivery results are
 * stored in `visitor_events.deliveries` and rendered in the admin panel. Scrub them on the way out.
 */
function secretsOf(pixel: SendContext["pixel"]): string[] {
  const extra = (pixel.extra ?? {}) as Record<string, unknown>;
  return [pixel.accessToken, extra.apiSecret, extra.consumerSecret, extra.tokenSecret]
    .filter((v): v is string => typeof v === "string" && v.length >= 6)
    .sort((a, b) => b.length - a.length);
}

export function redactSecrets(value: unknown, secrets: string[]): unknown {
  if (!secrets.length || value == null) return value;
  const scrub = (s: string) => secrets.reduce((acc, secret) => acc.split(secret).join("[redacted]"), s);
  if (typeof value === "string") return scrub(value);
  try {
    return JSON.parse(scrub(JSON.stringify(value)));
  } catch {
    return value;
  }
}

/**
 * Tell the two failures an owner must act on today apart from the noise.
 *
 * An expired token and a retired API version look identical in a red badge, but they are the only two
 * failures that break EVERY event for EVERY tenant at once and stay broken until a human intervenes —
 * a pinned Graph version reaching its sunset date takes the whole platform down silently and on a
 * schedule. Everything else is a per-event problem the retry queue can chase.
 */
export function classifyAlarm(status: number | undefined, body: unknown): DeliveryAlarm | undefined {
  if (status === 401) return "auth";
  const err = (body as { error?: { code?: number; type?: string; message?: string } } | null)?.error;
  const message = typeof err?.message === "string" ? err.message : typeof body === "string" ? body : "";
  // Meta retires a Graph version by answering every call to it with "Unsupported post request".
  if (/unsupported (get|post) request|unknown path components|version .*(no longer|deprecat)/i.test(message)) return "api_version";
  // 190 is Meta's expired/invalid access token; 102 and 463 are the session variants of it.
  if (err?.code === 190 || err?.code === 102 || err?.code === 463 || err?.type === "OAuthException") return "auth";
  if (/access[_ ]token.*(invalid|expired)|invalid.*access[_ ]token|token has expired/i.test(message)) return "auth";
  return undefined;
}

export async function postJson(
  ctx: SendContext,
  url: string,
  init: RequestInit,
  eventName: string,
): Promise<Delivery> {
  const f = ctx.fetchImpl ?? fetch;
  const secrets = secretsOf(ctx.pixel);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await f(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 500);
    }
    const alarm = res.ok ? undefined : classifyAlarm(res.status, body);
    return { platform: ctx.pixel.platform, ok: res.ok, status: res.status, eventName, response: redactSecrets(truncate(body), secrets), ...(alarm ? { alarm } : {}) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { platform: ctx.pixel.platform, ok: false, eventName, error: String(redactSecrets(message, secrets)) };
  } finally {
    clearTimeout(timer);
  }
}

function truncate(v: unknown): unknown {
  try {
    const s = JSON.stringify(v);
    if (s.length <= 2000) return v;
    return s.slice(0, 2000);
  } catch {
    return String(v).slice(0, 2000);
  }
}
