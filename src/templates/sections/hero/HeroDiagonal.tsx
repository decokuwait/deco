import type { SectionProps } from "../../types";
import { Img, VisitorChip, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { headingLeading, heroAlt, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Secondary-colour text panel with a diagonal edge cutting into a full-height photo. */
export function HeroDiagonal({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const points = ctx.site.content.about.points.slice(0, 3);
  return (
    <section className="tone-dark relative grid overflow-hidden bg-secondary text-secondary-fg lg:min-h-[80svh] lg:grid-cols-[55%_45%]">
      <div className="relative z-10 flex items-center px-4 py-14 sm:px-8 sm:py-20 lg:ps-[max(2rem,calc((100vw-72rem)/2))] lg:pe-16 lg:[clip-path:polygon(0_0,100%_0,88%_100%,0_100%)] lg:bg-secondary">
        <div aria-hidden className="pattern-bg absolute inset-0 opacity-20" />
        <div className="relative max-w-xl animate-fade-up">
          <HeroBadge ctx={ctx} light />
          <h1 className={cx("mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-6 text-lg leading-relaxed opacity-85 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} light className="mt-8" />
          {points.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {points.map((p, i) => (
                <li key={i} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                  {ctx.text(p)}
                </li>
              ))}
            </ul>
          )}
          <VisitorChip ctx={ctx} className="mt-6 border-white/20 bg-white/10 text-white [&_span]:text-white" />
        </div>
      </div>
      <div className="relative aspect-[4/3] lg:aspect-auto lg:-ms-[12%]">
        <Img src={mainImage(ctx)} alt={heroAlt(ctx)} sizes={SIZES.half} className="h-full w-full object-cover" eager />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary/60 to-transparent lg:hidden" />
        <span aria-hidden className="absolute bottom-6 end-6 h-20 w-20 rounded-full border-4 border-accent/70" />
      </div>
    </section>
  );
}
