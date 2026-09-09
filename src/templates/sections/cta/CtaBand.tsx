import type { SectionProps } from "../../types";
import { Container, WhatsAppIcon, buttonClass } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Full-width primary band with a single strong call to action. */
export function CtaBand({ ctx }: SectionProps) {
  const c = ctx.site.content.cta;
  return (
    <section className="relative overflow-hidden bg-primary text-primary-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-40" />
      <div aria-hidden className="absolute -end-20 -top-20 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <Container className="relative flex flex-col items-center gap-6 py-16 text-center sm:py-20 lg:flex-row lg:justify-between lg:text-start">
        <div>
          <h2 className="font-heading text-3xl font-black sm:text-4xl">{ctx.text(c.title)}</h2>
          {ctx.text(c.subtitle) && <p className="mt-3 max-w-2xl text-base opacity-90 sm:text-lg">{ctx.text(c.subtitle)}</p>}
        </div>
        <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "accent", "lg") + " shrink-0"}>
          <WhatsAppIcon />
          {ctx.text(c.buttonText) || ctx.ui("whatsapp")}
        </WhatsAppLink>
      </Container>
    </section>
  );
}
