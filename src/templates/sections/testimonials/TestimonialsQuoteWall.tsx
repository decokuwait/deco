import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, Stars, cx } from "../../ui/primitives";
import { longTextFont } from "../shared/helpers";
import { QuoteGlyph, initialOf } from "./shared";

/** Masonry-style wall of quote cards in CSS columns, with varied card sizes and a giant quotation glyph. */
export function TestimonialsQuoteWall({ ctx }: SectionProps) {
  const t = ctx.site.content.testimonials;
  return (
    <Section tone="surface" className="overflow-hidden">
      <QuoteGlyph className="pointer-events-none absolute -start-8 -top-10 h-56 w-56 text-primary/10 sm:h-80 sm:w-80 lg:h-96 lg:w-96" />
      <Container>
        <SectionHeading title={ctx.text(t.title)} subtitle={ctx.text(t.subtitle)} align="start" />
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {t.items.map((it, i) => {
            const feature = i % 3 === 0;
            const deep = !feature && i % 5 === 3;
            const dark = feature || deep;
            const name = ctx.text(it.name);
            const role = ctx.text(it.role);
            return (
              <figure
                key={it.id}
                className={cx(
                  "relative mb-5 break-inside-avoid rounded-card p-6",
                  feature ? "bg-primary text-primary-fg shadow-xl shadow-primary/20" : deep ? "bg-secondary text-secondary-fg" : "border border-line bg-bg",
                )}
              >
                <QuoteGlyph className={cx("absolute end-5 top-5 h-8 w-8", feature ? "text-primary-fg/25" : deep ? "text-accent" : "text-accent/50")} />
                <Stars n={it.rating ?? 5} />
                <blockquote className={cx("mt-4 leading-relaxed", feature ? cx(longTextFont(ctx), "text-lg font-semibold sm:text-xl") : "text-base")}>{ctx.text(it.text)}</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    className={cx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading font-bold",
                      feature ? "bg-primary-fg/15 text-primary-fg" : deep ? "bg-accent text-accent-fg" : "bg-primary/10 text-primary",
                    )}
                  >
                    {initialOf(name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{name}</span>
                    {role && <span className={cx("block text-xs", dark ? "opacity-75" : "text-muted")}>{role}</span>}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
