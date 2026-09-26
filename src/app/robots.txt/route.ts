import { headers } from "next/headers";
import { isIndexableRootHost, parseHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";
import { getSitePrimaryHost, primaryUrl } from "@/lib/seo/primary-host";
import { robotsBody, type RobotsAudience } from "@/lib/seo/robots";

export const dynamic = "force-dynamic";

/**
 * robots.txt per host.
 *
 * Three rules this file now enforces that it did not before:
 *  - the `Sitemap:` line points at the site's PRIMARY host, never at the host the request arrived on;
 *  - a PAUSED site is `Allow: /` so Googlebot can fetch the page and read its `noindex` — blocking it
 *    is what kept paused URLs in the index with no snippet;
 *  - a host that is neither the root domain nor a tenant (a `*.vercel.app` deployment above all) is
 *    closed, instead of serving an indexable copy of the whole platform.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  let audience: RobotsAudience;
  if (info.kind === "site") {
    const site = await getSiteByHost(info.candidates, info.subdomain).catch(() => null);
    if (!site) audience = { kind: "unknown" };
    else if (site.status !== "active") audience = { kind: "tenant-paused" };
    else {
      const primary = await getSitePrimaryHost(site);
      audience = { kind: "tenant", sitemap: primaryUrl(primary, "/sitemap.xml") };
    }
  } else {
    audience = isIndexableRootHost(host, ROOT_DOMAIN) ? { kind: "platform", sitemap: rootUrl("/sitemap.xml") } : { kind: "platform-blocked" };
  }
  return new Response(robotsBody(audience), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Vary: "X-Forwarded-Host, Host",
      ...(audience.kind === "platform-blocked" || audience.kind === "unknown" ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    },
  });
}
