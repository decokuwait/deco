import { cookies, headers } from "next/headers";
import { cache } from "react";
import { parseHost } from "@/lib/tenant";
import { LOCALE_COOKIE, ROOT_DOMAIN, VISITOR_COOKIE } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";
import type { Locale, SiteRecord } from "@/lib/types";
import { isLocale } from "@/lib/i18n/site";
import { isValidVisitorCode } from "@/lib/visitor/code";

/** Resolve the tenant site for the current request (server components, route handlers, actions). */
export const getRequestSite = cache(async (hostParam?: string): Promise<SiteRecord | null> => {
  const h = await headers();
  const host = hostParam || h.get("x-dk-host") || h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  if (info.kind !== "site") return null;
  return getSiteByHost(info.candidates, info.subdomain);
});

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
