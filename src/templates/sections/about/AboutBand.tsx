import type { SectionProps } from "../../types";
import { Container, Img, Section, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { AR_LEADING } from "../../leading";
import { aboutAlt } from "../shared/helpers";

/** Full-width secondary band with pattern: circular medallion image, centred story, points as pills and inline stats. */
export function AboutBand({ ctx }: SectionProps) {
  const a = ctx.site.content.about;
  const brand = ctx.site.content.brand;
  const stats = ctx.site.content.stats.slice(0, 4);
  const img = a.imageUrl || ctx.site.content.hero.imageUrl;
  return (
    <Section id="about" tone="secondary" pattern className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -start-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <Container className="flex flex-col items-center text-center">
        <div className="relative mb-8 animate-float">
          <div aria-hidden className="absolute -inset-3 rounded-full border-2 border-dashed border-accent/50" />
          <div className="relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-accent ring-offset-4 ring-offset-secondary sm:h-44 sm:w-44">
            <Img src={img} alt={aboutAlt(ctx)} fill sizes={SIZES.half} />
          </div>
          {ctx.text(brand.name) && (
            <div className="absolute inset-x-0 -bottom-3 flex justify-center">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-fg shadow">{ctx.text(brand.name)}</span>
            </div>
          )}
        </div>
        <h2 className={cx("max-w-3xl font-heading text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl", AR_LEADING)}>{ctx.text(a.title)}</h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed opacity-85 sm:text-lg">{ctx.text(a.body)}</p>
        {a.points.length > 0 && (
          <ul className="mt-7 flex flex-wrap justify-center gap-2">
            {a.points.map((p, i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-full border border-secondary-fg/15 bg-secondary-fg/10 px-4 py-1.5 text-sm font-semibold backdrop-blur">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {ctx.text(p)}
              </li>
            ))}
          </ul>
        )}
        {stats.length > 0 && (
          <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-y-6 border-t border-secondary-fg/15 pt-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.id} className="text-center">
                <div className="font-heading text-3xl font-black text-accent-text sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm font-semibold opacity-80">{ctx.text(s.label)}</div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
