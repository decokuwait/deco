import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { BeforeAfterSlider } from "../../ui/client/BeforeAfterSlider";
import { beforeAfterOf, projectsOf } from "../shared/helpers";

/** Draggable before/after comparison cards. */
export function BeforeAfterSliderSection({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "before_after");
  return (
    <Section id="before-after" tone="surface2" pattern>
      <Container wide>
        <SectionHeading title={ctx.text(p.beforeAfter.title) || ctx.ui("before_after")} subtitle={ctx.text(p.beforeAfter.subtitle)} />
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((pr) => {
            const { before, after } = beforeAfterOf(pr);
            if (!before || !after) return null;
            return (
              <article key={pr.id} className="overflow-hidden rounded-card border border-line bg-bg">
                <BeforeAfterSlider before={before.url} after={after.url} beforeLabel={ctx.ui("before")} afterLabel={ctx.ui("after")} hint={ctx.ui("drag_hint")} className="rounded-none" />
                <div className="p-5">
                  <h3 className="font-heading text-lg font-bold">{ctx.text(pr.title)}</h3>
                  {ctx.text(pr.location) && <p className="mt-1 text-xs font-semibold text-primary">{ctx.text(pr.location)}</p>}
                  {ctx.text(pr.description) && <p className="mt-2 text-sm text-muted">{ctx.text(pr.description)}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
