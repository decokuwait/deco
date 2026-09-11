import { getRequestSite } from "@/lib/site-request";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { effectiveTokens } from "@/templates/ctx";
import { lt } from "@/lib/i18n/site";
import type { SiteData } from "@/lib/types";

export const dynamic = "force-dynamic";

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
}

/**
 * Fallback favicon for sites that have not uploaded one: a monogram of the brand name in the site's
 * primary colour (SVG, so it stays crisp in every tab size). Served at `/icon` on the tenant host.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return new Response("Not found", { status: 404 });
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const tokens = effectiveTokens(def, { content: site.content } as SiteData);
  const name = (lt(site.content.settings.defaultLocale, site.content.brand.name) || site.name).trim();
  const letter = Array.from(name)[0] ?? "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="${tokens.primary}"/><text x="32" y="44" text-anchor="middle" font-family="'Segoe UI', Tahoma, 'Noto Sans Arabic', system-ui, sans-serif" font-size="34" font-weight="700" fill="${tokens.primaryFg}">${escapeXml(letter)}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
