import type { SectionProps } from "../../types";
import { Container, Img, PhoneIcon, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { SIZES } from "../../ui/img";
import { headingLeading, heroAlt } from "../shared/helpers";

/** Floating card on the surface colour: hero image on one side, WhatsApp + call buttons on the other. */
export function CtaCard({ ctx }: SectionProps) {
  const c = ctx.site.content.cta;
  const img = ctx.site.content.hero.imageUrl;
  const phone = ctx.site.content.contact.phone;
  const btn = ctx.def.tokens.buttonStyle;
  const subtitle = ctx.text(c.subtitle);
  return (
    <section className="bg-surface py-14 text-fg sm:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-card border border-line bg-bg shadow-2xl shadow-secondary/15">
          <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-accent" />
          <div className="grid lg:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col justify-center p-7 sm:p-12">
              <span className="text-xs font-bold uppercase tracking-widest text-accent-text">{ctx.text(ctx.site.content.cta.eyebrow) || ctx.ui("free_visit")}</span>
              <h2 className={cx("mt-3 font-heading text-3xl font-black leading-tight sm:text-4xl", headingLeading(ctx))}>{ctx.text(c.title)}</h2>
              {subtitle && <p className="mt-3 max-w-xl text-base text-muted sm:text-lg">{subtitle}</p>}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(btn, "primary", "lg")}>
                  <WhatsAppIcon />
                  {ctx.text(c.buttonText) || ctx.ui("whatsapp")}
                </WhatsAppLink>
                {phone && (
                  <WhatsAppLink href={ctx.telHref} kind="call_click" className={buttonClass(btn, "ghost", "lg")}>
                    <PhoneIcon />
                    {ctx.ui("call_now")}
                  </WhatsAppLink>
                )}
              </div>
            </div>
            <div className="relative order-first min-h-[220px] sm:min-h-[280px] lg:order-none lg:min-h-full">
              {img ? (
                <Img src={img} alt={heroAlt(ctx)} sizes={SIZES.half} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-primary text-primary-fg">
                  <div aria-hidden className="pattern-bg absolute inset-0 opacity-40" />
                  <WhatsAppIcon className="relative h-24 w-24 opacity-90" />
                </div>
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary/30 to-transparent lg:hidden" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
