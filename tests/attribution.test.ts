import { describe, expect, it } from "vitest";
import { detectAttribution, fbcFromClickId } from "@/lib/visitor/attribution";

describe("detectAttribution", () => {
  it("detects Meta from fbclid", () => {
    const a = detectAttribution("https://site.com/?fbclid=ABC123&utm_source=ig", "https://l.instagram.com/");
    expect(a.sourcePlatform).toBe("meta");
    expect(a.clickIds.fbclid).toBe("ABC123");
    expect(a.utm.utm_source).toBe("ig");
  });
  it("detects TikTok from ttclid", () => {
    expect(detectAttribution("https://site.com/?ttclid=xyz", null).sourcePlatform).toBe("tiktok");
  });
  it("detects Snapchat from sc_click_id / ScCid", () => {
    expect(detectAttribution("https://site.com/?sc_click_id=1", null).sourcePlatform).toBe("snapchat");
    expect(detectAttribution("https://site.com/?ScCid=1", null).sourcePlatform).toBe("snapchat");
  });
  it("detects Google from gclid / gbraid / wbraid", () => {
    expect(detectAttribution("https://site.com/?gclid=1", null).sourcePlatform).toBe("google");
    expect(detectAttribution("https://site.com/?gbraid=1", null).sourcePlatform).toBe("google");
  });
  it("detects X from twclid, utm_source and referrer", () => {
    expect(detectAttribution("https://site.com/?twclid=abc", null).sourcePlatform).toBe("x");
    expect(detectAttribution("https://site.com/?utm_source=twitter", null).sourcePlatform).toBe("x");
    expect(detectAttribution("https://site.com/?utm_source=x", null).sourcePlatform).toBe("x");
    expect(detectAttribution("https://site.com/", "https://t.co/abc").sourcePlatform).toBe("x");
    expect(detectAttribution("https://site.com/", "https://x.com/someone").sourcePlatform).toBe("x");
  });
  it("uses utm_source when no click id", () => {
    expect(detectAttribution("https://site.com/?utm_source=facebook&utm_campaign=x", null).sourcePlatform).toBe("meta");
    expect(detectAttribution("https://site.com/?utm_source=tiktok", null).sourcePlatform).toBe("tiktok");
    expect(detectAttribution("https://site.com/?utm_source=snapchat", null).sourcePlatform).toBe("snapchat");
    expect(detectAttribution("https://site.com/?utm_source=google", null).sourcePlatform).toBe("google");
  });
  it("falls back to referrer domain", () => {
    expect(detectAttribution("https://site.com/", "https://www.facebook.com/").sourcePlatform).toBe("meta");
    expect(detectAttribution("https://site.com/", "https://www.tiktok.com/@x").sourcePlatform).toBe("tiktok");
    expect(detectAttribution("https://site.com/", "https://www.snapchat.com/add/x").sourcePlatform).toBe("snapchat");
    expect(detectAttribution("https://site.com/", "https://www.google.com.kw/").sourcePlatform).toBe("google");
    expect(detectAttribution("https://site.com/", "https://youtube.com/").sourcePlatform).toBe("google");
  });
  it("is direct with no referrer or same-host referrer", () => {
    expect(detectAttribution("https://site.com/", null).sourcePlatform).toBe("direct");
    expect(detectAttribution("https://site.com/a", "https://site.com/").sourcePlatform).toBe("direct");
  });
  it("is other for unknown referrers", () => {
    expect(detectAttribution("https://site.com/", "https://bing.com/").sourcePlatform).toBe("other");
  });
  it("click ids take priority over utm and referrer", () => {
    expect(detectAttribution("https://site.com/?ttclid=1&utm_source=facebook", "https://facebook.com").sourcePlatform).toBe("tiktok");
  });
  it("survives invalid urls", () => {
    expect(detectAttribution("not a url", "also not").sourcePlatform).toBe("direct");
  });
  it("builds fbc from fbclid", () => {
    expect(fbcFromClickId("XYZ", 1700000000000)).toBe("fb.1.1700000000000.XYZ");
    expect(fbcFromClickId(undefined)).toBeUndefined();
  });
});
