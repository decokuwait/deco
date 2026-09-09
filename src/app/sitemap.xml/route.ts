import { headers } from "next/headers";
import { parseHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl, siteUrl } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";
import { TEMPLATES } from "@/templates/registry";

export const dynamic = "force-dynamic";

function xml(urls: { loc: string; lastmod?: string; priority?: string }[]) {
  const body = urls
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** sitemap.xml per host: a tenant site lists its home page; the platform lists the gallery and all previews. */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  let urls: { loc: string; lastmod?: string; priority?: string }[];
  if (info.kind === "site") {
    const site = await getSiteByHost(info.candidates, info.subdomain).catch(() => null);
    if (!site || site.status !== "active") return new Response("Not found", { status: 404 });
    urls = [{ loc: siteUrl(info.host), lastmod: site.updatedAt, priority: "1.0" }];
  } else {
    urls = [{ loc: rootUrl("/"), priority: "1.0" }, { loc: rootUrl("/templates"), priority: "0.9" }, ...TEMPLATES.map((t) => ({ loc: rootUrl(`/template/${t.code}`), priority: "0.6" }))];
  }
  return new Response(xml(urls), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
