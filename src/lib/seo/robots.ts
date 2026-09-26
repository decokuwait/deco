export type RobotsAudience =
  | { kind: "platform"; sitemap: string }
  | { kind: "platform-blocked" }
  | { kind: "tenant"; sitemap: string }
  | { kind: "tenant-paused" }
  | { kind: "unknown" };

/**
 * robots.txt for one host.
 *
 * The paused case is the interesting one. A paused site answered 200 with a "coming soon" body carrying
 * `noindex`, while robots.txt for that same host said `Disallow: /`. Googlebot therefore never fetched
 * the page, never saw the `noindex`, and indexed the URL from links alone with no snippet — the classic
 * "why is my blocked page still in Google" failure. A directive you need a crawler to READ must be on a
 * page the crawler is ALLOWED to fetch, so a paused site is open to crawling and says `noindex` in the
 * page (and answers 503 while it is paused, which is the proxy's half of the fix).
 *
 * `platform-blocked` covers every host that is neither the root domain nor a tenant — deployment URLs
 * above all. `*.vercel.app` served the entire platform and answered `Allow: /`, so the preview
 * deployment was a fully indexable clone of the money domain.
 */
export function robotsLines(audience: RobotsAudience): string[] {
  switch (audience.kind) {
    case "platform":
      return ["User-agent: *", "Allow: /", "Disallow: /super", "Disallow: /api", "", `Sitemap: ${audience.sitemap}`];
    case "tenant":
      return ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api", "", `Sitemap: ${audience.sitemap}`];
    case "tenant-paused":
      return ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api"];
    case "platform-blocked":
    case "unknown":
      return ["User-agent: *", "Disallow: /"];
  }
}

export function robotsBody(audience: RobotsAudience): string {
  return robotsLines(audience).join("\n") + "\n";
}
