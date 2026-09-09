import { NextResponse, type NextRequest } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { trackVisit } from "@/lib/db/visitors";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COOKIES = new Set(["_fbp", "_fbc", "_ttp", "_scid", "_ga", "_twclid"]);

/** Registers a visit for the tenant site of the current host. Called once per page load by SiteRuntime. */
export async function POST(req: NextRequest) {
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  let body: { code?: unknown; url?: unknown; referrer?: unknown; cookies?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const code = isValidVisitorCode(body.code) ? body.code : isValidVisitorCode(cookieCode) ? cookieCode : null;
  const cookies: Record<string, string> = {};
  if (body.cookies && typeof body.cookies === "object") {
    for (const [k, v] of Object.entries(body.cookies as Record<string, unknown>)) {
      if (ALLOWED_COOKIES.has(k) && typeof v === "string" && v.length < 300) cookies[k] = v;
    }
  }
  const { visitor, created } = await trackVisit({
    siteId: site.id,
    code,
    landingUrl: typeof body.url === "string" ? body.url : null,
    referrer: typeof body.referrer === "string" ? body.referrer : req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req.headers),
    cookies,
  });
  const res = NextResponse.json({ code: visitor.code, created, source: visitor.sourcePlatform });
  if (visitor.code !== cookieCode) {
    res.cookies.set(VISITOR_COOKIE, visitor.code, {
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return res;
}
