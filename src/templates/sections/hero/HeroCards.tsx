import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { HeroBadge, HeroCtas, heroImages } from "./shared";

/** Text beside a playful collage of three rotated, overlapping photo cards. */
export function HeroCards({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const imgs = heroImages(ctx, 3);
  const stat = ctx.site.content.stats[1] ?? ctx.site.content.stats[0];
  const cards = [
    "left-0 top-6 w-[62%] -rotate-6 z-10",
    "right-0 top-0 w-[58%] rotate-3 z-20",
    "left-[18%] bottom-0 w-[60%] rotate-2 z-30",
  ];
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="pattern-bg absolute inset-0 opacity-40" />
      <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div className="animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-8" />
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-md" dir="ltr">
          <div aria-hidden className="absolute inset-[12%] rounded-full bg-primary/10" />
          {imgs.map((src, i) => (
            <div key={i} className={cx("absolute aspect-[4/3] overflow-hidden rounded-card bg-surface p-2 shadow-2xl ring-1 ring-line transition duration-500 hover:z-40 hover:rotate-0 hover:scale-105", cards[i])}>
              <Img src={src} alt="" className="h-full w-full rounded-[calc(var(--t-radius)-4px)] object-cover" eager={i === 1} />
            </div>
          ))}
          {stat && (
            <div className="absolute -bottom-4 right-2 z-40 rounded-card bg-accent px-4 py-2 text-accent-fg shadow-xl animate-float">
              <span className="font-heading text-2xl font-black">{stat.value}</span>
              <span className="ms-2 text-xs font-bold">{ctx.text(stat.label)}</span>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
