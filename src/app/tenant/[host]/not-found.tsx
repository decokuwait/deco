import { getRequestSite, getRequestLocale, getRequestVisitorCode } from "@/lib/site-request";
import { getSiteData } from "@/lib/db/sites";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateShell } from "@/templates/render/TemplateRenderer";
import { Btn, Container } from "@/templates/ui/primitives";
import { WhatsAppLink } from "@/templates/ui/client/WhatsAppLink";

/**
 * 404 page of a tenant host. When the host belongs to a site it is rendered inside that site's own
 * template (colours, fonts, nav, WhatsApp); an unassigned host gets a neutral, unbranded message.
 */
export default async function TenantNotFound() {
  const site = await getRequestSite();
  if (!site) {
    return (
      <main dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 px-6 text-center text-neutral-800">
        <span className="text-6xl font-black text-neutral-300">404</span>
        <h1 className="text-2xl font-extrabold">لا يوجد موقع على هذا العنوان</h1>
        <p className="text-neutral-500">No website is configured for this address.</p>
      </main>
    );
  }
  const locale = await getRequestLocale(site.content.settings.defaultLocale);
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const visitorCode = await getRequestVisitorCode();
  const data = await getSiteData(site, { publishedOnly: true });
  const ctx = buildCtx({ site: data, def, locale, visitorCode, preview: false });
  return (
    <TemplateShell ctx={ctx}>
      <section className="bg-bg py-20 sm:py-28">
        <Container className="max-w-2xl text-center">
          <span className="font-heading text-7xl font-black text-primary/20 sm:text-8xl">404</span>
          <h1 className="mt-4 font-heading text-3xl font-extrabold sm:text-4xl">{ctx.ui("not_found_title")}</h1>
          <p className="mt-4 text-lg text-muted">{ctx.ui("not_found_text")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Btn ctx={ctx} href="/" variant="primary" size="lg">
              {ctx.ui("back_home")}
            </Btn>
            <WhatsAppLink href={ctx.whatsappHref} className="inline-flex items-center rounded-full border border-line px-6 py-3 font-bold text-fg hover:bg-surface-2">
              {ctx.ui("whatsapp")}
            </WhatsAppLink>
          </div>
        </Container>
      </section>
    </TemplateShell>
  );
}
