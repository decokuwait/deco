import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { FaqSchema } from "./schema";
import { FaqCardGrid } from "../../ui/client/FaqCardGrid";

/** Grid of toggleable FAQ cards; several can be open at once. */
export function FaqCards({ ctx }: SectionProps) {
  const f = ctx.site.content.faq;
  return (
    <Section id="faq" tone="bg" pattern>
      <FaqSchema ctx={ctx} />
      <Container>
        <SectionHeading title={ctx.text(f.title)} subtitle={ctx.text(f.subtitle)} />
        <FaqCardGrid items={f.items.map((it) => ({ id: it.id, q: ctx.text(it.q), a: ctx.text(it.a) }))} />
      </Container>
    </Section>
  );
}
