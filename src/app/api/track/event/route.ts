import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { getVisitorByCode, incrementWhatsappClicks, trackVisit } from "@/lib/db/visitors";
import { createEvent, setEventDeliveries } from "@/lib/db/events";
import { getActivePixels } from "@/lib/db/pixels";
import { dispatchEvent } from "@/lib/marketing/dispatch";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-side conversion events (WhatsApp / call clicks). Stores the event and forwards it to the
 * platform APIs after the response is sent, so the click is never delayed.
 */
export async function POST(req: NextRequest) {
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  let body: { code?: unknown; eventKey?: unknown; eventId?: unknown; url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const eventKey = body.eventKey === "call_click" ? "call_click" : "whatsapp_click";
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const code = isValidVisitorCode(body.code) ? body.code : isValidVisitorCode(cookieCode) ? cookieCode : null;
  if (!code) return NextResponse.json({ error: "no_visitor" }, { status: 400 });

  let visitor = await getVisitorByCode(site.id, code);
  if (!visitor) {
    const r = await trackVisit({
      siteId: site.id,
      code,
      landingUrl: typeof body.url === "string" ? body.url : null,
      referrer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
      ip: clientIp(req.headers),
    });
    visitor = r.visitor;
  }
  if (eventKey === "whatsapp_click") await incrementWhatsappClicks(visitor.id);

  const eventId = typeof body.eventId === "string" && body.eventId.length <= 64 ? body.eventId : undefined;
  const ev = await createEvent({ visitorId: visitor.id, siteId: site.id, eventType: eventKey, eventId: eventId || crypto.randomUUID() });
  const sourceUrl = typeof body.url === "string" ? body.url : visitor.landingUrl;
  const v = visitor;

  after(async () => {
    try {
      const pixels = await getActivePixels(site.id);
      if (!pixels.length) return;
      const result = await dispatchEvent({
        activePixels: pixels,
        visitor: { ...v, ip: clientIp(req.headers) || v.ip, userAgent: req.headers.get("user-agent") || v.userAgent },
        eventKey,
        eventId: ev.eventId,
        sourceUrl,
        signalMode: site.content.settings.signalMode,
      });
      await setEventDeliveries(ev.id, result.targets, result.deliveries);
    } catch (err) {
      console.error("dispatch failed", err);
    }
  });

  return NextResponse.json({ ok: true, eventId: ev.eventId });
}
