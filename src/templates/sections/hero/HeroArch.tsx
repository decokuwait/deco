import type { SectionProps } from "../../types";
import { Container, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { RATIO } from "../../ui/ratios";
import { headingLeading, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, HeroPicture } from "./shared";

/** Photo masked into a Gulf-style arch with a geometric ring, text beside it. */
export function HeroArch({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const points = ctx.site.content.about.points.slice(0, 2);
  return (
    <section className="relative overflow-hidden bg-surface">
      <div aria-hidden className="pattern-bg absolute inset-0 opacity-60" />
      <Container className="relative grid items-center gap-10 pb-14 pt-8 sm:gap-12 sm:pb-20 sm:pt-12 lg:grid-cols-2 lg:py-24">
        <div className="relative mx-auto w-full max-w-sm">
          <div aria-hidden className="absolute -inset-4 rounded-t-[999px] rounded-b-card border-2 border-dashed border-accent/60" />
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-t-[999px] rounded-b-card bg-primary/10" />
          <div className={cx("relative overflow-hidden rounded-t-[999px] rounded-b-card shadow-2xl", RATIO.heroPortrait)}>
            {/* Controls at the bottom, not the top: this frame is a half circle, and a pill in the top
                corner had two of its dots eaten by the arch. */}
            <HeroPicture ctx={ctx} slot="heroPortrait" sizes={SIZES.third} className="h-full w-full object-cover" controlsClass="bottom-3 end-3" />
          </div>
          <span aria-hidden className="pointer-events-none absolute -end-5 top-1/3 h-12 w-12 rotate-45 rounded-sm bg-accent shadow-lg animate-float" />
        </div>
        <div className="animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className={cx("mt-4 font-heading text-3xl font-black leading-[1.12] max-[380px]:text-[1.6rem] sm:mt-5 sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-6 sm:mt-8" />
          {points.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-4">
              {points.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-bold">
                  <span className="h-2.5 w-2.5 rotate-45 bg-primary" />
                  {ctx.text(p)}
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
