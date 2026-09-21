import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { Icon } from "../../ui/icons";

/** Three-column icon cards with hover lift. */
export function ServicesGrid({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  return (
    <Section id="services" tone="surface" pattern>
      <Container>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {s.items.map((it) => (
            <article key={it.id} className="group rounded-card border border-line bg-bg p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-card bg-primary/10 text-primary-text transition group-hover:bg-primary group-hover:text-primary-fg">
                <Icon name={it.icon} className="h-7 w-7" />
              </span>
              <h3 className="font-heading text-xl font-bold">{ctx.text(it.title)}</h3>
              <p className="mt-2 leading-relaxed text-muted">{ctx.text(it.description)}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
