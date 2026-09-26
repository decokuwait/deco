import { headers } from "next/headers";
import { cache } from "react";
import { createHash } from "node:crypto";
import type { ReactNode } from "react";
import { getRequestSite, getRequestVisitorCode, clientIp } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getActivePixels } from "@/lib/db/pixels";
import { trackVisit } from "@/lib/db/visitors";
import { VISITOR_SECRET_HEADER } from "@/lib/auth/visitor-secret";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateShell } from "@/templates/render/TemplateRenderer";
import { SiteRuntime, type BrowserPixel } from "@/components/site/SiteRuntime";
import { VisitorCookie } from "@/components/site/VisitorCookie";
import { resolveEventName } from "@/lib/marketing/mapping";
import { enforcePrimaryHost, getSitePrimaryHost, primaryUrl, type PrimaryHost } from "@/lib/seo/primary-host";
import { urlLocale } from "@/lib/seo/locale";
import type { Locale, SiteData, SiteRecord } from "@/lib/types";
import type { RenderCtx, TemplateDef } from "@/templates/types";

/**
 * Shared loader and chrome for the tenant's inner public pages (`/projects`, `/services`).
 *
 * It lives under `projects/_lib` rather than `src/lib` because it is only ever used by these two page
 * trees; `services/*` imports it relatively. `_lib` is a private folder, so nothing here is
 * routable. Everything SEO-shaped (primary host, URL locale, titles, graph) comes from
 * `src/lib/seo/**` so the home page and these pages can never disagree.
 */

/** Everything an inner tenant page needs, resolved once per request. */
export interface TenantPage {
  site: SiteRecord;
  data: SiteData;
  def: TemplateDef;
  ctx: RenderCtx;
  locale: Locale;
  primary: PrimaryHost;
  /** Absolute base URL on the primary host, with a trailing slash. */
  base: string;
  visitorCode: string | null;
  fresh: boolean;
  pixels: BrowserPixel[];
  externalIdHash: string | null;
}

/** The site's brochure content, resolved once per request so `generateMetadata` and the page share it. */
const siteDataOnce = cache((site: SiteRecord) => getSiteData(site, { publishedOnly: true }));

/** Active pixels, same reason. */
const pixelsOnce = cache((siteId: string) => getActivePixels(siteId));

export interface TenantContent {
  site: SiteRecord;
  data: SiteData;
  def: TemplateDef;
  locale: Locale;
  primary: PrimaryHost;
  base: string;
}

/**
 * Site + content + primary host, with no tracking side effects — what `generateMetadata` needs.
 *
 * Returns null for an unknown host and for a paused site: an inner page of a site that is not live is a
 * 404, not a coming-soon page. Only `/` shows that.
 */
export const loadTenantContent = cache(async function loadTenantContent(hostParam: string): Promise<TenantContent | null> {
  const site = await getRequestSite(hostParam);
  if (!site || site.status !== "active") return null;
  const [locale, data, primary] = await Promise.all([
    urlLocale(site.content.settings.defaultLocale),
    siteDataOnce(site),
    getSitePrimaryHost(site),
  ]);
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  return { site, data, def, locale, primary, base: primaryUrl(primary) };
});

/**
 * The full page context, including the visitor id and the browser pixels.
 *
 * A lead who lands on `/projects/<slug>` from an ad must be attributed exactly like one who lands on the
 * home page, so this repeats the home page's first-visit insert: the visitor row has to exist before the
 * WhatsApp link that prints its id is rendered. It runs alongside the content queries, because every
 * awaited round trip here is time the visitor spends on a blank screen.
 */
export async function loadTenantPage(hostParam: string): Promise<TenantPage | null> {
  const base = await loadTenantContent(hostParam);
  if (!base) return null;
  const { site, data, def, locale } = base;
  const h = await headers();
  let visitorCode = await getRequestVisitorCode();
  const fresh = !!visitorCode && h.get("x-dk-vid-new") === "1";
  const visit =
    visitorCode && fresh
      ? trackVisit({
          siteId: site.id,
          code: visitorCode,
          // Must match the home page: the proxy already put this secret in the visitor's cookie, so the
          // row created here has to carry the same value or the browser's first /api/track fails its own
          // check and mints a second visitor row.
          secret: h.get(VISITOR_SECRET_HEADER),
          fresh: true,
          landingUrl: base.base + (h.get("x-dk-path") || "").replace(/^\//, ""),
          referrer: h.get("referer"),
          userAgent: h.get("user-agent"),
          ip: clientIp(h),
        }).then(
          (r) => r.visitor.code,
          (err: unknown) => {
            console.error("server-side visit tracking failed", err);
            return visitorCode;
          },
        )
      : Promise.resolve(visitorCode);
  const [pixels, trackedCode] = await Promise.all([pixelsOnce(site.id), visit]);
  visitorCode = trackedCode;
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
  const browserPixels: BrowserPixel[] = pixels.map((p) => ({
    platform: p.platform,
    pixelId: p.pixelId,
    adsId: p.extra?.adsId,
    adsLabel: p.extra?.adsLabel,
    events: {
      page_view: resolveEventName(p, "page_view"),
      whatsapp_click: resolveEventName(p, "whatsapp_click"),
      call_click: resolveEventName(p, "call_click"),
    },
  }));
  return {
    site,
    data,
    def,
    ctx,
    locale,
    primary: base.primary,
    base: base.base,
    visitorCode,
    fresh,
    pixels: browserPixels,
    externalIdHash: visitorCode ? createHash("sha256").update(visitorCode).digest("hex") : null,
  };
}

/**
 * Send a request that did not arrive on the site's primary host there, permanently.
 *
 * Every indexable tenant URL must do this, otherwise the subdomain and the custom
 * domain are two crawlable copies of the same project page. The original path *and query* are preserved
 * from `x-dk-path`, so `?lang=en` survives the redirect.
 */
export function enforcePrimary(page: { primary: PrimaryHost }, hostParam: string, fallbackPath: string, requestPath: string | null): void {
  enforcePrimaryHost(page.primary, hostParam, requestPath || fallbackPath);
}

/** The path (with query) the request actually arrived on, for redirects. */
export async function requestPathAndQuery(): Promise<string | null> {
  return (await headers()).get("x-dk-path");
}

/**
 * Template chrome (theme, fonts, nav, footer, floating WhatsApp) plus the tracking runtime, so an inner
 * page is indistinguishable from the home page and never loses attribution.
 */
export function TenantChrome({ page, jsonLd = [], children }: { page: TenantPage; jsonLd?: string[]; children: ReactNode }) {
  return (
    <>
      {jsonLd.map((json, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
      ))}
      <TemplateShell ctx={page.ctx}>{children}</TemplateShell>
      {page.fresh && <VisitorCookie code={page.visitorCode} />}
      {/* Same as the home page: without these the owner's consent setting has no effect here. */}
      <SiteRuntime
        visitorCode={page.visitorCode}
        externalIdHash={page.externalIdHash}
        pixels={page.pixels}
        preview={false}
        consentMode={page.site.content.settings.consentMode}
        locale={page.locale}
      />
    </>
  );
}
