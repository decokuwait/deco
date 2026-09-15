import type { SectionProps } from "../../types";
import { Container, PhoneIcon, Section, SectionHeading, SocialIcon, WhatsAppIcon, buttonClass, socialLinks } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone } from "../shared/helpers";
import { safeMapEmbed } from "@/lib/safe-url";

/** Contact details + big WhatsApp/call buttons beside an optional map embed. */
export function ContactSplit({ ctx }: SectionProps) {
  const c = ctx.site.content.contact;
  const socials = socialLinks(ctx);
  const btn = ctx.def.tokens.buttonStyle;
  return (
    <Section id="contact" tone="surface" pattern>
      <Container>
        <SectionHeading title={ctx.text(c.title) || ctx.ui("nav_contact")} subtitle={ctx.text(c.subtitle)} />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-card border border-line bg-bg p-6 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(btn, "primary", "lg") + " flex-1"}>
                <WhatsAppIcon />
                {ctx.ui("whatsapp")}
              </WhatsAppLink>
              {c.phone && (
                <WhatsAppLink href={ctx.telHref} kind="call_click" className={buttonClass(btn, "accent", "lg") + " flex-1"}>
                  <PhoneIcon />
                  {ctx.ui("call_now")}
                </WhatsAppLink>
              )}
            </div>
            <dl className="mt-8 grid gap-5 sm:grid-cols-2">
              {ctx.text(c.address) && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("our_location")}</dt>
                  <dd className="mt-1 font-semibold">{ctx.text(c.address)}</dd>
                </div>
              )}
              {ctx.text(c.hours) && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("working_hours")}</dt>
                  <dd className="mt-1 font-semibold">{ctx.text(c.hours)}</dd>
                </div>
              )}
              {c.phone && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("phone")}</dt>
                  <dd className="mt-1 font-semibold">
                    <span dir="ltr">{formatPhone(c.phone)}</span>
                  </dd>
                </div>
              )}
              {c.email && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("email")}</dt>
                  <dd className="mt-1 font-semibold">{c.email}</dd>
                </div>
              )}
            </dl>
            {socials.length > 0 && (
              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">{ctx.ui("follow_us")}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-primary hover:text-primary">
                      <SocialIcon name={s.key} className="h-4 w-4" />
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-surface-2 min-h-[280px]">
            {safeMapEmbed(c.mapEmbedUrl) ? (
              <iframe src={safeMapEmbed(c.mapEmbedUrl)} className="h-full min-h-[320px] w-full" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer-when-downgrade" title={ctx.ui("our_location")} />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center text-muted">
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <p className="font-semibold">{ctx.text(c.address) || ctx.ui("kuwait")}</p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
