/**
 * Same-site check for the public write endpoints.
 *
 * `/api/track` and `/api/track/event` accept a JSON body, but a cross-site `fetch` with
 * `Content-Type: text/plain` is a "simple request": no preflight, so CORS never gets a say and the
 * handler runs. `SameSite=Lax` keeps the visitor cookie off that request, which means a third-party page
 * could make every one of its own visitors mint a brand-new visitor row on any tenant site.
 *
 * Browsers that send `Sec-Fetch-Site` (all current ones) are judged by it; the rest fall back to
 * comparing `Origin` with the host the request arrived on. A request with neither header is not a
 * browser page request at all (curl, a beacon replay, server-side calls) and is allowed through so the
 * endpoints stay usable from tests and tooling — the rate limiter still applies to it.
 */
export type SiteCheck = "same-origin" | "cross-site" | "unknown";

export function requestSiteRelation(h: Headers): SiteCheck {
  const fetchSite = h.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none" ? "same-origin" : "cross-site";

  const origin = h.get("origin");
  if (!origin || origin === "null") return "unknown";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "cross-site";
  try {
    const o = new URL(origin).host.toLowerCase();
    return o === host.toLowerCase() ? "same-origin" : "cross-site";
  } catch {
    return "cross-site";
  }
}

export function isCrossSite(h: Headers): boolean {
  return requestSiteRelation(h) === "cross-site";
}
