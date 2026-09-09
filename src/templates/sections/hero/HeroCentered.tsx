import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { HeroBadge, HeroCtas, heroImages } from "./shared";

/** Patterned background, centered typographic hero, then a staggered strip of three images. */
export function HeroCentered({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const imgs = heroImages(ctx, 3);
  return (
    <section className="relative overflow-hidden bg-surface">
      <div aria-hidden className="pattern-bg absolute inset-0 opacity-70" />
      <div aria-hidden className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      <Container className="relative pt-16 text-center sm:pt-24">
        <div className="mx-auto max-w-3xl animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-8 justify-center" />
        </div>
      </Container>
      {imgs.length > 0 && (
        <Container wide className="relative mt-12 grid grid-cols-3 gap-3 pb-16 sm:gap-5 sm:pb-24">
          {imgs.map((src, i) => (
            <div key={i} className={cx("overflow-hidden rounded-card shadow-xl ring-1 ring-line", i === 1 ? "aspect-[3/4] sm:-translate-y-6" : "aspect-[3/4] sm:translate-y-4")}>
              <Img src={src} alt="" className="h-full w-full object-cover transition duration-700 hover:scale-105" eager={i === 1} />
            </div>
          ))}
        </Container>
      )}
    </section>
  );
}
