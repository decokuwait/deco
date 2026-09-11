import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { getVisitorByCode, incrementWhatsappClicks } from "@/lib/db/visitors";
import { createEvent, hasRecentEvent, setEventDeliveries } from "@/lib/db/events";
import { getActivePixels } from "@/lib/db/pixels";
import { dispatchEvent } from "@/lib/marketing/dispatch";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Server-side deliveries to up to five ad platforms run in after(); give the function room beyond the 10 s default.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** The same click from the same visitor within this window is not re-sent to the ad platforms. */
const DEDUPE_MINUTES = 10;

/**
 * Client-side conversion events (WhatsApp / call clicks). The visitor is identified by its own cookie only,
 * the event is stored, and delivery to the platform APIs happens after the response so the click is never
 * delayed. Google is excluded here because the browser gtag already reported the click (avoids double counting).
 */
export async function POST(req: NextRequest) {
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  const ip = clientIp(req.headers) || "unknown";
  if (!rateLimit(`event:${ip}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { eventKey?: unknown; eventId?: unknown; url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const eventKey = body.eventKey === "call_click" ? "call_click" : "whatsapp_click";
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorCode(cookieCode)) return NextResponse.json({ error: "no_visitor" }, { status: 400 });

  const visitor = await getVisitorByCode(site.id, cookieCode);
  if (!visitor) return NextResponse.json({ error: "unknown_visitor" }, { status: 404 });

  if (await hasRecentEvent(visitor.id, eventKey, DEDUPE_MINUTES)) return NextResponse.json({ ok: true, deduped: true });
  if (eventKey === "whatsapp_click") await incrementWhatsappClicks(visitor.id);

  const eventId = typeof body.eventId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.eventId) ? body.eventId : crypto.randomUUID();
  const ev = await createEvent({ visitorId: visitor.id, siteId: site.id, eventType: eventKey, eventId });
  const sourceUrl = typeof body.url === "string" ? body.url.slice(0, 2000) : visitor.landingUrl;
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
