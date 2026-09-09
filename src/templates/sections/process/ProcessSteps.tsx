import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";

/** Numbered horizontal steps with a connecting line. */
export function ProcessSteps({ ctx }: SectionProps) {
  const p = ctx.site.content.process;
  return (
    <Section tone="surface" pattern>
      <Container>
        <SectionHeading title={ctx.text(p.title)} subtitle={ctx.text(p.subtitle)} />
        <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="absolute inset-x-12 top-7 hidden h-0.5 bg-line lg:block" />
          {p.steps.map((s, i) => (
            <li key={s.id} className="relative">
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary font-heading text-xl font-black text-primary-fg ring-8 ring-surface">{i + 1}</span>
              <h3 className="mt-4 font-heading text-lg font-bold">{ctx.text(s.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{ctx.text(s.description)}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
