import { headers } from "next/headers";
import { canonicalHost, parseHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl, siteUrl } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";

export const dynamic = "force-dynamic";

/**
 * robots.txt per host. Tenant sites allow crawling of the public pages (never the admin panel or APIs)
 * and point at their sitemap on the canonical host; paused or unknown hosts are closed to crawlers.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  let lines: string[];
  if (info.kind === "site") {
    const site = await getSiteByHost(info.candidates, info.subdomain).catch(() => null);
    lines =
      site && site.status === "active"
        ? ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api", `Sitemap: ${siteUrl(canonicalHost(info.host))}sitemap.xml`]
        : ["User-agent: *", "Disallow: /"];
  } else {
    lines = ["User-agent: *", "Allow: /", "Disallow: /super", "Disallow: /api", `Sitemap: ${rootUrl("/sitemap.xml")}`];
  }
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", Vary: "X-Forwarded-Host, Host" } });
}
