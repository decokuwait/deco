import type { SectionProps } from "../../types";
import { Container, Img, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { headingLeading, heroAlt, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, mainImage } from "./shared";

/** Magazine layout: oversized headline, thin accent rules, a small photo and numbered stats. */
export function HeroEditorial({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const stats = ctx.site.content.stats.slice(0, 3);
  const brand = ctx.site.content.brand;
  return (
    <section className="relative bg-bg">
      <Container className="py-12 sm:py-20">
        <div className="flex items-center justify-between border-t-2 border-accent pt-4 text-xs font-bold uppercase tracking-[0.3em] text-muted">
          <span>{ctx.text(brand.name)}</span>
          <span>{ctx.ui("kuwait")}</span>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8 animate-fade-up">
            <HeroBadge ctx={ctx} />
            <h1 className={cx("mt-5 font-heading text-5xl font-black leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          </div>
          <div className="lg:col-span-4">
            <div className="aspect-[4/5] overflow-hidden rounded-card">
              <Img src={mainImage(ctx)} alt={heroAlt(ctx)} sizes={SIZES.third} ratio="4/5" className="h-full w-full object-cover" eager />
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-8 border-t border-line pt-8 lg:grid-cols-12">
          <p className="text-lg leading-relaxed text-muted lg:col-span-6 sm:text-xl">{ctx.text(h.subtitle)}</p>
          <div className="lg:col-span-6">
            <HeroCtas ctx={ctx} />
            {stats.length > 0 && (
              <ol className="mt-8 grid grid-cols-3 gap-4">
                {stats.map((s, i) => (
                  <li key={s.id} className="border-s-2 border-accent ps-3">
                    <div className="text-[10px] font-bold text-muted">0{i + 1}</div>
                    <div className="font-heading text-2xl font-black">{s.value}</div>
                    <div className="text-xs text-muted">{ctx.text(s.label)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
