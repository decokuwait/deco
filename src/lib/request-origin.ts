/**
 * Same-ORIGIN check for the public write endpoints.
 *
 * `/api/track` and `/api/track/event` accept a JSON body, but a cross-site `fetch` with
 * `Content-Type: text/plain` is a "simple request": no preflight, so CORS never gets a say and the
 * handler runs. `SameSite=Lax` keeps the visitor cookie off that request, which means a third-party page
 * could make every one of its own visitors mint a brand-new visitor row on any tenant site.
 *
 * `Sec-Fetch-Site: same-site` is NOT good enough here and used to be accepted. Every tenant lives on a
 * subdomain of one registrable domain, so `evil.decokuwait.com` is *same-site* with
 * `victim.decokuwait.com` — the precise abuse this file exists to stop, waved through by the header. A
 * same-site request is therefore sent on to the `Origin`/host comparison, which compares the full host.
 *
 * A request with neither header is not a browser page request at all (curl, server-side calls, the smoke
 * tests) and is reported as "unknown".
 */
export type SiteCheck = "same-origin" | "cross-site" | "unknown";

export function requestSiteRelation(h: Headers): SiteCheck {
  const fetchSite = h.get("sec-fetch-site");
  // "none" is a user-initiated navigation (address bar, bookmark): no initiator to be cross about.
  if (fetchSite === "same-origin" || fetchSite === "none") return "same-origin";
  if (fetchSite === "cross-site") return "cross-site";

  // "same-site" and browsers that send no Sec-Fetch-Site at all both land here.
  const origin = h.get("origin");
  if (!origin || origin === "null") return fetchSite ? "cross-site" : "unknown";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "cross-site";
  try {
    const o = new URL(origin).host.toLowerCase();
    return o === host.toLowerCase() ? "same-origin" : "cross-site";
  } catch {
    return "cross-site";
  }
}

/**
 * True when the request demonstrably came from another origin.
 *
 * "unknown" is deliberately permissive, and only here: a caller with no `Origin` and no `Sec-Fetch-Site`
 * is not a browser page, so it cannot be a cross-site *victim* being used as a weapon — it is someone
 * calling the endpoint directly, which the rate limiter and (on `/api/track`) the visitor secret already
 * account for. Refusing it would break the smoke tests, the e2e harness and every server-side probe
 * without stopping anything a real attacker cannot trivially re-send.
 */
export function isCrossSite(h: Headers): boolean {
  return requestSiteRelation(h) === "cross-site";
}

/**
 * Guard for the authenticated upload endpoints (`/api/upload`, `/api/upload/local`).
 *
 * Server Actions get Next's built-in Origin/Host CSRF check; a plain route handler gets nothing, so it is
 * done here. Two conditions, because either one alone leaks. The origin check refuses a request that
 * announces a foreign initiator. The content-type check refuses everything outside `allow`, and `allow`
 * never contains one of the three types a cross-origin `fetch` may send without a preflight
 * (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`) — so a foreign page cannot
 * reach these handlers without a preflight we never answer.
 *
 * Returns the refusal reason, or null when the request may proceed.
 */
export function crossOriginRefusal(h: Headers, allow: readonly string[] = ["application/json"]): "cross_site" | "bad_content_type" | null {
  if (isCrossSite(h)) return "cross_site";
  const ct = (h.get("content-type") || "").split(";")[0].trim().toLowerCase();
  return allow.includes(ct) ? null : "bad_content_type";
}

/**
 * A caller-supplied URL, but only when it points at the host the request arrived on.
 *
 * The tracking endpoints take the page URL from the request body and feed it straight into attribution
 * detection, so `https://anything/?fbclid=<mine>` was a way to write somebody else's click id onto a row
 * as though the visitor had arrived from that ad. A landing on this site is a URL on this site.
 * Relative paths are resolved against the request host and kept.
 */
export function sameHostUrl(h: Headers, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase();
  if (!host) return null;
  try {
    const u = new URL(raw, `https://${host}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.host.toLowerCase() !== host) return null;
    return u.toString().slice(0, 2000);
  } catch {
    return null;
  }
}
