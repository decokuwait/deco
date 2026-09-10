import type { Delivery, EventKey, PixelConfig, Visitor } from "@/lib/types";

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

export async function postJson(
  ctx: SendContext,
  url: string,
  init: RequestInit,
  eventName: string,
): Promise<Delivery> {
  const f = ctx.fetchImpl ?? fetch;
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
    return { platform: ctx.pixel.platform, ok: res.ok, status: res.status, eventName, response: truncate(body) };
  } catch (err) {
    return { platform: ctx.pixel.platform, ok: false, eventName, error: err instanceof Error ? err.message : String(err) };
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
