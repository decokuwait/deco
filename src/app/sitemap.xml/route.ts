import { headers } from "next/headers";
import { canonicalHost, parseHost } from "@/lib/tenant";
import { ROOT_DOMAIN, rootUrl, siteUrl } from "@/lib/config";
import { getSiteByHost } from "@/lib/db/sites";
import { TEMPLATES } from "@/templates/registry";

export const dynamic = "force-dynamic";

interface Entry {
  loc: string;
  lastmod?: string;
  priority?: string;
  alternates?: { lang: string; href: string }[];
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function xml(urls: Entry[]) {
  const body = urls
    .map((u) => {
      const alts = (u.alternates ?? []).map((a) => `<xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(a.href)}"/>`).join("");
      return `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}${alts}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

/**
 * sitemap.xml per host: a tenant site lists its home page (in both languages when the language toggle is
 * on) and its privacy page; the platform lists the gallery and every template preview.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const info = parseHost(host, ROOT_DOMAIN);
  let urls: Entry[];
  if (info.kind === "site") {
    const site = await getSiteByHost(info.candidates, info.subdomain).catch(() => null);
    if (!site || site.status !== "active") return new Response("Not found", { status: 404 });
    const base = siteUrl(canonicalHost(info.host));
    const def = site.content.settings.defaultLocale;
    const other = def === "ar" ? "en" : "ar";
    const alternates = site.content.settings.showLangToggle
      ? [
          { lang: def, href: base },
          { lang: other, href: `${base}?lang=${other}` },
          { lang: "x-default", href: base },
        ]
      : undefined;
    urls = [{ loc: base, lastmod: site.updatedAt, priority: "1.0", alternates }];
    if (alternates) urls.push({ loc: `${base}?lang=${other}`, lastmod: site.updatedAt, priority: "0.8", alternates });
    urls.push({ loc: `${base}privacy`, lastmod: site.updatedAt, priority: "0.2" });
  } else {
    urls = [{ loc: rootUrl("/"), priority: "1.0" }, { loc: rootUrl("/templates"), priority: "0.9" }, ...TEMPLATES.map((t) => ({ loc: rootUrl(`/template/${t.code}`), priority: "0.6" }))];
  }
  return new Response(xml(urls), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
