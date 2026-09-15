import type { SectionProps } from "../../types";
import { Container, Img, Section, cx } from "../../ui/primitives";
import { longTextFont } from "../shared/helpers";

function QuoteMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
      <path d="M10 8h12v14a12 12 0 0 1-12 12v-6a6 6 0 0 0 6-6h-6zM28 8h12v14a12 12 0 0 1-12 12v-6a6 6 0 0 0 6-6h-6z" />
    </svg>
  );
}

/** The story as one large quotation with an accent quote mark, brand signature, points and an image strip. */
export function AboutQuote({ ctx }: SectionProps) {
  const a = ctx.site.content.about;
  const brand = ctx.site.content.brand;
  const hero = ctx.site.content.hero;
  const title = ctx.text(a.title);
  const imgs = Array.from(new Set([a.imageUrl, hero.imageUrl, ...(hero.images || [])].filter((u): u is string => !!u))).slice(0, 4);
  const stripCols =
    imgs.length === 1 ? "grid-cols-1" : imgs.length === 2 ? "grid-cols-2" : imgs.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return (
    <Section id="about" tone="bg" pattern className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute start-1/2 top-0 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      <Container>
        <div className="mx-auto max-w-4xl text-center">
          {title && (
            <span className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary">
              <span aria-hidden className="h-px w-6 bg-accent" />
              {title}
              <span aria-hidden className="h-px w-6 bg-accent" />
            </span>
          )}
          <figure className="relative mt-8">
            <QuoteMark className="pointer-events-none absolute -top-8 start-0 h-16 w-16 text-accent/30 sm:-top-12 sm:h-24 sm:w-24" />
            <blockquote className={cx("relative text-2xl font-extrabold leading-[1.55] sm:text-3xl lg:text-4xl", longTextFont(ctx))}>{ctx.text(a.body)}</blockquote>
            <figcaption className="mt-8 flex flex-col items-center gap-2">
              <span aria-hidden className="h-10 w-px bg-accent" />
              <span className="font-heading text-xl font-black text-primary sm:text-2xl">{ctx.text(brand.name)}</span>
              {ctx.text(brand.tagline) && <span className="text-sm text-muted">{ctx.text(brand.tagline)}</span>}
            </figcaption>
          </figure>
          {a.points.length > 0 && (
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted">
              {a.points.map((p, i) => (
                <li key={i} className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rotate-45 bg-accent" />
                  {ctx.text(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {imgs.length > 0 && (
          <div className={cx("mt-12 grid gap-3 sm:mt-16 sm:gap-4", stripCols)}>
            {imgs.map((src, i) => (
              <div key={src} className={cx("overflow-hidden rounded-card shadow-lg", imgs.length === 1 ? "aspect-[21/9]" : "aspect-[4/5]", imgs.length > 1 && i % 2 === 1 && "sm:translate-y-6")}>
                <Img src={src} alt={ctx.text(brand.name)} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
