import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { headingLeading, heroAlt, heroTitle, nthAlt } from "../shared/helpers";
import { HeroBadge, HeroCtas, heroImages } from "./shared";

/** Text column beside a four-image masonry mosaic. */
export function HeroGallery({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const imgs = heroImages(ctx, 4);
  const cells = ["row-span-2 aspect-[3/4]", "aspect-[4/3]", "aspect-[4/3]", "col-span-2 aspect-[16/7]"];
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="absolute -start-24 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <Container wide className="relative grid items-center gap-8 pb-14 pt-8 sm:gap-10 sm:pb-20 sm:pt-12 lg:grid-cols-[5fr_7fr] lg:py-24">
        <div className="animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className={cx("mt-4 font-heading text-3xl font-black leading-[1.12] max-[380px]:text-[1.6rem] sm:mt-5 sm:text-5xl lg:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:mt-6 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-6 sm:mt-8" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {imgs.map((src, i) => (
            <div key={i} className={cx("group overflow-hidden rounded-card ring-1 ring-line", cells[i])}>
              <Img src={src} alt={nthAlt(ctx, heroAlt(ctx), i, imgs.length)} sizes={SIZES.third} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" eager={i === 0} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
