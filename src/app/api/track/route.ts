import { NextResponse, type NextRequest } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { trackVisit } from "@/lib/db/visitors";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COOKIES = new Set(["_fbp", "_fbc", "_ttp", "_scid", "_ga", "_twclid"]);

/**
 * Registers a visit for the tenant site of the current host. Called once per page load by SiteRuntime.
 * Only the visitor's own cookie code is honoured (never a code chosen in the request body), so the
 * endpoint cannot be used to enumerate or hijack other visitors, and it is rate limited per IP.
 */
export async function POST(req: NextRequest) {
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  const ip = clientIp(req.headers) || "unknown";
  if (!rateLimit(`track:${ip}`, 60, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { url?: unknown; referrer?: unknown; cookies?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const code = isValidVisitorCode(cookieCode) ? cookieCode : null;
  // First-visit creation (and collision handling) already happened during the page render; this call only
  // enriches the row, so it never re-allocates a code. The marker cookie is just cleared here.
  const hadFreshCookie = req.cookies.get(VISITOR_FRESH_COOKIE)?.value === "1";
  const cookies: Record<string, string> = {};
  if (body.cookies && typeof body.cookies === "object") {
    for (const [k, v] of Object.entries(body.cookies as Record<string, unknown>)) {
      if (ALLOWED_COOKIES.has(k) && typeof v === "string" && v.length < 300) cookies[k] = v;
    }
  }
  const { visitor, created } = await trackVisit({
    siteId: site.id,
    code,
    landingUrl: typeof body.url === "string" ? body.url.slice(0, 2000) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req.headers),
    cookies,
  });
  const res = NextResponse.json({ ok: true, created });
  const secure = req.nextUrl.protocol === "https:";
  if (visitor.code !== cookieCode) {
    res.cookies.set(VISITOR_COOKIE, visitor.code, { path: "/", maxAge: VISITOR_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false, secure });
  }
  if (hadFreshCookie) res.cookies.set(VISITOR_FRESH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
