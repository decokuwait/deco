import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, Stars, cx } from "../../ui/primitives";
import { longTextFont } from "../shared/helpers";
import { QuoteCarousel } from "../../ui/client/QuoteCarousel";
import { QuoteGlyph, initialOf } from "./shared";

/** One large quote at a time: swipeable, autoplaying, with an avatar initial medallion. */
export function TestimonialsCarousel({ ctx }: SectionProps) {
  const t = ctx.site.content.testimonials;
  if (!t.items.length) return null;
  return (
    <Section tone="surface2" pattern>
      <Container className="max-w-4xl">
        <SectionHeading title={ctx.text(t.title)} subtitle={ctx.text(t.subtitle)} />
        <QuoteCarousel dir={ctx.dir} autoplay={6000}>
          {t.items.map((it) => {
            const name = ctx.text(it.name);
            const role = ctx.text(it.role);
            return (
              <figure
                key={it.id}
                className="relative flex h-full flex-col items-center rounded-card border border-line bg-bg px-6 pb-10 pt-12 text-center shadow-[0_24px_60px_-32px_var(--t-secondary)] sm:px-14"
              >
                <span aria-hidden className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accent-fg shadow-md">
                  <QuoteGlyph className="h-5 w-5" />
                </span>
                <Stars n={it.rating ?? 5} />
                <blockquote className={cx("mt-5 text-lg font-semibold leading-relaxed sm:text-2xl", longTextFont(ctx))}>{ctx.text(it.text)}</blockquote>
                <figcaption className="mt-8 flex flex-col items-center gap-2">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-heading text-xl font-black text-primary-fg ring-4 ring-accent/30">
                    {initialOf(name)}
                  </span>
                  <span className="font-bold">{name}</span>
                  {role && <span className="text-xs text-muted">{role}</span>}
                </figcaption>
              </figure>
            );
          })}
        </QuoteCarousel>
      </Container>
    </Section>
  );
}
