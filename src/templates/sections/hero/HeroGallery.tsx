import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { HeroBadge, HeroCtas, heroImages } from "./shared";

/** Text column beside a four-image masonry mosaic. */
export function HeroGallery({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const imgs = heroImages(ctx, 4);
  const cells = ["row-span-2 aspect-[3/4]", "aspect-[4/3]", "aspect-[4/3]", "col-span-2 aspect-[16/7]"];
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="absolute -start-24 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <Container wide className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[5fr_7fr] lg:py-24">
        <div className="animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-8" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {imgs.map((src, i) => (
            <div key={i} className={cx("group overflow-hidden rounded-card ring-1 ring-line", cells[i])}>
              <Img src={src} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" eager={i === 0} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
