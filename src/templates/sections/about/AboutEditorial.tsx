import type { SectionProps } from "../../types";
import { Container, Img, Section, cx } from "../../ui/primitives";

/**
 * Magazine layout: oversized headline, two-column body copy with a drop cap (English) or an accent
 * lead rule (Arabic, where a floated first letter would break the word shaping), a small inline
 * image floated into the copy and the highlight points as inline chips.
 */
export function AboutEditorial({ ctx }: SectionProps) {
  const a = ctx.site.content.about;
  const brand = ctx.site.content.brand;
  const img = a.imageUrl || ctx.site.content.hero.imageUrl;
  const paras = ctx.text(a.body)
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const lead =
    ctx.locale === "en"
      ? "first-letter:float-start first-letter:me-3 first-letter:mt-1 first-letter:font-heading first-letter:text-6xl first-letter:font-black first-letter:leading-[0.8] first-letter:text-primary"
      : "border-s-4 border-accent ps-4";
  return (
    <Section id="about" tone="bg">
      <Container>
        <header className="grid gap-6 border-b-2 border-fg pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
              <span aria-hidden className="h-2 w-2 rotate-45 bg-accent" />
              {ctx.text(brand.name)}
            </span>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight sm:text-5xl">{ctx.text(a.title)}</h2>
          </div>
          {ctx.text(brand.tagline) && <p className="max-w-xs text-sm leading-relaxed text-muted lg:text-end">{ctx.text(brand.tagline)}</p>}
        </header>
        <div className="mt-8 lg:columns-2 lg:gap-12">
          {img && (
            <figure className="float-end mb-4 ms-5 w-36 sm:w-52">
              <div className="relative">
                <div aria-hidden className="absolute -end-2 -top-2 h-full w-full rounded-card bg-accent/20" />
                <Img src={img} alt={ctx.text(a.title)} className="relative aspect-[3/4] w-full rounded-card object-cover" />
              </div>
            </figure>
          )}
          {paras.map((t, i) => (
            <p key={i} className={cx("mb-5 text-lg leading-[1.85] text-fg/90", i === 0 && lead)}>
              {t}
            </p>
          ))}
        </div>
        {a.points.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-6">
            {a.points.map((p, i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:border-accent hover:bg-accent/10">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                {ctx.text(p)}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
