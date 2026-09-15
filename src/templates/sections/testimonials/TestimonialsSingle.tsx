import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, Stars, cx } from "../../ui/primitives";
import { longTextFont } from "../shared/helpers";
import { QuoteGlyph, initialOf } from "./shared";

/** One featured testimonial in large heading type on the secondary colour; the rest listed as small chips. */
export function TestimonialsSingle({ ctx }: SectionProps) {
  const t = ctx.site.content.testimonials;
  const [featured, ...rest] = t.items;
  if (!featured) return null;
  const name = ctx.text(featured.name);
  const role = ctx.text(featured.role);
  return (
    <Section tone="secondary" pattern className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -end-24 -top-32 h-80 w-80 rounded-full border-[28px] border-accent/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -start-20 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <Container className="max-w-4xl text-center">
        <SectionHeading title={ctx.text(t.title)} subtitle={ctx.text(t.subtitle)} light />
        <QuoteGlyph className="mx-auto h-12 w-12 text-accent" />
        <blockquote className={cx("mt-4 text-2xl font-bold leading-snug sm:text-3xl lg:text-[2.5rem] lg:leading-tight", longTextFont(ctx))}>{ctx.text(featured.text)}</blockquote>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Stars n={featured.rating ?? 5} />
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-heading text-lg font-black text-accent-fg">{initialOf(name)}</span>
            <span className="text-start">
              <span className="block font-bold">{name}</span>
              {role && <span className="block text-xs opacity-75">{role}</span>}
            </span>
          </div>
        </div>
        {rest.length > 0 && (
          <ul className="mt-12 flex flex-wrap justify-center gap-2 border-t border-secondary-fg/15 pt-8">
            {rest.map((it) => {
              const n = ctx.text(it.name);
              return (
                <li key={it.id} className="inline-flex items-center gap-2 rounded-full border border-secondary-fg/20 bg-secondary-fg/10 py-1.5 pe-3 ps-1.5 text-xs font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-black text-accent-fg">{initialOf(n)}</span>
                  {n}
                  {it.rating ? (
                    <span className="text-accent" aria-label={`${it.rating}/5`}>
                      ★ {it.rating}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </Section>
  );
}
