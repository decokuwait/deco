import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { headingLeading, heroAlt, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Centered text above a wide cinematic photo, with a stats card row overlapping the image. */
export function HeroStacked({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const stats = ctx.site.content.stats.slice(0, 4);
  return (
    <section className="relative bg-bg">
      <div aria-hidden className="absolute inset-x-0 top-0 h-2/3 bg-surface" />
      <div aria-hidden className="pattern-bg absolute inset-x-0 top-0 h-2/3 opacity-50" />
      <Container wide className="relative pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className={cx("mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-8 justify-center" />
        </div>
        <div className="relative mt-12 aspect-[16/10] overflow-hidden rounded-card shadow-2xl ring-1 ring-line sm:aspect-[21/9]">
          <Img src={mainImage(ctx)} alt={heroAlt(ctx)} sizes={SIZES.full} ratio="21/9" className="h-full w-full object-cover" eager />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary/50 to-transparent" />
        </div>
        {stats.length > 0 && (
          <div className="relative z-10 mx-auto -mt-8 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-card bg-line shadow-xl sm:-mt-12 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.id} className="bg-surface px-4 py-5 text-center">
                <div className="font-heading text-3xl font-black text-primary-text">{s.value}</div>
                <div className="mt-1 text-xs font-bold text-muted sm:text-sm">{ctx.text(s.label)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="h-14 sm:h-20" />
      </Container>
    </section>
  );
}
