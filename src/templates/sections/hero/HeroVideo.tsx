import type { SectionProps } from "../../types";
import { Container, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { HeroAutoVideo } from "../../ui/client/HeroAutoVideo";
import { headingLeading, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, HeroPicture, mainImage } from "./shared";

/** Background video (image fallback) with a dark overlay and content anchored bottom-start. */
export function HeroVideo({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const poster = mainImage(ctx);
  return (
    <section className="tone-dark relative flex min-h-[82svh] items-end overflow-hidden bg-secondary text-white">
      <div className="absolute inset-0">
        {h.videoUrl ? (
          <HeroAutoVideo src={h.videoUrl} poster={poster || undefined} className="h-full w-full object-cover" />
        ) : (
          <HeroPicture ctx={ctx} slot="heroFull" sizes={SIZES.full} className="h-full w-full object-cover" controlsClass="bottom-4 end-4 sm:bottom-6 sm:end-6" />
        )}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <Container wide className="relative pb-14 pt-32 sm:pb-20">
        <div className="max-w-2xl animate-fade-up">
          <HeroBadge ctx={ctx} light />
          <h1 className={cx("mt-4 font-heading text-3xl font-black leading-[1.1] max-[380px]:text-[1.6rem] sm:text-6xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:mt-5 sm:text-xl">{ctx.text(h.subtitle)}</p>
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
