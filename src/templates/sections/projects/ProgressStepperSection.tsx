import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { ProgressStepper } from "../../ui/client/ProgressStepper";
import { progressSlides, projectsOf } from "../shared/helpers";

/** Numbered horizontal stepper with a large media stage and thumbnails per project. */
export function ProgressStepperSection({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "progress");
  return (
    <Section id="progress" tone="surface2">
      <Container>
        <SectionHeading title={ctx.text(p.progress.title) || ctx.ui("in_progress")} subtitle={ctx.text(p.progress.subtitle)} />
        <div className="grid gap-10">
          {projects.map((pr) => (
            <article key={pr.id} className="rounded-card border border-line bg-bg p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-heading text-2xl font-extrabold">{ctx.text(pr.title)}</h3>
                  {ctx.text(pr.location) && <p className="mt-1 text-sm font-semibold text-primary-text">{ctx.text(pr.location)}</p>}
                </div>
                {ctx.text(pr.description) && <p className="max-w-md text-sm text-muted">{ctx.text(pr.description)}</p>}
              </div>
              <ProgressStepper slides={progressSlides(ctx, pr)} stepWord={ctx.ui("step")} dir={ctx.dir} />
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
