import type { SectionProps } from "../../types";
import { Container, Img, VisitorChip } from "../../ui/primitives";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Full-viewport photo with slow Ken Burns zoom, dark gradient and centered white typography. */
export function HeroFullscreen({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const stats = ctx.site.content.stats.slice(0, 3);
  return (
    <section className="tone-dark relative flex min-h-[88svh] items-end overflow-hidden bg-secondary text-white sm:items-center">
      <div className="absolute inset-0 overflow-hidden">
        <Img src={mainImage(ctx)} alt="" className="h-full w-full object-cover animate-ken-burns" eager />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-secondary/20" />
      <div aria-hidden className="pattern-bg absolute inset-0 opacity-20" />
      <Container className="relative py-20 text-center sm:py-28">
        <div className="mx-auto max-w-3xl animate-fade-up">
          <HeroBadge ctx={ctx} light />
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.12] drop-shadow-lg sm:text-6xl lg:text-7xl">{ctx.text(h.title)}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} light className="mt-9 justify-center" />
        </div>
        {stats.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 divide-x divide-white/20 rounded-card border border-white/20 bg-white/10 backdrop-blur rtl:divide-x-reverse">
            {stats.map((s) => (
              <div key={s.id} className="px-2 py-4">
                <div className="font-heading text-2xl font-black text-accent-text sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-[11px] font-semibold text-white/80 sm:text-xs">{ctx.text(s.label)}</div>
              </div>
            ))}
          </div>
        )}
        <VisitorChip ctx={ctx} className="mt-6 border-white/20 bg-white/10 text-white [&_span]:text-white" />
      </Container>
      <a href="#about" aria-hidden className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 animate-float text-white/70 sm:block">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
