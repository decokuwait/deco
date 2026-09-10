import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRequestSite, getRequestLocale, getRequestVisitorCode } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateShell } from "@/templates/render/TemplateRenderer";
import { Container } from "@/templates/ui/primitives";
import { lt } from "@/lib/i18n/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site) return { title: "Not found" };
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  return { title: `${lt(locale, site.content.legal.privacyTitle)} — ${lt(locale, site.content.brand.name) || site.name}`, robots: { index: false } };
}

/** Privacy policy page rendered inside the site's own template chrome (required by ad platforms). */
export default async function PrivacyPage({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await getRequestSite(host);
  if (!site || site.status !== "active") notFound();
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
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
