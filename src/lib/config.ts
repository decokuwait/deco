export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").toLowerCase();
export const IS_PROD = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = "dk_session";
export const VISITOR_COOKIE = "dk_vid";
export const VISITOR_FRESH_COOKIE = "dk_vid_new";
export const LOCALE_COOKIE = "dk_lang";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const APP_NAME = "DecoKuwait";

function isLocal(host: string) {
  return host.startsWith("localhost") || host.endsWith(".localhost") || /\.localhost:\d+$/.test(host) || host.startsWith("127.0.0.1");
}

export function rootUrl(path = "/"): string {
  const proto = isLocal(ROOT_DOMAIN) ? "http" : "https";
  return `${proto}://${ROOT_DOMAIN}${path}`;
}

export function siteUrl(host: string, path = "/"): string {
  const proto = isLocal(host) ? "http" : "https";
  // Tenant hosts are stored without a port; locally the platform runs on one, so put it back.
  const withPort = isLocal(host) && !/:\d+$/.test(host) ? `${host}${rootPort()}` : host;
  return `${proto}://${withPort}${path}`;
}

/** Port of the root domain (e.g. ":3000" locally, "" in production). */
export function rootPort(): string {
  const m = ROOT_DOMAIN.match(/:(\d+)$/);
  return m ? `:${m[1]}` : "";
}
