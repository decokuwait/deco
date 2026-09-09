import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, cx } from "../../ui/primitives";

/** Vertical timeline: a running line with numbered dots; cards sit on one side on mobile and alternate sides on desktop. */
export function ProcessTimeline({ ctx }: SectionProps) {
  const p = ctx.site.content.process;
  return (
    <Section tone="bg" pattern>
      <Container>
        <SectionHeading title={ctx.text(p.title)} subtitle={ctx.text(p.subtitle)} />
        <ol className="relative mx-auto max-w-4xl">
          <div aria-hidden className="absolute inset-y-2 start-5 w-0.5 bg-line lg:start-1/2 lg:-ms-px" />
          {p.steps.map((s, i) => {
            const even = i % 2 === 0;
            return (
              <li key={s.id} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-10 last:pb-0 lg:grid-cols-[1fr_5rem_1fr] lg:gap-x-0">
                <span className="relative z-10 col-start-1 row-start-1 flex h-10 w-10 items-center justify-center self-start rounded-full bg-primary font-heading text-sm font-black text-primary-fg ring-4 ring-bg shadow-md lg:col-start-2 lg:mx-auto lg:h-12 lg:w-12 lg:text-base">
                  {i + 1}
                </span>
                <div
                  className={cx(
                    "col-start-2 row-start-1 rounded-card border border-line bg-surface p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg sm:p-6",
                    even ? "lg:col-start-1 lg:text-end" : "lg:col-start-3",
                  )}
                >
                  <span className="text-xs font-black uppercase tracking-widest text-accent">
                    {ctx.ui("step")} {i + 1}
                  </span>
                  <h3 className="mt-1 font-heading text-lg font-bold sm:text-xl">{ctx.text(s.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{ctx.text(s.description)}</p>
                </div>
              </li>
            );
          })}
          <li aria-hidden className="relative mt-8 grid grid-cols-[2.5rem_1fr] lg:grid-cols-[1fr_5rem_1fr]">
            <span className="col-start-1 mx-auto h-4 w-4 rotate-45 bg-accent lg:col-start-2" />
          </li>
        </ol>
      </Container>
    </Section>
  );
}
