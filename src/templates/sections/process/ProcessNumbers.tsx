import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";

/** Two-by-two grid where each title sits over a giant faded step number. */
export function ProcessNumbers({ ctx }: SectionProps) {
  const p = ctx.site.content.process;
  return (
    <Section tone="surface" className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -end-20 top-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <Container>
        <SectionHeading align="start" title={ctx.text(p.title)} subtitle={ctx.text(p.subtitle)} />
        <ol className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {p.steps.map((s, i) => (
            <li key={s.id} className="group relative pt-10 sm:pt-12">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-2 start-0 select-none font-heading text-[6rem] font-black leading-none tabular-nums text-primary-text/10 transition-colors duration-300 group-hover:text-accent/25 sm:text-[8rem]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative border-s-2 border-accent ps-5">
                <h3 className="font-heading text-xl font-extrabold sm:text-2xl">{ctx.text(s.title)}</h3>
                <p className="mt-2 leading-relaxed text-muted">{ctx.text(s.description)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
