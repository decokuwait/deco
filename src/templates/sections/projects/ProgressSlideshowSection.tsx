import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { ProgressSlideshow } from "../../ui/client/ProgressSlideshow";
import { progressSlides, projectsOf } from "../shared/helpers";

/** One slideshow per in-progress project, showing each step/day/hour with labels. */
export function ProgressSlideshowSection({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "progress");
  return (
    <Section id="progress" tone="bg">
      <Container>
        <SectionHeading title={ctx.text(p.progress.title) || ctx.ui("in_progress")} subtitle={ctx.text(p.progress.subtitle) || ctx.ui("progress_hint")} />
        <div className="grid gap-10">
          {projects.map((pr) => (
            <article key={pr.id} className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-start">
              <div className="lg:sticky lg:top-24">
                <span className="mb-3 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-text">{ctx.ui("in_progress")}</span>
                <h3 className="font-heading text-2xl font-extrabold">{ctx.text(pr.title)}</h3>
                {ctx.text(pr.location) && <p className="mt-1 text-sm font-semibold text-primary-text">{ctx.text(pr.location)}</p>}
                {ctx.text(pr.description) && <p className="mt-3 leading-relaxed text-muted">{ctx.text(pr.description)}</p>}
              </div>
              <ProgressSlideshow prevLabel={ctx.ui("prev_slide")} nextLabel={ctx.ui("next_slide")} slides={progressSlides(ctx, pr)} stepWord={ctx.ui("step")} ofWord={ctx.ui("of")} dir={ctx.dir} />
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
