"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

export interface BrowserPixel {
  platform: "meta" | "tiktok" | "snapchat" | "google" | "x";
  pixelId: string;
  adsId?: string;
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

function readCookie(name: string): string | undefined {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Client runtime for tenant sites:
 *  - registers the visit (attribution, cookies) through /api/track
 *  - loads active browser pixels and fires PageView
 *  - exposes window.__dkTrack(eventKey) used by WhatsApp/call buttons: fires the browser pixel
 *    event with an event id and posts the same id to /api/track/event for server-side delivery.
 */
export function SiteRuntime({ visitorCode, pixels, preview }: { visitorCode: string | null; pixels: BrowserPixel[]; preview: boolean }) {
  const registered = useRef(false);

  useEffect(() => {
    if (preview) return;
    if (registered.current) return;
    registered.current = true;
    const cookies: Record<string, string> = {};
    for (const c of ["_fbp", "_fbc", "_ttp", "_scid", "_ga", "_twclid"]) {
      const v = readCookie(c);
      if (v) cookies[c] = v;
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: visitorCode, url: location.href, referrer: document.referrer || null, cookies }),
      keepalive: true,
    }).catch(() => {});
  }, [visitorCode, preview]);

  useEffect(() => {
    window.__dkTrack = (eventKey) => {
      const eventId = uuid();
      for (const p of pixels) {
        const name = p.events[eventKey];
        try {
          if (p.platform === "meta" && window.fbq) window.fbq("trackCustom" === name ? "track" : isStandardMeta(name) ? "track" : "trackCustom", name, { visitor_id: visitorCode }, { eventID: eventId });
          if (p.platform === "tiktok" && window.ttq) window.ttq.track(name, { description: `visitor ${visitorCode}` }, { event_id: eventId });
          if (p.platform === "snapchat" && window.snaptr) window.snaptr("track", name, { client_dedup_id: eventId, description: `visitor ${visitorCode}` });
          if (p.platform === "google" && window.gtag) window.gtag("event", name, { visitor_id: visitorCode, transaction_id: eventId, send_to: p.adsId ? [p.pixelId, p.adsId] : p.pixelId });
          if (p.platform === "x" && window.twq && name) window.twq("event", name, { conversion_id: eventId, description: `visitor ${visitorCode}` });
        } catch {
          /* pixel errors must never break navigation */
        }
      }
      if (preview) return;
      const body = JSON.stringify({ code: visitorCode, eventKey, eventId, url: location.href });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/track/event", new Blob([body], { type: "application/json" }));
        else fetch("/api/track/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    return () => {
      delete window.__dkTrack;
    };
  }, [pixels, visitorCode, preview]);

  if (preview) return null;
  return (
    <>
      {pixels.map((p) => {
        if (p.platform === "meta")
          return (
            <Script key="meta" id="dk-meta" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(p.pixelId)}',${visitorCode ? `{external_id:'${esc(visitorCode)}'}` : "{}"});fbq('track','${esc(p.events.page_view)}');`}</Script>
          );
        if (p.platform === "tiktok")
          return (
            <Script key="tiktok" id="dk-tiktok" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${esc(p.pixelId)}');${visitorCode ? `ttq.identify({external_id:'${esc(visitorCode)}'});` : ""}ttq.page();}(window,document,'ttq');`}</Script>
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
