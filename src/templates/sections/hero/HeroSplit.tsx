import type { SectionProps } from "../../types";
import { Badge, Btn, Container, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { SIZES } from "../../ui/img";
import { RATIO } from "../../ui/ratios";
import { headingLeading, heroTitle, projectsAnchor, sectionHref } from "../shared/helpers";
import { HeroPicture } from "./shared";

/** Text on one side, large image with a floating stat card on the other. */
export function HeroSplit({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const h = c.hero;
  const stat = c.stats[0];
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-50" />
      {/* The badge is the first thing under a sticky nav that already has 64px of its own, so the top
          padding is a fraction of the bottom on a phone and only opens up where there is room. */}
      <Container className="relative grid items-center gap-10 pb-14 pt-6 sm:pb-20 sm:pt-10 lg:grid-cols-2 lg:pb-28 lg:pt-20">
        <div className="animate-fade-up">
          {ctx.text(h.badge) && <Badge>{ctx.text(h.badge)}</Badge>}
          {/* Arabic sets denser than Latin at the same size: 36px filled a 360px phone with four lines of
              headline and pushed the WhatsApp button off the first screen. */}
          <h1 className={cx("mt-4 font-heading text-3xl font-black leading-[1.15] max-[380px]:text-[1.6rem] sm:mt-5 sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:mt-5 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "primary", "lg")}>
              <WhatsAppIcon />
              {ctx.text(h.primaryCta) || ctx.ui("whatsapp")}
            </WhatsAppLink>
            {ctx.text(h.secondaryCta) && (
              <Btn ctx={ctx} href={sectionHref(ctx, projectsAnchor(ctx))} variant="ghost" size="lg">
                {ctx.text(h.secondaryCta)}
              </Btn>
            )}
          </div>
          {c.about.points.length > 0 && (
            <ul className="mt-6 grid gap-2 text-sm text-muted sm:mt-8 sm:grid-cols-2">
              {c.about.points.slice(0, 4).map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  {ctx.text(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          {/* These two blocks carried `-z-10`, and neither the section nor the container creates a
              stacking context — so they painted behind the page background and were invisible in every
              template that uses this hero. Ordered before the frame they sit behind it as intended, and
              they stay off phones, where a 224px square would crowd the copy against the screen edge. */}
          <div aria-hidden className="absolute -end-6 -top-6 hidden h-40 w-40 rounded-card bg-accent/30 lg:block" />
          <div aria-hidden className="absolute -bottom-6 -start-6 hidden h-56 w-56 rounded-card bg-primary/15 lg:block" />
          <div className={cx("relative overflow-hidden rounded-card shadow-2xl", RATIO.heroPortrait)}>
            <HeroPicture ctx={ctx} slot="heroPortrait" sizes={SIZES.half} className="h-full w-full object-cover" />
            {/* pointer-events-none, or this gradient sits between the visitor and the picture: the hold that
                pauses the rotator lands on the overlay instead of reaching the pictures underneath. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/40 to-transparent" />
          </div>
          {stat && (
            // Capped so a long Arabic label cannot push the card out of the picture it floats on.
            <div className="absolute bottom-3 start-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-card bg-surface/95 px-3 py-2 shadow-xl backdrop-blur animate-float sm:bottom-5 sm:start-5 sm:gap-3 sm:px-4 sm:py-3">
              <span className="font-heading text-2xl font-black text-primary-text sm:text-3xl">{stat.value}</span>
              <span className="text-xs font-semibold text-muted sm:text-sm">{ctx.text(stat.label)}</span>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
