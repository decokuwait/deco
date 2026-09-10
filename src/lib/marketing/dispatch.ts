import { randomUUID } from "node:crypto";
import type { Delivery, EventKey, PixelConfig, Platform, SourcePlatform } from "@/lib/types";
import { resolveEventName } from "./mapping";
import { selectTargets, type SignalMode } from "./select";
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
  test?: boolean;
  fetchImpl?: typeof fetch;
  /** Platforms to exclude for this dispatch (e.g. google for browser-originated clicks already sent by gtag). */
  exclude?: Platform[];
}

export interface DispatchResult {
  eventId: string;
  targets: Platform[];
  deliveries: Delivery[];
}

/** Send one event to the selected platforms in parallel. Never throws; failures are recorded per platform. */
export async function dispatchEvent(input: DispatchInput): Promise<DispatchResult> {
  const eventId = input.eventId || newEventId();
  const eventTime = input.eventTime || Math.floor(Date.now() / 1000);
  const pool = input.exclude?.length ? input.activePixels.filter((p) => !input.exclude!.includes(p.platform)) : input.activePixels;
  const targets = selectTargets(pool, input.visitor.sourcePlatform, input.signalMode ?? "smart", input.test ? (p) => !!p.pixelId : serverReady);
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
  return { eventId, targets: targets.map((t) => t.platform), deliveries };
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
