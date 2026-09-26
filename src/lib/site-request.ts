import { cookies, headers } from "next/headers";
import { cache } from "react";
import { canonicalHost, parseHost } from "@/lib/tenant";
import { LOCALE_COOKIE, ROOT_DOMAIN, VISITOR_COOKIE } from "@/lib/config";
import { classifyDbError, type DbFailure } from "@/lib/db/client";
import { getSiteByHost } from "@/lib/db/sites";
import { reportError } from "@/lib/observability";
import type { Locale, SiteRecord } from "@/lib/types";
import { isLocale } from "@/lib/i18n/site";
import { isValidVisitorCode } from "@/lib/visitor/code";

/**
 * The three things that can come back from resolving a host, kept apart on purpose.
 *
 * `missing` and `unavailable` used to be the same thing to every caller — an exception — and the tenant
 * root layout (`src/app/tenant/layout.tsx`) is the *root* layout of that tree, so a throw there is
 * catchable only by `global-error`, which cannot know the tenant's language. A Supabase blip therefore
 * served a paying Arabic customer's own domain Next's unbranded English LTR fallback. They are now
 * distinct: `missing` is a 404 (nothing is configured on this host), `unavailable` is "come back in a
 * minute" and must render a holding page instead of an error.
 */
export type SiteResolution =
  | { status: "ok"; site: SiteRecord }
  | { status: "missing"; site: null }
  | { status: "unavailable"; site: null; failure: DbFailure | null };

const MISSING: SiteResolution = { status: "missing", site: null };

// Keyed by the resolved host, so the root layout (no route param) and the page / metadata / viewport
// (host param) share one lookup per request instead of each paying a database round trip. The try/catch
// lives INSIDE the cached function so a failed lookup is deduplicated too: without it, every consumer of
// a broken request would open its own connection to a database that is already known to be down, and
// React would re-throw the same rejection at each of them.
const resolveByHost = cache(async (host: string): Promise<SiteResolution> => {
  const info = parseHost(host, ROOT_DOMAIN);
  if (info.kind !== "site") return MISSING;
  try {
    const site = await getSiteByHost(info.candidates, info.subdomain);
    return site ? { status: "ok", site } : MISSING;
  } catch (e) {
    // classifyDbError returns null for an error about the *query* — a bug on our side rather than an
    // outage. Both are still reported and both still render the holding page: a bug in host resolution
    // breaking one customer's whole domain with an English error page is not an improvement on a bug in
    // host resolution showing them "we'll be right back". The severity is what tells the two apart.
    const failure = classifyDbError(e);
    await reportError(e, {
      source: "site-lookup",
      severity: failure ? "warning" : "error",
      fields: { host, subdomain: info.subdomain, failure: failure ?? "unclassified" },
    });
    return { status: "unavailable", site: null, failure };
  }
});

/** The host this request actually arrived on, after the `x-dk-host` spoofing check. */
async function requestHost(hostParam?: string): Promise<string> {
  const h = await headers();
  const real = (h.get("x-forwarded-host") || h.get("host") || "").trim().toLowerCase();
  const claimed = (hostParam || h.get("x-dk-host") || "").trim().toLowerCase();
  return claimed && hostsMatch(claimed, real) ? claimed : real;
}

/**
 * Resolve the tenant site for the current request, distinguishing "no site here" from "the database is
 * not answering". **Never throws** — that is the whole point; the tenant root layout renders from this.
 *
 * `x-dk-host` is set by the proxy, which also strips any inbound copy — but only on the paths its
 * matcher covers. Requests whose path ends in an asset extension bypass the proxy entirely, so an
 * inbound `x-dk-host` survives there and used to decide which tenant a route resolved to. Every
 * candidate host is therefore checked against the host the request actually arrived on before it is
 * trusted; a mismatch falls back to the real host.
 */
export async function resolveRequestSite(hostParam?: string): Promise<SiteResolution> {
  return resolveByHost(await requestHost(hostParam));
}

/**
 * The site, or null when there is none *or* when the database could not answer.
 *
 * Callers that only ever render a 404 for a missing site keep using this. Anything that has to tell a
 * visitor why — the tenant root layout above all — must use `resolveRequestSite` instead, so an outage
 * does not masquerade as "this site does not exist".
 */
export async function getRequestSite(hostParam?: string): Promise<SiteRecord | null> {
  return (await resolveRequestSite(hostParam)).site;
}

/** True when a claimed host is the same host the request arrived on, ignoring the port and `www.`. */
function hostsMatch(claimed: string, real: string): boolean {
  if (!real) return false;
  return canonicalHost(claimed) === canonicalHost(real);
}

/** Language of the current request: `?lang=` (forwarded by the proxy as a header) wins over the cookie. */
export async function getRequestLocale(fallback: Locale = "ar"): Promise<Locale> {
  const h = await headers();
  const fromQuery = h.get("x-dk-lang");
  if (isLocale(fromQuery)) return fromQuery;
  const c = await cookies();
  const v = c.get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : fallback;
}

export async function getRequestVisitorCode(): Promise<string | null> {
  const h = await headers();
  const fromHeader = h.get("x-dk-vid");
  if (isValidVisitorCode(fromHeader)) return fromHeader;
  const c = await cookies();
  const v = c.get(VISITOR_COOKIE)?.value;
  return isValidVisitorCode(v) ? v : null;
}

/** Strip a trailing port, IPv6 brackets and surrounding noise; reject anything that cannot be an address. */
function cleanIp(raw: string): string | null {
  let v = raw.trim();
  if (!v || v.length > 60) return null;
  if (v.startsWith("[")) v = v.slice(1, v.indexOf("]") > 0 ? v.indexOf("]") : undefined);
  else if (v.includes(".") && v.includes(":")) v = v.slice(0, v.indexOf(":")); // 1.2.3.4:5678
  return /^[0-9a-fA-F:.]+$/.test(v) ? v.toLowerCase() : null;
}

/**
 * The visitor's IP address, or null.
 *
 * Only the platform edge is trusted. `x-vercel-forwarded-for` and `x-real-ip` are written by Vercel
 * itself and any inbound copy is overwritten, so they are taken first. `x-forwarded-for` is a list that
 * a client can prepend to at will: reading its FIRST entry — which is what this did — let anyone choose
 * the identity used for rate limiting and for the IP recorded against a visitor, simply by sending the
 * header. The fallback therefore reads the LAST entry, the one the nearest proxy appended and the only
 * one no client could have written. With no proxy at all (local `next dev`) there is no header and no IP.
 */
export function clientIp(h: Headers): string | null {
  const edge = h.get("x-vercel-forwarded-for") || h.get("x-real-ip");
  if (edge) return cleanIp(edge.split(",")[0]);
  const xf = h.get("x-forwarded-for");
  if (!xf) return null;
  const hops = xf.split(",").filter((p) => p.trim());
  return hops.length ? cleanIp(hops[hops.length - 1]) : null;
}
