import type { SectionProps } from "../../types";
import { PhoneIcon, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { AR_LEADING } from "../../leading";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone } from "../shared/helpers";

/** Two halves: a secondary-colour text half and an accent half holding a big WhatsApp button + phone number. */
export function CtaSplit({ ctx }: SectionProps) {
  const c = ctx.site.content.cta;
  const phone = ctx.site.content.contact.phone;
  const btn = ctx.def.tokens.buttonStyle;
  const subtitle = ctx.text(c.subtitle);
  return (
    <section className="grid lg:grid-cols-2">
      <div className="tone-dark relative overflow-hidden bg-secondary px-6 py-14 text-secondary-fg sm:px-12 lg:py-24">
        <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-xl text-center lg:me-0 lg:pe-8 lg:text-start">
          <span className="text-xs font-bold uppercase tracking-widest text-accent-text">{ctx.text(ctx.site.content.cta.eyebrow) || ctx.ui("get_quote")}</span>
          <h2 className={cx("mt-3 font-heading text-3xl font-black leading-tight sm:text-4xl", AR_LEADING)}>{ctx.text(c.title)}</h2>
          {subtitle && <p className="mt-4 text-base opacity-85 sm:text-lg">{subtitle}</p>}
        </div>
      </div>
      <div className="relative overflow-hidden bg-accent px-6 py-14 text-accent-fg sm:px-12 lg:py-24">
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full border-[20px] border-accent-fg/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -start-10 h-48 w-48 rounded-full bg-accent-fg/10" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-fg/10 ring-8 ring-accent-fg/5">
            <WhatsAppIcon className="h-10 w-10" />
          </span>
          <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(btn, "primary", "lg") + " w-full shadow-xl shadow-secondary/20 sm:w-auto"}>
            <WhatsAppIcon />
            {ctx.text(c.buttonText) || ctx.ui("whatsapp")}
          </WhatsAppLink>
          {phone && (
            <WhatsAppLink href={ctx.telHref} kind="call_click" className="group inline-flex min-h-11 items-center gap-3 font-heading text-2xl font-black tracking-wide sm:text-3xl">
              <PhoneIcon className="h-6 w-6 opacity-70 transition group-hover:opacity-100" />
              <span dir="ltr">{formatPhone(phone)}</span>
            </WhatsAppLink>
          )}
          <span className="text-sm font-semibold opacity-70">{ctx.ui("free_visit")}</span>
        </div>
      </div>
    </section>
  );
}
