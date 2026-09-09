import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, Stars } from "../../ui/primitives";

/** Three quote cards with rating stars. */
export function TestimonialsCards({ ctx }: SectionProps) {
  const t = ctx.site.content.testimonials;
  return (
    <Section tone="bg">
      <Container>
        <SectionHeading title={ctx.text(t.title)} subtitle={ctx.text(t.subtitle)} />
        <div className="grid gap-5 md:grid-cols-3">
          {t.items.map((it) => (
            <figure key={it.id} className="flex flex-col rounded-card border border-line bg-surface p-6">
              <Stars n={it.rating ?? 5} />
              <blockquote className="mt-4 flex-1 text-base leading-relaxed">“{ctx.text(it.text)}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-heading font-bold text-primary">{ctx.text(it.name).slice(0, 1)}</span>
                <span>
                  <span className="block font-bold">{ctx.text(it.name)}</span>
                  {ctx.text(it.role) && <span className="block text-xs text-muted">{ctx.text(it.role)}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
