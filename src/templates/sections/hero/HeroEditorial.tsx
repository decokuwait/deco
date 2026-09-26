import type { SectionProps } from "../../types";
import { Container, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { RATIO } from "../../ui/ratios";
import { headingLeading, heroTitle } from "../shared/helpers";
import { HeroBadge, HeroCtas, HeroPicture } from "./shared";

/** Magazine layout: oversized headline, thin accent rules, a small photo and numbered stats. */
export function HeroEditorial({ ctx }: SectionProps) {
  const h = ctx.site.content.hero;
  const stats = ctx.site.content.stats.slice(0, 3);
  const brand = ctx.site.content.brand;
  return (
    <section className="relative bg-bg">
      <Container className="pb-12 pt-6 sm:pb-20 sm:pt-12">
        <div className="flex items-center justify-between border-t-2 border-accent pt-4 text-xs font-bold uppercase tracking-[0.3em] text-muted">
          <span>{ctx.text(brand.name)}</span>
          <span>{ctx.ui("kuwait")}</span>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8 animate-fade-up">
            <HeroBadge ctx={ctx} />
            <h1 className={cx("mt-4 font-heading text-4xl font-black leading-[1.02] tracking-tight max-[380px]:text-3xl sm:mt-5 sm:text-7xl lg:text-8xl", headingLeading(ctx))}>{heroTitle(ctx)}</h1>
          </div>
          <div className="lg:col-span-4">
            <div className={cx("relative overflow-hidden rounded-card", RATIO.heroPortrait)}>
              <HeroPicture ctx={ctx} slot="heroPortrait" sizes={SIZES.third} className="h-full w-full object-cover" />
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
