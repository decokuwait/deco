import type { SectionProps } from "../../types";
import { Container, PhoneIcon, SocialIcon, WhatsAppIcon, buttonClass, cx, socialLinks } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { TAP_TARGET, formatPhone, headingLeading } from "../shared/helpers";
import { ClockIcon, MailIcon, PinIcon } from "./icons";
import { safeMapEmbed } from "@/lib/safe-url";

/** Full-bleed map (or patterned fallback) with a floating info panel; the map stays interactive. */
export function ContactMap({ ctx }: SectionProps) {
  const c = ctx.site.content.contact;
  const socials = socialLinks(ctx);
  const btn = ctx.def.tokens.buttonStyle;
  const mapUrl = safeMapEmbed(c.mapEmbedUrl);
  const hasMap = mapUrl.length > 0;
  const address = ctx.text(c.address);
  const hours = ctx.text(c.hours);
  return (
    <section id="contact" className="relative overflow-hidden bg-surface-2 text-fg">
      <div className="absolute inset-0">
        {hasMap ? (
          <iframe src={mapUrl} className="h-full w-full" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer-when-downgrade" allowFullScreen title={ctx.ui("our_location")} />
        ) : (
          <div className="relative h-full w-full">
            <div aria-hidden className="pattern-bg absolute inset-0 opacity-70" />
            <div aria-hidden className="absolute inset-0 flex items-center justify-center">
              <PinIcon className="h-40 w-40 text-primary-text/10 sm:h-64 sm:w-64" />
            </div>
          </div>
        )}
      </div>
      <Container className={cx("pointer-events-none relative flex", hasMap ? "min-h-[640px] items-end pb-8 pt-72 lg:items-center lg:py-20" : "min-h-[520px] items-center py-16 lg:py-20")}>
        <div className="pointer-events-auto w-full max-w-md rounded-card border border-line bg-bg/95 p-6 shadow-2xl shadow-secondary/25 backdrop-blur sm:p-8">
          {ctx.text(c.subtitle) && <span className="text-xs font-bold uppercase tracking-widest text-accent-text">{ctx.text(c.subtitle)}</span>}
          <h2 className={cx("mt-2 font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{ctx.text(c.title) || ctx.ui("nav_contact")}</h2>
          <div className="mt-6 flex flex-col gap-3">
            <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(btn, "primary", "lg")}>
              <WhatsAppIcon />
              {ctx.ui("whatsapp")}
            </WhatsAppLink>
            {c.phone && (
              <WhatsAppLink href={ctx.telHref} kind="call_click" className={cx(buttonClass(btn, "ghost", "md"), TAP_TARGET)}>
                <PhoneIcon />
                {ctx.ui("call_now")}
              </WhatsAppLink>
            )}
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            {address && (
              <li className="flex items-start gap-3">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
                <span>
                  <span className="block text-xs font-bold text-muted">{ctx.ui("our_location")}</span>
                  <span className="font-semibold">{address}</span>
                </span>
              </li>
            )}
            {hours && (
              <li className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
                <span>
                  <span className="block text-xs font-bold text-muted">{ctx.ui("working_hours")}</span>
                  <span className="font-semibold">{hours}</span>
                </span>
              </li>
            )}
            {c.phone && (
              <li className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
                <span>
                  <span className="block text-xs font-bold text-muted">{ctx.ui("phone")}</span>
                  <span dir="ltr" className="inline-block font-semibold">
                    {formatPhone(c.phone)}
                  </span>
                </span>
              </li>
            )}
            {c.email && (
              <li className="flex items-start gap-3">
                <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" />
                <span>
                  <span className="block text-xs font-bold text-muted">{ctx.ui("email")}</span>
                  <a href={`mailto:${c.email}`} dir="ltr" className="-my-2 inline-flex min-h-11 items-center font-semibold transition hover:text-primary-text">
                    {c.email}
                  </a>
                </span>
              </li>
            )}
          </ul>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-fg transition hover:bg-primary hover:text-primary-fg"
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
