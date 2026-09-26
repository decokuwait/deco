import { NextResponse, type NextRequest } from "next/server";
import { getRequestSite, clientIp } from "@/lib/site-request";
import { getVisitorByCodeAndSecret, trackVisit } from "@/lib/db/visitors";
import { isValidVisitorCode } from "@/lib/visitor/code";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";
import { VISITOR_SECRET_COOKIE, VISITOR_SECRET_MAX_AGE, isValidVisitorSecret } from "@/lib/auth/visitor-secret";
import { rateLimit } from "@/lib/rate-limit";
import { isCrossSite, sameHostUrl } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COOKIES = new Set(["_fbp", "_fbc", "_ttp", "_scid", "_ga", "_twclid"]);

/**
 * How long after its last sighting a visitor counts as being on a new visit. Thirty minutes is the
 * industry convention (it is what GA uses), and it is what decides whether a landing URL is allowed to
 * re-attribute the row.
 */
const SESSION_GAP_MS = 30 * 60_000;

/**
 * Registers a visit for the tenant site of the current host. Called once per page load by SiteRuntime.
 *
 * Identity is the `dk_vid` code AND the HttpOnly `dk_vsec` secret together. The code alone used to be
 * enough, and it is a 6-digit number in a script-readable cookie: 900,000 possibilities, guessable at
 * leisure. That made this endpoint three things at once — an oracle (the old `{ created }` in the
 * response answered "does code 412233 exist?"), a hijack tool (a hit merged the caller's cookies, IP and
 * user agent into the stranger's row, and a `url` carrying the caller's own `fbclid` rewrote that lead's
 * `source_platform`/`click_ids`/`utm`, so a competitor could fire conversions on somebody else's lead),
 * and a way to plant rows (a miss INSERTED the guessed code).
 *
 * What stops each of those now:
 *  - the secret must match before any existing row is read or written (`requireSecret`);
 *  - a caller-supplied code is never inserted: an unauthenticated caller always gets a server-allocated
 *    code, so a guess can neither create a row nor squat on one;
 *  - the response carries no `created` and no code that was not already this caller's, so a guess and a
 *    miss are indistinguishable from outside;
 *  - a landing URL may only re-attribute a row on a genuinely new visit, and only when it is a URL on
 *    this site's own host.
 *
 * Cross-site callers are refused: a foreign page could otherwise mint a visitor row per visitor it has.
 * Crawlers are answered without being tracked at all.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req.headers)) return NextResponse.json({ error: "cross_site" }, { status: 403 });
  const site = await getRequestSite();
  if (!site) return NextResponse.json({ error: "no_site" }, { status: 404 });
  // A site the operator has taken offline shows a "coming soon" page and must not keep collecting visitors.
  if (site.status !== "active") return NextResponse.json({ error: "site_paused" }, { status: 403 });
  // The proxy classifies the user agent and strips any inbound copy of the header. A crawler that runs
  // JavaScript gets the same 200 as everyone else and no row: nothing here is worth a database write.
  if (req.headers.get("x-dk-bot") === "1") return NextResponse.json({ ok: true });
  const ip = clientIp(req.headers) || "unknown";
  if (!(await rateLimit(`track:${ip}`, 60, 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { url?: unknown; referrer?: unknown; cookies?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const cookieSecret = req.cookies.get(VISITOR_SECRET_COOKIE)?.value;
  const code = isValidVisitorCode(cookieCode) ? cookieCode : null;
  const secret = isValidVisitorSecret(cookieSecret) ? cookieSecret : null;
  // First-visit creation (and collision handling) already happened during the page render; this call only
  // enriches the row, so it never re-allocates a code. The marker cookie also says that this request is
  // the second half of one page view — counting it again is what made every first visit register as two.
  const hadFreshCookie = req.cookies.get(VISITOR_FRESH_COOKIE)?.value === "1";
  const cookies: Record<string, string> = {};
  if (body.cookies && typeof body.cookies === "object") {
    for (const [k, v] of Object.entries(body.cookies as Record<string, unknown>)) {
      if (ALLOWED_COOKIES.has(k) && typeof v === "string" && v.length < 300) cookies[k] = v;
    }
  }

  // Whether the caller's landing URL is allowed to change this row's attribution.
  //
  // Last-touch attribution is a real feature: a returning visitor who arrives on a new ad click should be
  // re-attributed. Re-attribution *within* a visit is not — it is how a hijacker would overwrite a lead's
  // source with their own click id — so the URL only counts on a visit that is genuinely new: the row was
  // created just now, or it has not been seen for longer than the session gap.
  const existing = code && secret ? await getVisitorByCodeAndSecret(site.id, code, secret) : null;
  const newVisit = !existing || hadFreshCookie || Date.now() - Date.parse(existing.lastSeenAt) > SESSION_GAP_MS;
  const landingUrl = newVisit ? sameHostUrl(req.headers, typeof body.url === "string" ? body.url : null) : null;
  const referrer = newVisit ? (typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : req.headers.get("referer")) : null;

  const { visitor, secret: rowSecret } = await trackVisit({
    siteId: site.id,
    code,
    secret,
    // The caller is the public internet: a code it supplies is honoured only against the matching secret,
    // and is never used to create a row.
    requireSecret: true,
    countVisit: !hadFreshCookie,
    landingUrl,
    referrer,
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req.headers),
    cookies,
  });
  // Deliberately no `created`, and no other field that differs between a hit and a miss: the response is
  // the same shape whatever the caller presented.
  const res = NextResponse.json({ ok: true });
  const secure = req.nextUrl.protocol === "https:";
  // Both cookies are re-issued from the row that actually exists, so a browser whose pair has drifted
  // (a pre-`dk_vsec` cookie, a code that lost a collision race) converges on a provable identity instead
  // of staying unauthenticatable.
  if (visitor.code !== cookieCode) {
    res.cookies.set(VISITOR_COOKIE, visitor.code, { path: "/", maxAge: VISITOR_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false, secure });
  }
  if (rowSecret !== cookieSecret) {
    res.cookies.set(VISITOR_SECRET_COOKIE, rowSecret, { path: "/", maxAge: VISITOR_SECRET_MAX_AGE, sameSite: "lax", httpOnly: true, secure });
  }
  if (hadFreshCookie) res.cookies.set(VISITOR_FRESH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
