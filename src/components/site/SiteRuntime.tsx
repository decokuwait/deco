"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ConsentMode, Locale } from "@/lib/types";
import { ConsentNotice } from "./ConsentNotice";
import { consentSnapshot, noticeVisible, serverConsentSnapshot, setConsent, subscribeConsent, trackingAllowed, type ConsentChoice } from "./consent";

export interface BrowserPixel {
  platform: "meta" | "tiktok" | "snapchat" | "google" | "x";
  pixelId: string;
  /** Google Ads account id (AW-XXXX) and the conversion label of the "contact" conversion action. */
  adsId?: string;
  adsLabel?: string;
  /** Event names for browser-side firing, keyed by our event key. */
  events: { whatsapp_click: string; call_click: string; page_view: string };
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (name: string, props?: unknown, opts?: unknown) => void; page: () => void; identify?: (p: unknown) => void };
    snaptr?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    twq?: (...args: unknown[]) => void;
  }
}

/** Every pixel cookie the server knows how to use, and the pixel that writes it. */
const PIXEL_COOKIES = ["_fbp", "_fbc", "_ttp", "_scid", "_ga", "_twclid"] as const;
const COOKIE_OWNER: Record<BrowserPixel["platform"], string> = { meta: "_fbp", tiktok: "_ttp", snapchat: "_scid", google: "_ga", x: "_twclid" };

/**
 * How long the visit registration waits for the pixel scripts to write their cookies.
 *
 * The registration used to fire from a hydration effect while the pixels load `afterInteractive`, so
 * the fetch always won the race and `_fbp`/`_ttp`/`_scid`/`_ga` were empty for exactly the visitors
 * who matter — the first-time ones arriving on an ad. Waiting a couple of seconds costs nothing (the
 * row already exists from the server render) and is abandoned the moment the page is hidden.
 */
const COOKIE_WAIT_MS = 2500;
const COOKIE_POLL_MS = 150;

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** The pixel cookies present right now. Read at the moment of use, never cached. */
function readPixelCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const c of PIXEL_COOKIES) {
    const v = readCookie(c);
    if (v) cookies[c] = v;
  }
  return cookies;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function post(url: string, body: string) {
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* sendBeacon throws on some Safari versions when the payload type is rejected */
  }
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/**
 * Client runtime for tenant sites:
 *  - registers the visit (attribution, cookies) through /api/track
 *  - loads active browser pixels and fires PageView
 *  - exposes window.__dkTrack(eventKey) used by WhatsApp/call buttons: fires the browser pixel
 *    event with an event id and posts the same id — plus the pixel cookies as they stand at click
 *    time — to /api/track/event for server-side delivery.
 * `externalIdHash` is the SHA-256 of the visitor id for platforms that require hashed identifiers.
 */
export function SiteRuntime({
  visitorCode,
  externalIdHash,
  pixels,
  preview,
  consentMode = "notice",
  locale = "ar",
}: {
  visitorCode: string | null;
  externalIdHash: string | null;
  pixels: BrowserPixel[];
  preview: boolean;
  consentMode?: ConsentMode;
  locale?: Locale;
}) {
  const registered = useRef(false);
  /**
   * The registration effect must run exactly once, and `pixels` is a fresh array on every render — so
   * depending on it re-ran the effect the moment the consent store swapped its server snapshot for the
   * client one (which happens within the 150 ms before the first poll fires). The cleanup cleared the
   * pending timer, the re-run hit the `registered` guard and returned early, and the visit was then
   * never registered at all. Keyed on a stable string, with the cookie list behind a ref.
   */
  const expectedCookiesKey = pixels
    .map((p) => COOKIE_OWNER[p.platform])
    .filter(Boolean)
    .join(",");
  // The cookie is an external store, so React reads it the way it reads any other: "ssr" during the
  // server render, the real answer once the client takes over. That keeps the notice out of the HTML
  // (it would otherwise flash for every returning visitor who already dismissed it) with no
  // setState-in-an-effect and no hydration mismatch.
  const snapshot = useSyncExternalStore(subscribeConsent, consentSnapshot, serverConsentSnapshot);
  const allowed = trackingAllowed(consentMode, snapshot);
  // The click handler is installed once and lives on window, so it reads consent through a ref rather
  // than closing over a value that was true at mount and false by the time the visitor taps.
  const allowedRef = useRef(allowed);
  useEffect(() => {
    allowedRef.current = allowed;
  }, [allowed]);

  const answer = useCallback((next: Exclude<ConsentChoice, "unset">) => setConsent(next), []);

  // Register the visit, but give the pixel scripts their moment first so the row is created WITH
  // `_fbp` and friends instead of being enriched by a call that never comes on a single-page visit.
  useEffect(() => {
    if (preview) return;
    if (registered.current) return;
    registered.current = true;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + COOKIE_WAIT_MS;
    const expected = expectedCookiesKey ? expectedCookiesKey.split(",") : [];

    const send = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("pagehide", send);
      document.removeEventListener("visibilitychange", onHidden);
      post("/api/track", JSON.stringify({ url: location.href, referrer: document.referrer || null, cookies: readPixelCookies() }));
    };
    function onHidden() {
      // A visitor who leaves (or tabs away) before the pixels settle still has to be registered.
      if (document.visibilityState === "hidden") send();
    }
    const poll = () => {
      if (done) return;
      const have = readPixelCookies();
      if (!expected.length || expected.every((c) => have[c]) || Date.now() >= deadline) return send();
      timer = setTimeout(poll, COOKIE_POLL_MS);
    };
    window.addEventListener("pagehide", send);
    document.addEventListener("visibilitychange", onHidden);
    timer = setTimeout(poll, COOKIE_POLL_MS);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pagehide", send);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [visitorCode, preview, expectedCookiesKey]);

  useEffect(() => {
    window.__dkTrack = (eventKey) => {
      const eventId = uuid();
      if (allowedRef.current) {
        for (const p of pixels) {
          const name = p.events[eventKey];
          try {
            if (p.platform === "meta" && window.fbq) window.fbq(isStandardMeta(name) ? "track" : "trackCustom", name, { visitor_id: visitorCode }, { eventID: eventId });
            if (p.platform === "tiktok" && window.ttq) window.ttq.track(name, { description: `visitor ${visitorCode}` }, { event_id: eventId });
            if (p.platform === "snapchat" && window.snaptr) window.snaptr("track", name, { client_dedup_id: eventId, description: `visitor ${visitorCode}` });
            if (p.platform === "google" && window.gtag) {
              window.gtag("event", name, { visitor_id: visitorCode, transaction_id: eventId, send_to: p.pixelId });
              // Google Ads conversion actions need the account id + conversion label; without a label nothing is recorded.
              if (p.adsId && p.adsLabel) window.gtag("event", "conversion", { send_to: `${p.adsId}/${p.adsLabel}`, transaction_id: eventId });
            }
            if (p.platform === "x" && window.twq && name) window.twq("event", name, { conversion_id: eventId, description: `visitor ${visitorCode}` });
          } catch {
            /* pixel errors must never break navigation */
          }
        }
      }
      if (preview || !allowedRef.current) return;
      // The click is the one moment `_fbp` reliably exists: the pixel has been running for however
      // long the visitor read the page. Sending the cookies with the beacon repairs a visit that was
      // registered before they were written — the server merges them before it dispatches.
      post("/api/track/event", JSON.stringify({ eventKey, eventId, url: location.href, cookies: readPixelCookies() }));
    };
    // Clicks that happened between first paint and hydration were queued by WhatsAppLink; replay them
    // now so an early tap still produces its pixel event and its server-side conversion.
    const queued = window.__dkPending;
    if (queued?.length) {
      window.__dkPending = [];
      for (const key of queued) window.__dkTrack?.(key);
    }
    return () => {
      delete window.__dkTrack;
    };
  }, [pixels, visitorCode, preview]);

  if (preview) return null;
  return (
    <>
      {allowed &&
        pixels.map((p) => {
          if (p.platform === "meta")
            return (
              <Script key="meta" id="dk-meta" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(p.pixelId)}',${visitorCode ? `{external_id:'${esc(visitorCode)}'}` : "{}"});fbq('track','${esc(p.events.page_view)}');`}</Script>
            );
          if (p.platform === "tiktok")
            return (
              <Script key="tiktok" id="dk-tiktok" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${esc(p.pixelId)}');${externalIdHash ? `ttq.identify({external_id:'${esc(externalIdHash)}'});` : ""}ttq.page();}(window,document,'ttq');`}</Script>
            );
          if (p.platform === "snapchat")
            return (
              <Script key="snapchat" id="dk-snap" strategy="afterInteractive">{`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${esc(p.pixelId)}',{});snaptr('track','${esc(p.events.page_view)}');`}</Script>
            );
          if (p.platform === "google")
            return (
              <div key="google">
                <Script id="dk-gtag-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(p.pixelId)}`} />
                <Script id="dk-gtag" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${esc(p.pixelId)}'${visitorCode ? `,{user_id:'${esc(visitorCode)}'}` : ""});${p.adsId ? `gtag('config','${esc(p.adsId)}');` : ""}`}</Script>
              </div>
            );
          if (p.platform === "x")
            return (
              <Script key="x" id="dk-x" strategy="afterInteractive">{`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${esc(p.pixelId)}');${p.events.page_view ? `twq('event','${esc(p.events.page_view)}',{});` : ""}`}</Script>
            );
          return null;
        })}
      {noticeVisible(consentMode, snapshot) && <ConsentNotice mode={consentMode} locale={locale} onChoice={answer} />}
    </>
  );
}

function esc(s: string) {
  return String(s).replace(/[^a-zA-Z0-9_\-.:]/g, "");
}

const META_STANDARD = new Set([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "PageView",
  "Purchase",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent",
]);
function isStandardMeta(name: string) {
  return META_STANDARD.has(name);
}
