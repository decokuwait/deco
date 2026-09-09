import type { SectionProps } from "../../types";
import { Arrow, Container, PhoneIcon, Section, SectionHeading, SocialIcon, WhatsAppIcon, socialLinks } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone } from "../shared/helpers";
import { ClockIcon, MailIcon, PinIcon } from "./icons";

const card = "group relative flex flex-col gap-4 rounded-card p-6 transition duration-200";
const label = "block text-xs font-bold uppercase tracking-wider";

/** Four info cards (WhatsApp, phone, address, hours); the first two are clickable. Socials row below. */
export function ContactCards({ ctx }: SectionProps) {
  const c = ctx.site.content.contact;
  const socials = socialLinks(ctx);
  const address = ctx.text(c.address);
  const hours = ctx.text(c.hours);
  const wa = (c.whatsapp || "").trim();
  return (
    <Section id="contact" tone="bg">
      <Container>
        <SectionHeading title={ctx.ui("nav_contact")} subtitle={ctx.ui("free_visit")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {wa && (
            <WhatsAppLink href={ctx.whatsappHref} className={card + " bg-primary text-primary-fg shadow-xl shadow-primary/25 hover:-translate-y-1"}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fg/15">
                <WhatsAppIcon className="h-6 w-6" />
              </span>
              <span>
                <span className={label + " opacity-80"}>{ctx.ui("whatsapp")}</span>
                <span className="mt-1 block font-heading text-lg font-bold">
                  <span dir="ltr" className="inline-block">
                    {formatPhone(wa)}
                  </span>
                </span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold opacity-80 transition-all group-hover:gap-2">
                {ctx.ui("get_quote")}
                <Arrow dir={ctx.dir} className="h-4 w-4" />
              </span>
            </WhatsAppLink>
          )}
          {c.phone && (
            <WhatsAppLink href={ctx.telHref} kind="call_click" className={card + " border border-line bg-surface hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:shadow-primary/10"}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <PhoneIcon className="h-6 w-6" />
              </span>
              <span>
                <span className={label + " text-muted"}>{ctx.ui("phone")}</span>
                <span className="mt-1 block font-heading text-lg font-bold">
                  <span dir="ltr" className="inline-block">
                    {formatPhone(c.phone)}
                  </span>
                </span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary transition-all group-hover:gap-2">
                {ctx.ui("call_now")}
                <Arrow dir={ctx.dir} className="h-4 w-4" />
              </span>
            </WhatsAppLink>
          )}
          {address && (
            <div className={card + " border border-line bg-surface"}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PinIcon className="h-6 w-6" />
              </span>
              <span>
                <span className={label + " text-muted"}>{ctx.ui("our_location")}</span>
                <span className="mt-1 block font-bold leading-relaxed">{address}</span>
              </span>
            </div>
          )}
          {hours && (
            <div className={card + " border border-line bg-surface"}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ClockIcon className="h-6 w-6" />
              </span>
              <span>
                <span className={label + " text-muted"}>{ctx.ui("working_hours")}</span>
                <span className="mt-1 block font-bold leading-relaxed">{hours}</span>
              </span>
            </div>
          )}
        </div>
        {(socials.length > 0 || c.email) && (
          <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-10">
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-primary">
                <MailIcon className="h-4 w-4" />
                <span dir="ltr">{c.email}</span>
              </a>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="me-1 text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("follow_us")}</span>
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-fg transition hover:border-primary hover:bg-primary hover:text-primary-fg"
                  >
                    <SocialIcon name={s.key} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
    </Section>
  );
}
