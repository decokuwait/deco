import type { SectionProps } from "../../types";
import { Container, Img, Media, Section, SectionHeading } from "../../ui/primitives";
import { Tabs } from "../../ui/client/Tabs";
import { SIZES } from "../../ui/img";
import { beforeAfterOf, mediaAlt, pairFocal, projectsOf } from "../shared/helpers";
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
            // Both panels take `slot="compare"` and the pair's one focal point, so switching tabs neither
            // resizes the card under the visitor's finger nor re-crops the room out from under them.
            const focal = pairFocal(before, after);
            const panel = (item: typeof before, label: string) => (
              <div className="overflow-hidden rounded-card">
                {item ? <Media item={item} alt={`${label} — ${mediaAlt(ctx, item, pr)}`} slot="compare" focal={focal} sizes={SIZES.half} /> : <Img src={null} alt={label} slot="compare" />}
              </div>
            );
            const tabs = [
              { id: "before", label: ctx.ui("before"), content: panel(before, ctx.ui("before")) },
              { id: "after", label: ctx.ui("after"), content: panel(after, ctx.ui("after")) },
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
