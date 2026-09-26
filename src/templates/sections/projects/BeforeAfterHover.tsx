import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading } from "../../ui/primitives";
import { HoverReveal } from "../../ui/client/HoverReveal";
import { beforeAfterOf, pairFocal, projectAlt, projectsOf } from "../shared/helpers";
import { ProjectMeta } from "./shared";

/** Hover (or tap) to reveal the "after" state; chips toggle explicitly on touch. */
export function BeforeAfterHover({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "before_after");
  return (
    <Section id="before-after" tone="bg">
      <Container wide>
        <SectionHeading title={ctx.text(p.beforeAfter.title) || ctx.ui("before_after")} subtitle={ctx.text(p.beforeAfter.subtitle)} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((pr) => {
            const { before, after } = beforeAfterOf(pr);
            return (
              <article key={pr.id} className="flex flex-col">
                <HoverReveal
                  before={before ? { kind: before.kind, url: before.url, posterUrl: before.posterUrl } : null}
                  after={after ? { kind: after.kind, url: after.url, posterUrl: after.posterUrl } : null}
                  beforeLabel={ctx.ui("before")}
                  afterLabel={ctx.ui("after")}
                  alt={projectAlt(ctx, pr)}
                  focal={pairFocal(before, after)}
                  className="shadow-lg ring-1 ring-line"
                />
                <ProjectMeta ctx={ctx} project={pr} className="px-1 pt-4" />
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
