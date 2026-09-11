import type { SectionProps } from "../../types";
import { Container, Img } from "../../ui/primitives";
import { HeroAutoVideo } from "../../ui/client/HeroAutoVideo";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Background video (image fallback) with a dark overlay and content anchored bottom-start. */
export function HeroVideo({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const poster = mainImage(ctx);
  return (
    <section className="tone-dark relative flex min-h-[82svh] items-end overflow-hidden bg-secondary text-white">
      <div className="absolute inset-0">
        {h.videoUrl ? <HeroAutoVideo src={h.videoUrl} poster={poster || undefined} className="h-full w-full object-cover" /> : <Img src={poster} alt="" className="h-full w-full object-cover" eager />}
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <Container wide className="relative pb-14 pt-32 sm:pb-20">
        <div className="max-w-2xl animate-fade-up">
          <HeroBadge ctx={ctx} light />
          <h1 className="mt-4 font-heading text-4xl font-black leading-[1.1] sm:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <HeroCtas ctx={ctx} light className="mt-8" />
        </div>
        <div className="mt-10 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/70">
          <span className="h-px w-10 bg-accent" />
          {ctx.text(ctx.site.content.brand.tagline)}
        </div>
      </Container>
    </section>
  );
}
