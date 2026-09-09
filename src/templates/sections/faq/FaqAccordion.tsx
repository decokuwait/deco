import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { Accordion } from "../../ui/client/Accordion";

/** Single-column accordion, first item open. */
export function FaqAccordion({ ctx }: SectionProps) {
  const f = ctx.site.content.faq;
  return (
    <Section id="faq" tone="surface2">
      <Container className="max-w-3xl">
        <SectionHeading title={ctx.text(f.title)} subtitle={ctx.text(f.subtitle)} />
        <Accordion items={f.items.map((it) => ({ id: it.id, q: ctx.text(it.q), a: ctx.text(it.a) }))} />
      </Container>
    </Section>
  );
}
