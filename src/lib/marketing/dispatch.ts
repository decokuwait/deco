import { randomUUID } from "node:crypto";
import type { Delivery, EventKey, PixelConfig, Platform, SignalMode, SourcePlatform } from "@/lib/types";
import { resolveEventName } from "./mapping";
import { selectSignal, type SelectionReason } from "./select";
import type { Provider, SendContext, VisitorLike } from "./types";
import { metaProvider } from "./providers/meta";
import { tiktokProvider } from "./providers/tiktok";
import { snapchatProvider } from "./providers/snapchat";
import { googleProvider } from "./providers/google";
import { xProvider } from "./providers/x";

export const PROVIDERS: Record<Platform, Provider> = {
  meta: metaProvider,
  tiktok: tiktokProvider,
  snapchat: snapchatProvider,
  google: googleProvider,
  x: xProvider,
};

export function newEventId(): string {
  return randomUUID();
}

/** Whether a pixel can deliver server-side events (credentials present). */
export function serverReady(pixel: PixelConfig): boolean {
  const p = PROVIDERS[pixel.platform];
  return !!p && p.ready(pixel);
}

export interface DispatchInput {
  activePixels: PixelConfig[];
  visitor: VisitorLike & { sourcePlatform: SourcePlatform };
  eventKey: EventKey;
  eventId?: string;
  eventTime?: number;
  sourceUrl?: string | null;
  value?: number | null;
  currency?: string | null;
  stage?: string | null;
  signalMode?: SignalMode;
  /** Designated fallback platform for `primary` mode. */
  primaryPlatform?: Platform | null;
  /**
   * When given, every attempt is recorded for the signal-health card and retryable failures are queued
   * for the cron to drain. Left out (tests, previews) nothing touches the database.
   */
  siteId?: string;
  visitorId?: string;
  test?: boolean;
  fetchImpl?: typeof fetch;
  /** Platforms to exclude for this dispatch (e.g. google for browser-originated clicks already sent by gtag). */
  exclude?: Platform[];
}

export interface DispatchResult {
  eventId: string;
  targets: Platform[];
  deliveries: Delivery[];
  /** Why these targets were chosen, so the caller can report it without re-deriving the rule. */
  reason: SelectionReason;
}

/** Send one event to the selected platforms in parallel. Never throws; failures are recorded per platform. */
export async function dispatchEvent(input: DispatchInput): Promise<DispatchResult> {
  const eventId = input.eventId || newEventId();
  // Now, never the date the work actually happened: Meta caps event_time at 7 days in the past and
  // rejects anything older, so a back-dated conversion is not an option at any layer above this one.
  const eventTime = input.eventTime || Math.floor(Date.now() / 1000);
  const pool = input.exclude?.length ? input.activePixels.filter((p) => !input.exclude!.includes(p.platform)) : input.activePixels;
  const { targets, reason } = selectSignal(
    pool,
    input.visitor.sourcePlatform,
    input.signalMode ?? "source",
    input.test ? (p) => !!p.pixelId : serverReady,
    input.primaryPlatform ?? null,
  );
  const deliveries = await Promise.all(
    targets.map(async (pixel): Promise<Delivery> => {
      const ctx: SendContext = {
        pixel,
        eventKey: input.eventKey,
        eventName: resolveEventName(pixel, input.eventKey),
        eventId,
        eventTime,
        visitor: input.visitor,
        sourceUrl: input.sourceUrl,
        value: input.value,
        currency: input.currency,
        stage: input.stage,
        test: input.test,
        fetchImpl: input.fetchImpl,
      };
      try {
        return await PROVIDERS[pixel.platform].send(ctx);
      } catch (err) {
        return { platform: pixel.platform, ok: false, eventName: ctx.eventName, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
  // The database is only involved when the caller says which site this was for: dispatchEvent stays a
  // pure function for the payload tests, and the import itself is deferred so they never load the driver.
  if (input.siteId) {
    try {
      const { recordDispatch } = await import("./store");
      await recordDispatch({ siteId: input.siteId, visitorId: input.visitorId ?? null, eventKey: input.eventKey, eventId, eventTime, value: input.value ?? null, currency: input.currency ?? null, stage: input.stage ?? null, sourceUrl: input.sourceUrl ?? null, test: !!input.test }, deliveries);
    } catch (err) {
      // Bookkeeping must never lose a conversion that was already delivered.
      console.error("[marketing] recording deliveries failed", err);
    }
  }
  return { eventId, targets: targets.map((t) => t.platform), deliveries, reason };
}

/** Synthetic visitor used for "send test event" from the admin panel. */
export function testVisitor(landingUrl: string | null = null): VisitorLike & { sourcePlatform: SourcePlatform } {
  return {
    code: "123456",
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0 (DecoKuwait test event)",
    clickIds: {},
    cookies: {},
    phone: null,
    firstSeenAt: new Date().toISOString(),
    landingUrl,
    referrer: null,
    sourcePlatform: "direct",
  };
}
