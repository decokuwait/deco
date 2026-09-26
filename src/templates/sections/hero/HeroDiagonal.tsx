import type { SectionProps } from "../../types";
import { cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { RATIO } from "../../ui/ratios";
import { headingLeading, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, HeroPicture } from "./shared";

/** Secondary-colour text panel with a diagonal edge cutting into a full-height photo. */
export function HeroDiagonal({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const points = ctx.site.content.about.points.slice(0, 3);
  return (
    <section className="tone-dark relative grid overflow-hidden bg-secondary text-secondary-fg lg:min-h-[80svh] lg:grid-cols-[55%_45%]">
      <div className="relative z-10 flex items-center px-4 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:ps-[max(2rem,calc((100vw-72rem)/2))] lg:pe-16 lg:[clip-path:polygon(0_0,100%_0,88%_100%,0_100%)] lg:bg-secondary">
        <div aria-hidden className="pattern-bg absolute inset-0 opacity-20" />
        <div className="relative max-w-xl animate-fade-up">
          <HeroBadge ctx={ctx} light />
          <h1 className={cx("mt-4 font-heading text-3xl font-black leading-[1.12] max-[380px]:text-[1.6rem] sm:mt-5 sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-4 text-base leading-relaxed opacity-85 sm:mt-6 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} light className="mt-6 sm:mt-8" />
          {points.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {points.map((p, i) => (
                <li key={i} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                  {ctx.text(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className={cx("relative lg:-ms-[12%]", RATIO.heroSide)}>
        <HeroPicture ctx={ctx} slot="heroSide" sizes={SIZES.half} className="h-full w-full object-cover" controlsClass="top-4 end-4" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/60 to-transparent lg:hidden" />
        <span aria-hidden className="pointer-events-none absolute bottom-6 end-6 h-20 w-20 rounded-full border-4 border-accent/70" />
      </div>
    </section>
  );
}
