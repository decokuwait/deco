import { headers } from "next/headers";
import { parseHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/** robots.txt per host: tenant sites allow crawling of the home page only; the platform root exposes the gallery. */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  const lines =
    info.kind === "site"
      ? ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api", `Sitemap: ${siteUrl(info.host)}sitemap.xml`]
      : ["User-agent: *", "Allow: /", "Disallow: /super", "Disallow: /api", `Sitemap: ${rootUrl("/sitemap.xml")}`];
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
