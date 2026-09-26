import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getRequestSite, getRequestVisitorCode } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateShell } from "@/templates/render/TemplateRenderer";
import { Container } from "@/templates/ui/primitives";
import { lt } from "@/lib/i18n/site";
import { enforcePrimaryHost, getSitePrimaryHost, primaryUrl } from "@/lib/seo/primary-host";
import { urlLocale } from "@/lib/seo/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const locale = await urlLocale(site.content.settings.defaultLocale);
  const primary = await getSitePrimaryHost(site);
  return {
    title: `${lt(locale, site.content.legal.privacyTitle)} — ${lt(locale, site.content.brand.name) || site.name}`,
    metadataBase: new URL(primaryUrl(primary)),
    // Kept out of the index (it is boilerplate every tenant shares) and out of the sitemap with it: a URL
    // submitted for indexing that answers `noindex` is a contradiction Search Console reports as an error.
    robots: { index: false, follow: true },
    alternates: { canonical: primaryUrl(primary, "/privacy") },
  };
}

/** Privacy policy page rendered inside the site's own template chrome (required by ad platforms). */
export default async function PrivacyPage({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site || site.status !== "active") notFound();
  const primary = await getSitePrimaryHost(site);
  const h = await headers();
  enforcePrimaryHost(primary, host, h.get("x-dk-path") || "/privacy");
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const locale = await urlLocale(site.content.settings.defaultLocale);
  const visitorCode = await getRequestVisitorCode();
  const data = await getSiteData(site, { publishedOnly: true });
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
  const text = ctx.text(site.content.legal.privacy);
  return (
    <TemplateShell ctx={ctx}>
      <section className="bg-bg py-16 sm:py-24">
        <Container className="max-w-3xl">
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{ctx.text(site.content.legal.privacyTitle)}</h1>
          <div className="mt-8 space-y-4 text-lg leading-relaxed text-muted">
            {text.split(/\n{2,}|\n/).filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Container>
      </section>
    </TemplateShell>
  );
}
