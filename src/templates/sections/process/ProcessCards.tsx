import type { SectionProps } from "../../types";
import { Arrow, Container, Section, SectionHeading } from "../../ui/primitives";

/** Step cards with a step chip and faded index; arrow connectors float in the gaps between cards on desktop. */
export function ProcessCards({ ctx }: SectionProps) {
  const p = ctx.site.content.process;
  const n = p.steps.length;
  return (
    <Section tone="bg" pattern>
      <Container wide>
        <SectionHeading title={ctx.text(p.title)} subtitle={ctx.text(p.subtitle)} />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {p.steps.map((s, i) => {
            const showArrow = i < n - 1 && (i + 1) % 4 !== 0;
            return (
              <li key={s.id} className="relative">
                <article className="group flex h-full flex-col rounded-card border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-fg">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {ctx.ui("step")} {i + 1}
                    </span>
                    <span className="font-heading text-2xl font-black tabular-nums text-primary/20 transition-colors duration-300 group-hover:text-accent">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-bold sm:text-xl">{ctx.text(s.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{ctx.text(s.description)}</p>
                  <span aria-hidden className="mt-auto block pt-5">
                    <span className="block h-1 w-10 rounded-full bg-accent transition-all duration-300 group-hover:w-16" />
                  </span>
                </article>
                {showArrow && (
                  <span aria-hidden className="absolute -end-8 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-bg text-primary shadow ring-1 ring-line lg:flex">
                    <Arrow dir={ctx.dir} className="h-4 w-4" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
