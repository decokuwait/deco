import type { SectionProps } from "../../types";
import { Container, Media, Section, SectionHeading } from "../../ui/primitives";
import { Tabs } from "../../ui/client/Tabs";
import { SIZES } from "../../ui/img";
import { beforeAfterOf, mediaAlt, projectsOf } from "../shared/helpers";
import { ProjectMeta } from "./shared";

/** Each project is a card with BEFORE / AFTER tabs switching the large media. */
export function BeforeAfterTabs({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "before_after");
  return (
    <Section id="before-after" tone="surface" pattern>
      <Container wide>
        <SectionHeading title={ctx.text(p.beforeAfter.title) || ctx.ui("before_after")} subtitle={ctx.text(p.beforeAfter.subtitle)} />
        <div className="grid gap-6 lg:grid-cols-2">
          {projects.map((pr) => {
            const { before, after } = beforeAfterOf(pr);
            const tabs = [
              { id: "before", label: ctx.ui("before"), content: <div className="aspect-[4/3] overflow-hidden rounded-card bg-surface-2">{before && <Media item={before} alt={`${ctx.ui("before")} — ${mediaAlt(ctx, before, pr)}`} sizes={SIZES.half} className="h-full w-full object-cover" />}</div> },
              { id: "after", label: ctx.ui("after"), content: <div className="aspect-[4/3] overflow-hidden rounded-card bg-surface-2">{after && <Media item={after} alt={`${ctx.ui("after")} — ${mediaAlt(ctx, after, pr)}`} sizes={SIZES.half} className="h-full w-full object-cover" />}</div> },
            ];
            return (
              <article key={pr.id} className="rounded-card border border-line bg-bg p-4 sm:p-5">
                <Tabs dir={ctx.dir} label={ctx.ui("before_after")} tabs={tabs} listClassName="justify-center" activeClassName="bg-primary text-primary-fg" inactiveClassName="bg-surface-2 text-muted hover:text-fg" />
                <ProjectMeta ctx={ctx} project={pr} className="pt-4" />
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
