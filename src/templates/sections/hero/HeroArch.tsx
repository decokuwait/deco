import type { SectionProps } from "../../types";
import { Container, Img } from "../../ui/primitives";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Photo masked into a Gulf-style arch with a geometric ring, text beside it. */
export function HeroArch({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const points = ctx.site.content.about.points.slice(0, 2);
  return (
    <section className="relative overflow-hidden bg-surface">
      <div aria-hidden className="pattern-bg absolute inset-0 opacity-60" />
      <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div className="relative mx-auto w-full max-w-sm">
          <div aria-hidden className="absolute -inset-4 rounded-t-[999px] rounded-b-card border-2 border-dashed border-accent/60" />
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-t-[999px] rounded-b-card bg-primary/10" />
          <div className="aspect-[3/4] overflow-hidden rounded-t-[999px] rounded-b-card shadow-2xl">
            <Img src={mainImage(ctx)} alt={ctx.text(h.title)} className="h-full w-full object-cover" eager />
          </div>
          <span aria-hidden className="absolute -end-5 top-1/3 h-12 w-12 rotate-45 rounded-sm bg-accent shadow-lg animate-float" />
        </div>
        <div className="animate-fade-up">
          <HeroBadge ctx={ctx} />
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.12] sm:text-5xl lg:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} className="mt-8" />
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
