import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";

/** Two-column grid of always-open Q/A blocks with numbered accent markers. No accordion. */
export function FaqTwoCol({ ctx }: SectionProps) {
  const f = ctx.site.content.faq;
  return (
    <Section id="faq" tone="surface">
      <Container>
        <SectionHeading title={ctx.text(f.title)} subtitle={ctx.text(f.subtitle)} align="start" />
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {f.items.map((it, i) => (
            <div key={it.id} className="relative ps-14">
              <span aria-hidden className="absolute start-0 top-0 flex h-10 w-10 items-center justify-center rounded-card bg-accent/15 font-heading text-sm font-black text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden className="absolute bottom-0 start-[19px] top-12 w-px bg-line" />
              <h3 className="font-heading text-lg font-bold leading-snug sm:text-xl">{ctx.text(it.q)}</h3>
              <p className="mt-2 leading-relaxed text-muted">{ctx.text(it.a)}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
