import type { SectionProps } from "../../types";
import { Badge, Btn, Container, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { SIZES } from "../../ui/img";
import { RATIO } from "../../ui/ratios";
import { headingLeading, heroTitle, projectsAnchor, sectionHref } from "../shared/helpers";
import { HeroPicture } from "./shared";

function Tick() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

/**
 * Text on one side, large image with a floating stat card on the other.
 *
 * On a desktop that is exactly what it is. On a phone there is no "other side", and stacking the desktop
 * composition produced a first screen that was entirely flat text: the photograph — the one thing that
 * sells a decor job — sat 555px down at 390px wide and 642px down at 320px, with four full-width proof
 * rows in between doing the pushing. So the phone gets its own arrangement rather than a narrowed copy of
 * the desktop one:
 *
 *  - the proof list moves *below* the photograph, which lifts the picture into the first screen. The grid
 *    places all three blocks explicitly, so the desktop keeps copy and list stacked in one column beside
 *    a photograph that spans both rows — the same layout it had before.
 *  - the photograph goes full-bleed to the screen edges. Inside the container gutter it read as a card
 *    floating in a field of background; edge to edge it reads as the hero.
 *  - the stat stops floating over the picture and becomes the lead chip of the proof strip. Floating, it
 *    collided with the fixed WhatsApp bubble, which sits in the same bottom corner in Arabic — the phone
 *    is the one width where the picture is wide enough to reach it.
 *  - the two calls to action become one full-width column. Their content widths differ, so side by side
 *    they wrapped into two unequal right-aligned boxes: the single most "scattered"-looking thing on the
 *    page, and it landed on the conversion action.
 */
export function HeroSplit({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const h = c.hero;
  const stat = c.stats[0];
  const points = c.about.points.slice(0, 4);
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-50" />
      {/* The badge is the first thing under a sticky nav that already has 64px of its own, so the top
          padding is a fraction of the bottom on a phone and only opens up where there is room. */}
      <Container className="relative grid items-center gap-7 pb-14 pt-6 sm:gap-10 sm:pb-20 sm:pt-10 lg:grid-cols-2 lg:pb-28 lg:pt-20">
        <div className="animate-fade-up lg:col-start-1 lg:row-start-1">
          {ctx.text(h.badge) && <Badge>{ctx.text(h.badge)}</Badge>}
          {/* Arabic sets denser than Latin at the same size: 36px filled a 360px phone with four lines of
              headline and pushed the WhatsApp button off the first screen. */}
          <h1 className={cx("mt-3 font-heading text-3xl font-black leading-[1.15] max-[380px]:text-[1.6rem] sm:mt-5 sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          {/* text-pretty, or the last word of an Arabic subtitle sits alone on a line of its own — which
              is what "التسليم." was doing at every phone width. */}
          <p className="mt-3 max-w-xl text-pretty text-base leading-relaxed text-muted sm:mt-5 sm:text-xl">{ctx.text(h.subtitle)}</p>
          {/* One full-width column on a phone, the original inline row from `sm` up. `whitespace-nowrap`
              is what made the wrapped version look accidental: each button took its own content width. */}
          <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center">
            <WhatsAppLink href={ctx.whatsappHref} className={cx(buttonClass(ctx.def.tokens.buttonStyle, "primary", "lg"), "w-full sm:w-auto")}>
              <WhatsAppIcon />
              {ctx.text(h.primaryCta) || ctx.ui("whatsapp")}
            </WhatsAppLink>
            {ctx.text(h.secondaryCta) && (
              <Btn ctx={ctx} href={sectionHref(ctx, projectsAnchor(ctx))} variant="ghost" size="lg" className="w-full sm:w-auto">
                {ctx.text(h.secondaryCta)}
              </Btn>
            )}
          </div>
        </div>

        <div className="relative lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {/* These two blocks carried `-z-10`, and neither the section nor the container creates a
              stacking context — so they painted behind the page background and were invisible in every
              template that uses this hero. Ordered before the frame they sit behind it as intended, and
              they stay off phones, where a 224px square would crowd the copy against the screen edge. */}
          <div aria-hidden className="absolute -end-6 -top-6 hidden h-40 w-40 rounded-card bg-accent/30 lg:block" />
          <div aria-hidden className="absolute -bottom-6 -start-6 hidden h-56 w-56 rounded-card bg-primary/15 lg:block" />
          {/* Full-bleed on phones only: the negative margin cancels the container gutter exactly, so the
              picture reaches both screen edges without the page ever scrolling sideways. */}
          <div className={cx("relative -mx-4 overflow-hidden shadow-2xl sm:mx-0 sm:rounded-card", RATIO.heroPortrait)}>
            <HeroPicture
              ctx={ctx}
              slot="heroPortrait"
              sizes={SIZES.half}
              className="h-full w-full object-cover"
              // Bottom centre on a phone, where the picture is full width and the top corner is the first
              // thing the eye lands on; the original top corner from `sm` up.
              controlsClass="bottom-3 left-1/2 -translate-x-1/2 sm:bottom-auto sm:left-auto sm:translate-x-0 sm:top-3 sm:end-3"
            />
            {/* pointer-events-none, or this gradient sits between the visitor and the picture: the hold that
                pauses the rotator lands on the overlay instead of reaching the pictures underneath. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/40 to-transparent" />
            {stat && (
              // Capped so a long Arabic label cannot push the card out of the picture it floats on.
              //
              // Top corner on a phone, bottom corner from `sm` up. Both fixed buttons live along the
              // bottom edge of the viewport — the WhatsApp bubble on the start side, "back to top" on the
              // end side — and a full-bleed picture is wide enough to reach them, so at 320px the bubble
              // covered the number and left the card reading "سنة خبرة" with nothing in front of it. The
              // top of a hero photograph is also its quietest region: ceiling, sky or wall.
              <div className="absolute top-3 start-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-card bg-surface/95 px-3 py-2 shadow-xl backdrop-blur animate-float sm:bottom-5 sm:start-5 sm:top-auto sm:gap-3 sm:px-4 sm:py-3">
                <span className="font-heading text-2xl font-black text-primary-text sm:text-3xl">{stat.value}</span>
                <span className="text-xs font-semibold text-muted sm:text-sm">{ctx.text(stat.label)}</span>
              </div>
            )}
          </div>
        </div>

        {points.length > 0 && (
          // Two columns from 380px up: four full-width rows were a column of ticks down one edge with
          // most of the line empty beside them.
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm text-muted min-[380px]:grid-cols-2 sm:gap-y-3 lg:col-start-1 lg:row-start-2 lg:mt-8">
            {points.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <Tick />
                {ctx.text(p)}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
