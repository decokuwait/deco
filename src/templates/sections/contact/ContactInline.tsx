import type { SectionProps } from "../../types";
import { Container, PhoneIcon, SocialIcon, WhatsAppIcon, buttonClass, socialLinks } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone } from "../shared/helpers";
import { ClockIcon, PinIcon } from "./icons";

/** Single compact bar on the primary colour: address · hours · phone · WhatsApp button, socials at the end. */
export function ContactInline({ ctx }: SectionProps) {
  const c = ctx.site.content.contact;
  const socials = socialLinks(ctx);
  const btn = ctx.def.tokens.buttonStyle;
  const address = ctx.text(c.address);
  const hours = ctx.text(c.hours);
  return (
    <section id="contact" className="relative overflow-hidden bg-primary text-primary-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-30" />
      <Container wide className="relative flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <h2 className="font-heading text-xl font-extrabold sm:border-e sm:border-primary-fg/25 sm:pe-6">{ctx.text(c.title) || ctx.ui("nav_contact")}</h2>
          <ul className="flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:[&>li+li]:border-s sm:[&>li+li]:border-primary-fg/25 sm:[&>li+li]:ps-6">
            {address && (
              <li className="flex items-center gap-2">
                <PinIcon className="h-4 w-4 shrink-0 opacity-80" />
                {address}
              </li>
            )}
            {hours && (
              <li className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 shrink-0 opacity-80" />
                {hours}
              </li>
            )}
            {c.phone && (
              <li>
                <WhatsAppLink href={ctx.telHref} kind="call_click" className="flex items-center gap-2 transition hover:text-accent">
                  <PhoneIcon className="h-4 w-4 shrink-0 opacity-80" />
                  <span dir="ltr">{formatPhone(c.phone)}</span>
                </WhatsAppLink>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-6">
          <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(btn, "accent", "md")}>
            <WhatsAppIcon />
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
          {socials.length > 0 && (
            <div className="flex justify-center gap-1.5">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fg/10 transition hover:bg-primary-fg hover:text-primary"
                >
                  <SocialIcon name={s.key} className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
