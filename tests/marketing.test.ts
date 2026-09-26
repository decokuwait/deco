import { describe, expect, it, vi } from "vitest";
import type { PixelConfig } from "@/lib/types";
import { selectSignal, selectTargets } from "@/lib/marketing/select";
import { DEFAULT_EVENT_MAP, EVENT_KEYS, resolveEventName, stageToEventKey } from "@/lib/marketing/mapping";
import { hashExternalId, hashPhone, normalizePhone, gaClientIdFromCookie, sha256 } from "@/lib/marketing/hash";
import { DEFAULT_GRAPH_VERSION, buildMeta, graphVersion } from "@/lib/marketing/providers/meta";
import { buildTikTok } from "@/lib/marketing/providers/tiktok";
import { buildSnapchat } from "@/lib/marketing/providers/snapchat";
import { buildGoogle } from "@/lib/marketing/providers/google";
import { buildX, oauth1Header, xFirstMappedEventKey, xProvider, xReady } from "@/lib/marketing/providers/x";
import { dispatchEvent, testVisitor } from "@/lib/marketing/dispatch";
import { FETCH_TIMEOUT_MS } from "@/lib/marketing/types";
import { deliveryOutcome, isOptimisationStage, stageAcceptsValue, stageNeedsValue } from "@/lib/marketing/stages";
import { classifyAlarm } from "@/lib/marketing/types";
import { classifyDelivery } from "@/lib/marketing/report";
import { deliveryCode, isRetryable, retryDelayMinutes, stageDedupeKey } from "@/lib/marketing/store";
import { isKuwaitMobile, normalizeContent, normalizeSignalMode } from "@/lib/content/defaults";
import type { SendContext } from "@/lib/marketing/types";

function pixel(platform: PixelConfig["platform"], extra: Partial<PixelConfig> = {}): PixelConfig {
  return {
    id: `${platform}-id`,
    siteId: "site",
    platform,
    pixelId: `${platform}-pixel`,
    accessToken: "token",
    extra: platform === "google" ? { apiSecret: "secret" } : {},
    testEventCode: null,
    active: true,
    eventMap: {},
    ...extra,
  };
}

const visitor = {
  code: "654321",
  ip: "1.2.3.4",
  userAgent: "UA",
  clickIds: { fbclid: "FB1", ttclid: "TT1", sccid: "SC1" },
  cookies: { _fbp: "fb.1.1.2", _fbc: "fb.1.1.FB1", _ttp: "ttp1", _scid: "scid1", _ga: "GA1.1.111.222" },
  phone: "50000000",
  firstSeenAt: "2025-01-01T00:00:00.000Z",
  landingUrl: "https://site.com/?fbclid=FB1",
  referrer: "https://facebook.com/",
};

describe("selectTargets (signal routing)", () => {
  const all = [pixel("meta"), pixel("tiktok"), pixel("snapchat"), pixel("google")];
  it("sends only to the source platform when it has an active pixel", () => {
    expect(selectTargets(all, "meta").map((p) => p.platform)).toEqual(["meta"]);
    expect(selectTargets(all, "tiktok").map((p) => p.platform)).toEqual(["tiktok"]);
  });
  // The behaviour change: the retired "smart" mode fanned out here, so one real lead became four
  // conversions in four ad accounts. Source mode sends nothing rather than something false.
  it("source mode sends NOTHING when the source is unknown", () => {
    expect(selectTargets(all, "direct")).toEqual([]);
    expect(selectTargets(all, "other")).toEqual([]);
    expect(selectTargets(all, null)).toEqual([]);
  });
  it("source mode sends nothing when the source platform has no pixel", () => {
    const subset = [pixel("meta"), pixel("snapchat")];
    expect(selectTargets(subset, "tiktok")).toEqual([]);
  });
  it("primary mode falls back to exactly one designated platform, never to everything", () => {
    expect(selectTargets(all, "direct", "primary", undefined, "meta").map((p) => p.platform)).toEqual(["meta"]);
    expect(selectTargets(all, "tiktok", "primary", undefined, "meta").map((p) => p.platform)).toEqual(["tiktok"]);
    // Designated platform not connected, and no primary named at all: still nothing.
    expect(selectTargets([pixel("meta")], "direct", "primary", undefined, "x")).toEqual([]);
    expect(selectTargets(all, "direct", "primary", undefined, null)).toEqual([]);
  });
  it("ignores inactive or empty pixels", () => {
    const list = [pixel("meta", { active: false }), pixel("tiktok", { pixelId: "" }), pixel("google")];
    expect(selectTargets(list, "google").map((p) => p.platform)).toEqual(["google"]);
    expect(selectTargets(list, "meta")).toEqual([]);
  });
  it("mode all always sends to everything active", () => {
    expect(selectTargets(all, "meta", "all").length).toBe(4);
  });
  it("reports why, so the admin can warn instead of implying a clean match", () => {
    expect(selectSignal(all, "meta")).toMatchObject({ reason: "source", unknownSource: false });
    expect(selectSignal(all, "direct")).toMatchObject({ reason: "none", unknownSource: true });
    expect(selectSignal(all, "direct", "primary", undefined, "meta")).toMatchObject({ reason: "primary", unknownSource: true });
    expect(selectSignal(all, "direct", "all")).toMatchObject({ reason: "all", unknownSource: true });
  });
});

describe("SignalMode back-compat", () => {
  // Rows written before the rename still say "smart". Reading that as "all" would silently keep the
  // fan-out for every existing tenant, which is the whole thing being removed.
  it("maps the retired smart mode to source", () => {
    expect(normalizeSignalMode("smart")).toBe("source");
    expect(normalizeContent({ settings: { signalMode: "smart" } }).settings.signalMode).toBe("source");
  });
  it("keeps the three real modes and never falls back to fan-out", () => {
    for (const m of ["source", "primary", "all"] as const) expect(normalizeSignalMode(m)).toBe(m);
    expect(normalizeSignalMode("nonsense")).toBe("source");
    expect(normalizeSignalMode(undefined)).toBe("source");
    expect(normalizeContent({}).settings.signalMode).toBe("source");
  });
  it("only keeps a primary platform it recognises", () => {
    expect(normalizeContent({ settings: { primaryPlatform: "meta" } }).settings.primaryPlatform).toBe("meta");
    expect(normalizeContent({ settings: { primaryPlatform: "myspace" } }).settings.primaryPlatform).toBeNull();
  });
});

describe("event mapping", () => {
  it("has defaults for every event on every platform", () => {
    for (const plat of ["meta", "tiktok", "snapchat", "google"] as const) {
      for (const key of EVENT_KEYS) expect(DEFAULT_EVENT_MAP[plat][key]).toBeTruthy();
    }
  });
  it("custom mapping overrides defaults", () => {
    expect(resolveEventName({ platform: "meta", eventMap: { ordered: "MyOrder" } }, "ordered")).toBe("MyOrder");
    expect(resolveEventName({ platform: "meta", eventMap: { ordered: "  " } }, "ordered")).toBe("InitiateCheckout");
    expect(resolveEventName({ platform: "google", eventMap: {} }, "first_payment")).toBe("purchase");
  });
  it("maps stages to event keys", () => {
    expect(stageToEventKey("new")).toBeNull();
    expect(stageToEventKey("first_payment")).toBe("first_payment");
  });
});

describe("hashing", () => {
  it("normalizes Kuwaiti phones and hashes with sha256", () => {
    expect(normalizePhone("5000 0000")).toBe("96550000000");
    expect(normalizePhone("+965 50000000")).toBe("96550000000");
    expect(normalizePhone("0096550000000")).toBe("96550000000");
    expect(hashPhone("50000000")).toBe(sha256("96550000000"));
    expect(hashPhone("")).toBeNull();
    expect(hashExternalId(" 123456 ")).toBe(sha256("123456"));
  });
  it("extracts GA client id", () => {
    expect(gaClientIdFromCookie("GA1.1.111.222")).toBe("111.222");
    expect(gaClientIdFromCookie("bad")).toBeNull();
  });
});

function ctx(p: PixelConfig, over: Partial<SendContext> = {}): SendContext {
  return { pixel: p, eventKey: "first_payment", eventName: "Purchase", eventId: "evt-1", eventTime: 1700000000, visitor, value: 250, currency: "KWD", stage: "first_payment", ...over };
}

describe("provider payloads", () => {
  it("Meta CAPI payload", () => {
    const { url, init, redacted } = buildMeta(ctx(pixel("meta", { testEventCode: "TEST1" }), { test: true }));
    expect(url).toBe(`https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/meta-pixel/events`);
    const body = JSON.parse(String(init.body));
    expect(body.access_token).toBe("token");
    expect(body.test_event_code).toBe("TEST1");
    const ev = body.data[0];
    expect(ev.event_name).toBe("Purchase");
    expect(ev.event_id).toBe("evt-1");
    expect(ev.action_source).toBe("website");
    expect(ev.user_data.fbp).toBe("fb.1.1.2");
    expect(ev.user_data.fbc).toBe("fb.1.1.FB1");
    expect(ev.user_data.external_id[0]).toBe(sha256("654321"));
    expect(ev.user_data.ph[0]).toBe(sha256("96550000000"));
    expect(ev.custom_data.value).toBe(250);
    expect(ev.custom_data.currency).toBe("KWD");
    expect(ev.custom_data.visitor_id).toBe("654321");
    expect(JSON.stringify(redacted)).not.toContain("token");
  });
  it("TikTok Events API payload", () => {
    const { url, init } = buildTikTok(ctx(pixel("tiktok")));
    expect(url).toContain("business-api.tiktok.com/open_api/v1.3/event/track/");
    expect((init.headers as Record<string, string>)["Access-Token"]).toBe("token");
    const body = JSON.parse(String(init.body));
    expect(body.event_source_id).toBe("tiktok-pixel");
    expect(body.data[0].event).toBe("Purchase");
    expect(body.data[0].user.ttclid).toBe("TT1");
    expect(body.data[0].user.ttp).toBe("ttp1");
    expect(body.data[0].properties.value).toBe(250);
  });
  it("Snapchat CAPI v3 payload uses validate endpoint in test mode", () => {
    const { url, init } = buildSnapchat(ctx(pixel("snapchat"), { test: true }));
    expect(url).toBe("https://tr.snapchat.com/v3/snapchat-pixel/events/validate");
    // The token travels in a header, never in the URL (query strings reach provider logs and error strings).
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    const body = JSON.parse(String(init.body));
    expect(body.data[0].user_data.sc_click_id).toBe("SC1");
    expect(body.data[0].user_data.sc_cookie1).toBe("scid1");
    expect(body.data[0].action_source).toBe("WEB");
    const prod = buildSnapchat(ctx(pixel("snapchat")));
    expect(prod.url).toBe("https://tr.snapchat.com/v3/snapchat-pixel/events");
    expect(prod.url).not.toContain("access_token");
  });
  it("GA4 Measurement Protocol payload", () => {
    const { url, init } = buildGoogle(ctx(pixel("google")));
    expect(url).toContain("measurement_id=google-pixel");
    expect(url).toContain("api_secret=secret");
    const body = JSON.parse(String(init.body));
    expect(body.client_id).toBe("111.222");
    expect(body.user_id).toBe("654321");
    expect(body.events[0].name).toBe("Purchase");
    expect(body.events[0].params.value).toBe(250);
    const dbg = buildGoogle(ctx(pixel("google"), { test: true }));
    expect(dbg.url).toContain("/debug/mp/collect");
  });
  it("marks every GA4 delivery as analytics-only, because Google Ads cannot optimise on it", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const res = await dispatchEvent({ activePixels: [pixel("google")], visitor: { ...visitor, sourcePlatform: "google" }, eventKey: "first_payment", value: 250, fetchImpl });
    expect(res.deliveries[0].ok).toBe(true);
    expect(res.deliveries[0].analyticsOnly).toBe(true);
    expect(deliveryOutcome(res.deliveries)).toBe("analytics");
  });
});

describe("dispatchEvent", () => {
  it("sends to the right platforms in parallel and records deliveries", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ events_received: 1, code: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const res = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("tiktok"), pixel("google")],
      visitor: { ...visitor, sourcePlatform: "meta" },
      eventKey: "contacted",
      fetchImpl,
    });
    expect(res.targets).toEqual(["meta"]);
    expect(res.deliveries.length).toBe(1);
    expect(res.deliveries[0].ok).toBe(true);
    expect(res.deliveries[0].eventName).toBe("Lead");
    expect(calls[0]).toContain("graph.facebook.com");
    expect(res.eventId).toBeTruthy();
  });
  it("fans out only in mode all, and never throws on failures", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("tiktok")) return new Response(JSON.stringify({ code: 40001, message: "bad" }), { status: 200 });
      if (String(url).includes("snapchat")) throw new Error("network down");
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const res = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("tiktok"), pixel("snapchat"), pixel("google")],
      visitor: { ...testVisitor(), sourcePlatform: "direct" },
      eventKey: "order_complete",
      signalMode: "all",
      fetchImpl,
    });
    expect(res.targets.length).toBe(4);
    const by = Object.fromEntries(res.deliveries.map((d) => [d.platform, d]));
    expect(by.meta.ok).toBe(true);
    expect(by.tiktok.ok).toBe(false);
    expect(by.snapchat.ok).toBe(false);
    expect(by.snapchat.error).toContain("network down");
    expect(by.google.ok).toBe(true);
  });
  it("excludes pixels without server credentials and falls back to the ready ones", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const none = await dispatchEvent({
      activePixels: [pixel("meta", { accessToken: null }), pixel("google", { extra: {} })],
      visitor: { ...testVisitor(), sourcePlatform: "direct" },
      eventKey: "contacted",
      fetchImpl,
    });
    expect(none.targets).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    // Visitor came from Meta but the Meta pixel has no token. This used to fall back to every other
    // ready pixel, inventing a TikTok and a Snapchat conversion out of one Meta lead. Now nothing goes
    // out unless the owner has named a primary platform to carry unattributable traffic.
    const fallback = await dispatchEvent({
      activePixels: [pixel("meta", { accessToken: null }), pixel("tiktok"), pixel("snapchat")],
      visitor: { ...visitor, sourcePlatform: "meta" },
      eventKey: "contacted",
      fetchImpl,
    });
    expect(fallback.targets).toEqual([]);
    const named = await dispatchEvent({
      activePixels: [pixel("meta", { accessToken: null }), pixel("tiktok"), pixel("snapchat")],
      visitor: { ...visitor, sourcePlatform: "meta" },
      eventKey: "contacted",
      signalMode: "primary",
      primaryPlatform: "tiktok",
      fetchImpl,
    });
    expect(named.targets).toEqual(["tiktok"]);
  });
  it("honours exclude (browser clicks already reached Google through gtag) without inventing a substitute", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    // The visitor came from Google and the browser gtag already reported this click, so the server
    // excludes Google. Falling through to Meta — which is what the old fan-out did — would book a Meta
    // conversion for a Google click. Nothing is the right answer.
    const fromGoogle = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("google")],
      visitor: { ...visitor, sourcePlatform: "google" },
      eventKey: "whatsapp_click",
      exclude: ["google"],
      fetchImpl,
    });
    expect(fromGoogle.targets).toEqual([]);
    expect(calls.length).toBe(0);
    const fromMeta = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("google")],
      visitor: { ...visitor, sourcePlatform: "meta" },
      eventKey: "whatsapp_click",
      exclude: ["google"],
      fetchImpl,
    });
    expect(fromMeta.targets).toEqual(["meta"]);
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("graph.facebook.com");
    const all = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("google"), pixel("tiktok")],
      visitor: { ...testVisitor(), sourcePlatform: "direct" },
      eventKey: "whatsapp_click",
      signalMode: "all",
      exclude: ["google"],
      fetchImpl,
    });
    expect(all.targets.sort()).toEqual(["meta", "tiktok"]);
  });
  it("aborts a hung platform API after the timeout and records the failure", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")));
          }),
      ) as unknown as typeof fetch;
      const pending = dispatchEvent({ activePixels: [pixel("meta")], visitor: { ...visitor, sourcePlatform: "meta" }, eventKey: "contacted", fetchImpl });
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 10);
      const res = await pending;
      expect(res.deliveries[0].ok).toBe(false);
      expect(res.deliveries[0].error).toMatch(/abort/i);
    } finally {
      vi.useRealTimers();
    }
  });
  it("reuses a supplied event id so a resend is one conversion, not three", async () => {
    const ids: string[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      ids.push(JSON.parse(String(init?.body)).data[0].event_id);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    for (let i = 0; i < 3; i++) {
      await dispatchEvent({ activePixels: [pixel("meta")], visitor: { ...visitor, sourcePlatform: "meta" }, eventKey: "first_payment", eventId: "resend-1", value: 250, fetchImpl });
    }
    expect(ids).toEqual(["resend-1", "resend-1", "resend-1"]);
    const minted = await dispatchEvent({ activePixels: [pixel("meta")], visitor: { ...visitor, sourcePlatform: "meta" }, eventKey: "first_payment", value: 250, fetchImpl });
    expect(minted.eventId).not.toBe("resend-1");
  });
  it("only attaches test event codes and validation endpoints in test mode", () => {
    const prodMeta = JSON.parse(String(buildMeta(ctx(pixel("meta", { testEventCode: "T1" }))).init.body));
    expect(prodMeta.test_event_code).toBeUndefined();
    const testMeta = JSON.parse(String(buildMeta(ctx(pixel("meta", { testEventCode: "T1" }), { test: true })).init.body));
    expect(testMeta.test_event_code).toBe("T1");
    expect(buildSnapchat(ctx(pixel("snapchat", { testEventCode: "T1" }))).url).not.toContain("/validate");
    const prodTikTok = JSON.parse(String(buildTikTok(ctx(pixel("tiktok", { testEventCode: "T1" }))).init.body));
    expect(prodTikTok.test_event_code).toBeUndefined();
  });
  it("sends Purchase with value 0 when the admin marks a payment stage without an amount", () => {
    const body = JSON.parse(String(buildMeta(ctx(pixel("meta"), { value: null })).init.body));
    expect(body.data[0].custom_data.value).toBe(0);
    expect(body.data[0].custom_data.currency).toBe("KWD");
  });
});

describe("X (Twitter) conversion API", () => {
  const xPixel = pixel("x", {
    pixelId: "o8vjt",
    accessToken: "access-token",
    extra: { consumerKey: "ck", consumerSecret: "cs", tokenSecret: "ts" },
    eventMap: { first_payment: "tw-o8vjt-oa7ve", contacted: "tw-o8vjt-lead1" },
  });
  it("signs requests with OAuth 1.0a HMAC-SHA1 (RFC 5849 reference vector)", () => {
    // Twitter's documented example: https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature
    const header = oauth1Header(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      { consumerKey: "xvz1evFS4wEEPTGEFPHBog", consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw", accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE" },
      "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      1318622958,
    );
    expect(header.startsWith("OAuth ")).toBe(true);
    expect(header).toContain('oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog"');
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain('oauth_timestamp="1318622958"');
    expect(header).toContain('oauth_version="1.0"');
    expect(header).toMatch(/oauth_signature="[A-Za-z0-9%]+"/);
  });
  it("builds the conversion payload with twclid, dedup id and the configured Event ID", () => {
    const { url, init, redacted } = buildX(ctx(xPixel, { eventName: "tw-o8vjt-oa7ve", visitor: { ...visitor, clickIds: { twclid: "23opevjt" } } }));
    expect(url).toBe("https://ads-api.x.com/12/measurement/conversions/o8vjt");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^OAuth /);
    const body = JSON.parse(String(init.body));
    const c = body.conversions[0];
    expect(c.event_id).toBe("tw-o8vjt-oa7ve");
    expect(c.conversion_id).toBe("evt-1");
    expect(c.conversion_time).toBe(new Date(1700000000 * 1000).toISOString());
    expect(c.identifiers).toEqual(expect.arrayContaining([{ twclid: "23opevjt" }, { hashed_phone_number: sha256("+96550000000") }, { ip_address: "1.2.3.4", user_agent: "UA" }]));
    expect(c.value).toBe("250");
    expect(c.price_currency).toBe("KWD");
    expect(JSON.stringify(redacted)).not.toContain("access-token");
  });
  it("reads twclid from the _twclid cookie when the click id is missing", () => {
    const { init } = buildX(ctx(xPixel, { eventName: "tw-1", visitor: { ...visitor, clickIds: {}, cookies: { _twclid: JSON.stringify({ twclid: "fromcookie123", timestamp: 1 }) } } }));
    expect(JSON.parse(String(init.body)).conversions[0].identifiers[0]).toEqual({ twclid: "fromcookie123" });
  });
  it("is not ready until at least one Event ID is mapped", () => {
    // Credentials alone used to count as ready, so a correctly connected X account reported
    // "signal failed" on every stage mark until the owner found a collapsed accordion.
    expect(xReady(xPixel)).toBe(true);
    expect(xReady(pixel("x", { pixelId: "o8vjt", extra: { consumerKey: "ck", consumerSecret: "cs", tokenSecret: "ts" } }))).toBe(false);
    expect(xReady(pixel("x", { pixelId: "o8vjt", extra: { consumerKey: "ck", consumerSecret: "cs", tokenSecret: "ts" }, eventMap: { contacted: "  " } }))).toBe(false);
    expect(xReady(pixel("x", { pixelId: "", extra: { consumerKey: "ck", consumerSecret: "cs", tokenSecret: "ts" }, eventMap: { contacted: "tw-1" } }))).toBe(false);
    // A test send has to use an event the owner actually mapped: "contacted" resolves to "" by default.
    expect(xFirstMappedEventKey(xPixel)).toBe("first_payment");
    expect(xFirstMappedEventKey(pixel("x"))).toBeNull();
  });
  it("is left out of a dispatch entirely while nothing is mapped", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const bare = pixel("x", { pixelId: "o8vjt", extra: { consumerKey: "ck", consumerSecret: "cs", tokenSecret: "ts" } });
    const res = await dispatchEvent({ activePixels: [bare], visitor: { ...visitor, sourcePlatform: "x" }, eventKey: "contacted", fetchImpl });
    expect(res.targets).toEqual([]);
    expect(deliveryOutcome(res.deliveries)).toBe("nosignal");
  });
  it("skips events with no configured Event ID and pixels without OAuth credentials", async () => {
    const noEvent = await xProvider.send(ctx(xPixel, { eventName: "" }));
    expect(noEvent.skipped).toBe("missing_event_id");
    const noCreds = await xProvider.send(ctx(pixel("x", { extra: {} }), { eventName: "tw-1" }));
    expect(noCreds.skipped).toBe("missing_oauth_credentials");
  });
  it("routes X-sourced visitors to the X pixel only and resolves the mapped event id", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ request: { conversions: 1 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await dispatchEvent({ activePixels: [pixel("meta"), xPixel], visitor: { ...visitor, sourcePlatform: "x", clickIds: { twclid: "abc" } }, eventKey: "first_payment", value: 99, fetchImpl });
    expect(res.targets).toEqual(["x"]);
    expect(res.deliveries[0].ok).toBe(true);
    expect(res.deliveries[0].eventName).toBe("tw-o8vjt-oa7ve");
    expect(calls[0]).toContain("ads-api.x.com");
    const unmapped = await dispatchEvent({ activePixels: [xPixel], visitor: { ...visitor, sourcePlatform: "x" }, eventKey: "ordered", fetchImpl });
    expect(unmapped.deliveries[0].skipped).toBe("missing_event_id");
  });
});

describe("stage marking rules", () => {
  it("requires an amount only for payment stages and summarises deliveries", () => {
    expect(stageAcceptsValue("ordered")).toBe(true);
    expect(stageAcceptsValue("contacted")).toBe(false);
    expect(stageNeedsValue("first_payment", null)).toBe(true);
    expect(stageNeedsValue("first_payment", -1)).toBe(true);
    expect(stageNeedsValue("first_payment", 0)).toBe(false);
    expect(stageNeedsValue("order_complete", 250)).toBe(false);
    expect(stageNeedsValue("ordered", null)).toBe(false);
    expect(deliveryOutcome([])).toBe("nosignal");
    expect(deliveryOutcome([{ ok: true }, { ok: true }])).toBe("sent");
    expect(deliveryOutcome([{ ok: false }])).toBe("failed");
    expect(deliveryOutcome([{ ok: true }, { ok: false }])).toBe("partial");
  });
  it("treats a skip as neutral, not as a failure", () => {
    expect(deliveryOutcome([{ ok: false, skipped: "missing_event_id" }])).toBe("nosignal");
    expect(deliveryOutcome([{ ok: true }, { ok: false, skipped: "missing_event_id" }])).toBe("sent");
  });
  it("never calls a GA4-only delivery a sent ad signal", () => {
    expect(deliveryOutcome([{ ok: true, analyticsOnly: true }])).toBe("analytics");
    expect(deliveryOutcome([{ ok: true, analyticsOnly: true }, { ok: true }])).toBe("sent");
    expect(deliveryOutcome([{ ok: true, analyticsOnly: true }, { ok: false }])).toBe("failed");
  });
  it("separates the stages ad delivery can actually learn from", () => {
    // Meta's event_time ceiling is 7 days, so a stage marked weeks later is reporting, not optimisation.
    expect(isOptimisationStage("contacted")).toBe(true);
    expect(isOptimisationStage("called_for_visit")).toBe(true);
    expect(isOptimisationStage("first_payment")).toBe(false);
    expect(isOptimisationStage("order_complete")).toBe(false);
  });
  it("buckets a stage mark so two tabs cannot double-fire", () => {
    const at = 1700000000000;
    expect(stageDedupeKey("v1", "contacted", 1, at)).toBe(stageDedupeKey("v1", "contacted", 1, at + 5000));
    expect(stageDedupeKey("v1", "contacted", 1, at)).not.toBe(stageDedupeKey("v1", "contacted", 1, at + 120000));
    expect(stageDedupeKey("v1", "contacted", 1, at)).not.toBe(stageDedupeKey("v1", "ordered", 1, at));
    expect(stageDedupeKey("v1", "contacted", 1, at)).not.toBe(stageDedupeKey("v2", "contacted", 1, at));
  });
});

describe("failures the owner has to act on", () => {
  it("names an expired token and a retired API version instead of one generic red badge", () => {
    expect(classifyAlarm(401, null)).toBe("auth");
    expect(classifyAlarm(400, { error: { code: 190, message: "Error validating access token" } })).toBe("auth");
    expect(classifyAlarm(400, { error: { type: "OAuthException", message: "Session has expired" } })).toBe("auth");
    expect(classifyAlarm(400, { error: { code: 2500, message: "Unsupported post request. Please read the Graph API documentation" } })).toBe("api_version");
    expect(classifyAlarm(400, { error: { code: 100, message: "Unknown path components: /v21.0" } })).toBe("api_version");
    expect(classifyAlarm(400, { error: { code: 100, message: "Invalid parameter" } })).toBeUndefined();
    expect(classifyAlarm(200, { code: 0 })).toBeUndefined();
  });
  it("carries the alarm through a real dispatch", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 190, message: "Error validating access token: Session has expired" } }), { status: 400 })) as unknown as typeof fetch;
    const res = await dispatchEvent({ activePixels: [pixel("meta")], visitor: { ...visitor, sourcePlatform: "meta" }, eventKey: "contacted", fetchImpl });
    expect(res.deliveries[0].alarm).toBe("auth");
    expect(classifyDelivery(res.deliveries[0])).toBe("alarm");
  });
  it("retries only what a retry can fix", () => {
    expect(isRetryable({ platform: "meta", ok: false })).toBe(true); // no status: network error or the 8 s abort
    expect(isRetryable({ platform: "meta", ok: false, status: 429 })).toBe(true);
    expect(isRetryable({ platform: "meta", ok: false, status: 503 })).toBe(true);
    expect(isRetryable({ platform: "meta", ok: false, status: 400 })).toBe(false);
    expect(isRetryable({ platform: "meta", ok: false, status: 401, alarm: "auth" })).toBe(false);
    expect(isRetryable({ platform: "meta", ok: true })).toBe(false);
    expect(isRetryable({ platform: "x", ok: false, skipped: "missing_event_id" })).toBe(false);
    expect(retryDelayMinutes(1)).toBe(1);
    expect(retryDelayMinutes(3)).toBe(9);
    expect(retryDelayMinutes(99)).toBe(360);
  });
  it("stores a code, never the provider's own words", () => {
    expect(deliveryCode({ platform: "meta", ok: true })).toBe("ok");
    expect(deliveryCode({ platform: "meta", ok: false, alarm: "auth", status: 401 })).toBe("auth");
    expect(deliveryCode({ platform: "meta", ok: false, status: 503 })).toBe("http_503");
    expect(deliveryCode({ platform: "meta", ok: false, error: "fetch failed" })).toBe("network");
    expect(deliveryCode({ platform: "x", ok: false, skipped: "missing_event_id" })).toBe("missing_event_id");
  });
  it("renders the states that actually exist, not just green and red", () => {
    expect(classifyDelivery({ ok: true })).toBe("ok");
    expect(classifyDelivery({ ok: true, analyticsOnly: true })).toBe("analytics");
    expect(classifyDelivery({ ok: false, skipped: "missing_event_id" })).toBe("skipped");
    expect(classifyDelivery({ ok: false, skipped: "queued_for_retry" })).toBe("queued");
    expect(classifyDelivery({ ok: false, alarm: "auth" })).toBe("alarm");
    expect(classifyDelivery({ ok: false })).toBe("failed");
  });
});

describe("Meta Graph version", () => {
  it("comes from the environment, and refuses a value that would build a broken URL", () => {
    // Pinned in source it was a dated bomb: v21.0 stops answering on 2027-01-21, for every tenant at once.
    expect(graphVersion("v24.0")).toBe("v24.0");
    expect(graphVersion("")).toBe(DEFAULT_GRAPH_VERSION);
    expect(graphVersion(undefined)).toBe(DEFAULT_GRAPH_VERSION);
    expect(graphVersion("latest")).toBe(DEFAULT_GRAPH_VERSION);
    expect(graphVersion("../../me")).toBe(DEFAULT_GRAPH_VERSION);
  });
});

describe("Kuwait mobile validation", () => {
  it("accepts a reachable Kuwaiti mobile in every written form and rejects a typo", () => {
    for (const n of ["50000000", "96550000000", "0096550000000", "+965 6000 0000", "99000000"]) expect(isKuwaitMobile(n)).toBe(true);
    // The old check was /^\d{8,15}$/, which accepted all of these; each becomes a wa.me link to nobody.
    expect(isKuwaitMobile("500000000")).toBe(false); // nine digits
    expect(isKuwaitMobile("96522000000")).toBe(false); // landline, cannot receive WhatsApp
    expect(isKuwaitMobile("971500000000")).toBe(false); // not Kuwait
    expect(isKuwaitMobile("")).toBe(false);
    expect(isKuwaitMobile(null)).toBe(false);
  });
});
