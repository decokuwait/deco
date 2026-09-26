import type { SectionProps } from "../../types";
import { Container, PhoneIcon, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { AR_LEADING } from "../../leading";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { TAP_TARGET, formatPhone } from "../shared/helpers";

/** A thin centred line of text with an outline/underline button and generous whitespace. */
export function CtaMinimal({ ctx }: SectionProps) {
  const c = ctx.site.content.cta;
  const phone = ctx.site.content.contact.phone;
  const btn = ctx.def.tokens.buttonStyle;
  // Keep the template's shape (pill/square/underline/outline); only tone heavy fills down to an outline.
  const style = btn === "solid" || btn === "glow" ? "outline" : btn;
  const subtitle = ctx.text(c.subtitle);
  return (
    <section className="bg-bg py-20 text-fg sm:py-28 lg:py-32">
      <Container className="max-w-2xl text-center">
        <span aria-hidden className="mx-auto mb-8 block h-px w-16 bg-accent" />
        <h2 className={cx("font-heading text-2xl font-bold leading-snug sm:text-3xl", AR_LEADING)}>{ctx.text(c.title)}</h2>
        {subtitle && <p className="mt-3 text-base text-muted sm:text-lg">{subtitle}</p>}
        <div className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
          <WhatsAppLink href={ctx.whatsappHref} className={cx(buttonClass(style, "primary", "md"), TAP_TARGET)}>
            <WhatsAppIcon />
            {ctx.text(c.buttonText) || ctx.ui("whatsapp")}
          </WhatsAppLink>
          {phone && (
            <WhatsAppLink href={ctx.telHref} kind="call_click" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-muted transition hover:text-primary-text">
              <PhoneIcon className="h-4 w-4" />
              <span dir="ltr">{formatPhone(phone)}</span>
            </WhatsAppLink>
          )}
        </div>
        <span aria-hidden className="mx-auto mt-8 block h-px w-16 bg-accent" />
      </Container>
    </section>
  );
}
