import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { getVisitorByCodeAndSecret, incrementWhatsappClicks } from "@/lib/db/visitors";
import { clickDedupeKey, createEvent, hasRecentEvent, setEventDeliveries } from "@/lib/db/events";
import { getActivePixels } from "@/lib/db/pixels";
import { dispatchEvent } from "@/lib/marketing/dispatch";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE } from "@/lib/config";
import { VISITOR_SECRET_COOKIE, isValidVisitorSecret } from "@/lib/auth/visitor-secret";
import { rateLimit } from "@/lib/rate-limit";
import { isCrossSite, sameHostUrl } from "@/lib/request-origin";

export const runtime = "nodejs";
// Server-side deliveries to up to five ad platforms run in after(); give the function room beyond the 10 s default.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** The same click from the same visitor within this window is not re-sent to the ad platforms. */
const DEDUPE_MINUTES = 10;

/**
 * Client-side conversion events (WhatsApp / call clicks). The visitor is identified by its own cookie pair
 * — the readable `dk_vid` code *and* the HttpOnly `dk_vsec` secret — the event is stored, and delivery to
 * the platform APIs happens after the response so the click is never delayed. Google is excluded here
 * because the browser gtag already reported the click (avoids double counting).
 *
 * The code alone used to be enough, which meant anyone who guessed a 6-digit number could post conversions
 * onto a stranger's lead and have them delivered to that tenant's ad accounts. The response also told them
 * whether the guess had landed (`unknown_visitor` vs `ok`); it no longer does.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req.headers)) return NextResponse.json({ error: "cross_site" }, { status: 403 });
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  if (site.status !== "active") return NextResponse.json({ error: "site_paused" }, { status: 403 });
  // A crawler that executes the page's JavaScript is not a conversion. The proxy classifies the user agent
  // and strips any inbound copy of this header.
  if (req.headers.get("x-dk-bot") === "1") return NextResponse.json({ ok: true });
  const ip = clientIp(req.headers) || "unknown";
  if (!(await rateLimit(`event:${ip}`, 30, 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { eventKey?: unknown; eventId?: unknown; url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const eventKey = body.eventKey === "call_click" ? "call_click" : "whatsapp_click";
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const cookieSecret = req.cookies.get(VISITOR_SECRET_COOKIE)?.value;
  if (!isValidVisitorCode(cookieCode) || !isValidVisitorSecret(cookieSecret)) return NextResponse.json({ error: "no_visitor" }, { status: 400 });

  const visitor = await getVisitorByCodeAndSecret(site.id, cookieCode, cookieSecret);
  // One answer for "no such code", "wrong secret" and "not your visitor", so the endpoint cannot be used
  // to test whether a guessed code exists. The next page load re-issues the caller their own identity.
  if (!visitor) return NextResponse.json({ error: "no_visitor" }, { status: 400 });

  // Sliding-window check first (it is the behaviour the admin panel documents), then let the insert
  // itself be the arbiter: a bucketed dedupe key means two parallel beacons from one double tap cannot
  // both win the race and send the same conversion twice under two different event ids.
  if (await hasRecentEvent(visitor.id, eventKey, DEDUPE_MINUTES)) return NextResponse.json({ ok: true, deduped: true });

  const eventId = typeof body.eventId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.eventId) ? body.eventId : crypto.randomUUID();
  const ev = await createEvent({
    visitorId: visitor.id,
    siteId: site.id,
    eventType: eventKey,
    eventId,
    dedupeKey: clickDedupeKey(visitor.id, eventKey, DEDUPE_MINUTES),
  });
  if (!ev) return NextResponse.json({ ok: true, deduped: true });
  if (eventKey === "whatsapp_click") await incrementWhatsappClicks(visitor.id);
  // The URL is reported to the ad platforms as the page the conversion happened on; a foreign one is not
  // something this site can vouch for, so it falls back to the row's own landing URL.
  const sourceUrl = sameHostUrl(req.headers, typeof body.url === "string" ? body.url : null) ?? visitor.landingUrl;
  const ua = req.headers.get("user-agent") || visitor.userAgent;
  const reqIp = clientIp(req.headers) || visitor.ip;

  after(async () => {
    try {
      const pixels = await getActivePixels(site.id);
      if (!pixels.length) return;
      const result = await dispatchEvent({
        activePixels: pixels,
        visitor: { ...visitor, ip: reqIp, userAgent: ua },
        eventKey,
        eventId: ev.eventId,
        sourceUrl,
        signalMode: site.content.settings.signalMode,
        exclude: ["google"],
      });
      await setEventDeliveries(ev.id, result.targets, result.deliveries);
    } catch (err) {
      console.error("dispatch failed", err);
    }
  });

  return NextResponse.json({ ok: true, eventId: ev.eventId });
}
