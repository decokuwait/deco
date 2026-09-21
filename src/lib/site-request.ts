import { cookies, headers } from "next/headers";
import { cache } from "react";
import { canonicalHost, parseHost } from "@/lib/tenant";
import { LOCALE_COOKIE, ROOT_DOMAIN, VISITOR_COOKIE } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";
import type { Locale, SiteRecord } from "@/lib/types";
import { isLocale } from "@/lib/i18n/site";
import { isValidVisitorCode } from "@/lib/visitor/code";

// Keyed by the resolved host, so the root layout (no route param) and the page / metadata / viewport
// (host param) share one lookup per request instead of each paying a database round trip.
const siteByHost = cache(async (host: string): Promise<SiteRecord | null> => {
  const info = parseHost(host, ROOT_DOMAIN);
  if (info.kind !== "site") return null;
  return getSiteByHost(info.candidates, info.subdomain);
});

/**
 * Resolve the tenant site for the current request (server components, route handlers, actions).
 *
 * `x-dk-host` is set by the proxy, which also strips any inbound copy — but only on the paths its
 * matcher covers. Requests whose path ends in an asset extension bypass the proxy entirely, so an
 * inbound `x-dk-host` survives there and used to decide which tenant a route resolved to. Every
 * candidate host is therefore checked against the host the request actually arrived on before it is
 * trusted; a mismatch falls back to the real host.
 */
export async function getRequestSite(hostParam?: string): Promise<SiteRecord | null> {
  const h = await headers();
  const real = (h.get("x-forwarded-host") || h.get("host") || "").trim().toLowerCase();
  const claimed = (hostParam || h.get("x-dk-host") || "").trim().toLowerCase();
  return siteByHost(claimed && hostsMatch(claimed, real) ? claimed : real);
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

export function clientIp(h: Headers): string | null {
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return h.get("x-real-ip") || null;
}
