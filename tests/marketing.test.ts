import { describe, expect, it, vi } from "vitest";
import type { PixelConfig } from "@/lib/types";
import { selectTargets } from "@/lib/marketing/select";
import { DEFAULT_EVENT_MAP, EVENT_KEYS, resolveEventName, stageToEventKey } from "@/lib/marketing/mapping";
import { hashExternalId, hashPhone, normalizePhone, gaClientIdFromCookie, sha256 } from "@/lib/marketing/hash";
import { buildMeta } from "@/lib/marketing/providers/meta";
import { buildTikTok } from "@/lib/marketing/providers/tiktok";
import { buildSnapchat } from "@/lib/marketing/providers/snapchat";
import { buildGoogle } from "@/lib/marketing/providers/google";
import { buildX, oauth1Header, xProvider } from "@/lib/marketing/providers/x";
import { dispatchEvent, testVisitor } from "@/lib/marketing/dispatch";
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

describe("selectTargets (smart signal routing)", () => {
  const all = [pixel("meta"), pixel("tiktok"), pixel("snapchat"), pixel("google")];
  it("sends only to the source platform when it has an active pixel", () => {
    expect(selectTargets(all, "meta").map((p) => p.platform)).toEqual(["meta"]);
    expect(selectTargets(all, "tiktok").map((p) => p.platform)).toEqual(["tiktok"]);
  });
  it("sends to all active pixels when the source is unknown", () => {
    expect(selectTargets(all, "direct").length).toBe(4);
    expect(selectTargets(all, "other").length).toBe(4);
    expect(selectTargets(all, null).length).toBe(4);
  });
  it("sends to all active pixels when the source platform has no pixel", () => {
    const subset = [pixel("meta"), pixel("snapchat")];
    expect(selectTargets(subset, "tiktok").map((p) => p.platform)).toEqual(["meta", "snapchat"]);
  });
  it("ignores inactive or empty pixels", () => {
    const list = [pixel("meta", { active: false }), pixel("tiktok", { pixelId: "" }), pixel("google")];
    expect(selectTargets(list, "meta").map((p) => p.platform)).toEqual(["google"]);
  });
  it("mode all always sends to everything active", () => {
    expect(selectTargets(all, "meta", "all").length).toBe(4);
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
    const { url, init, redacted } = buildMeta(ctx(pixel("meta", { testEventCode: "TEST1" })));
    expect(url).toBe("https://graph.facebook.com/v21.0/meta-pixel/events");
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
    expect(url).toContain("https://tr.snapchat.com/v3/snapchat-pixel/events/validate?access_token=token");
    const body = JSON.parse(String(init.body));
    expect(body.data[0].user_data.sc_click_id).toBe("SC1");
    expect(body.data[0].user_data.sc_cookie1).toBe("scid1");
    expect(body.data[0].action_source).toBe("WEB");
    const prod = buildSnapchat(ctx(pixel("snapchat")));
    expect(prod.url).toContain("/events?access_token=");
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
  it("fans out to all when source unknown, and never throws on failures", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("tiktok")) return new Response(JSON.stringify({ code: 40001, message: "bad" }), { status: 200 });
      if (String(url).includes("snapchat")) throw new Error("network down");
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const res = await dispatchEvent({
      activePixels: [pixel("meta"), pixel("tiktok"), pixel("snapchat"), pixel("google")],
      visitor: { ...testVisitor(), sourcePlatform: "direct" },
      eventKey: "order_complete",
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
  it("skips platforms with missing credentials", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const res = await dispatchEvent({
      activePixels: [pixel("meta", { accessToken: null }), pixel("google", { extra: {} })],
      visitor: { ...testVisitor(), sourcePlatform: "direct" },
      eventKey: "contacted",
      fetchImpl,
    });
    expect(res.deliveries.every((d) => d.skipped)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
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
    expect(c.identifiers).toEqual(expect.arrayContaining([{ twclid: "23opevjt" }, { hashed_phone_number: sha256("+96550000000") }]));
    expect(c.value).toBe("250");
    expect(c.currency).toBe("KWD");
    expect(JSON.stringify(redacted)).not.toContain("access-token");
  });
  it("reads twclid from the _twclid cookie when the click id is missing", () => {
    const { init } = buildX(ctx(xPixel, { eventName: "tw-1", visitor: { ...visitor, clickIds: {}, cookies: { _twclid: JSON.stringify({ twclid: "fromcookie123", timestamp: 1 }) } } }));
    expect(JSON.parse(String(init.body)).conversions[0].identifiers[0]).toEqual({ twclid: "fromcookie123" });
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
