import type { SectionProps } from "../../types";
import { Container, Img, PhoneIcon, SocialIcon, WhatsAppIcon, buttonClass, cx, socialLinks } from "../../ui/primitives";
import { AR_LEADING } from "../../leading";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { TAP_TARGET, formatPhone, legalLinks, navLinks } from "../shared/helpers";
import { ClockIcon, MailIcon, PinIcon } from "../contact/icons";

const heading = "font-heading text-sm font-bold uppercase tracking-widest text-accent-text";

/** Secondary-colour footer with an accent top bar, a watermark brand name, two link columns and a contact block. */
export function FooterBig({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const socials = socialLinks(ctx);
  const year = new Date().getFullYear();
  const name = ctx.text(c.brand.name);
  const tagline = ctx.text(c.brand.tagline);
  const btn = ctx.def.tokens.buttonStyle;
  const services = c.services.items.slice(0, 6);
  const address = ctx.text(c.contact.address);
  const hours = ctx.text(c.contact.hours);
  return (
    <footer className="tone-dark relative overflow-hidden bg-secondary text-secondary-fg">
      <div aria-hidden className="h-2 bg-accent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden text-center">
        <span className="-mb-[0.22em] block whitespace-nowrap font-heading text-[24vw] font-black leading-none text-secondary-fg/5 lg:text-[15vw]">{name}</span>
      </div>
      <Container wide className={cx("relative grid gap-10 py-14 sm:grid-cols-2 lg:gap-8 lg:py-20", services.length ? "lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]" : "lg:grid-cols-[1.4fr_1fr_1.3fr]")}>
        <div className="sm:col-span-2 lg:col-span-1">
          {c.brand.logoUrl ? <Img src={c.brand.logoUrl} alt={name} ratio={null} className="mb-4 h-12 w-auto object-contain" /> : null}
          <div className={cx("font-heading text-3xl font-black leading-tight sm:text-4xl", AR_LEADING)}>{name}</div>
          {tagline && <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-80">{tagline}</p>}
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary-fg/20 transition hover:border-accent hover:bg-accent hover:text-accent-fg"
                >
                  <SocialIcon name={s.key} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className={heading}>{ctx.ui("quick_links")}</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {navLinks(ctx).map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex min-h-6 items-center transition hover:text-accent">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {services.length > 0 && (
          <div>
            <h3 className={heading}>{ctx.ui("nav_services")}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {services.map((s) => (
                <li key={s.id}>
                  <a href="/#services" className="inline-flex min-h-6 items-center transition hover:text-accent">
                    {ctx.text(s.title)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-card border border-secondary-fg/10 bg-secondary-fg/5 p-5">
          <h3 className={heading}>{ctx.ui("nav_contact")}</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {address && (
              <li className="flex items-start gap-3">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{address}</span>
              </li>
            )}
            {hours && (
              <li className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{hours}</span>
              </li>
            )}
            {c.contact.phone && (
              <li className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <WhatsAppLink href={ctx.telHref} kind="call_click" className="inline-flex min-h-11 items-center -my-2 transition hover:text-accent">
                  <span dir="ltr" className="inline-block">
                    {formatPhone(c.contact.phone)}
                  </span>
                </WhatsAppLink>
              </li>
            )}
            {c.contact.email && (
              <li className="flex items-start gap-3">
                <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <a href={`mailto:${c.contact.email}`} dir="ltr" className="-my-2 inline-flex min-h-11 items-center transition hover:text-accent">
                  {c.contact.email}
                </a>
              </li>
            )}
          </ul>
          <WhatsAppLink href={ctx.whatsappHref} className={cx(buttonClass(btn, "accent", "md"), TAP_TARGET, "mt-5 w-full")}>
            <WhatsAppIcon />
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
        </div>
      </Container>
      <div className="relative border-t border-secondary-fg/10">
        <Container wide className="flex flex-col items-center justify-between gap-3 py-5 text-xs opacity-80 sm:flex-row">
          <span>
            © {year} {name} — {ctx.ui("rights")}
            {legalLinks(ctx).map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center ms-3 underline underline-offset-2 hover:text-accent">
                {l.label}
              </a>
            ))}
          </span>
        </Container>
      </div>
    </footer>
  );
}
