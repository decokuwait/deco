import type { MediaItem } from "@/lib/types";
import type { SectionProps } from "../../types";
import { Container, Media, Section, SectionHeading, cx } from "../../ui/primitives";
import { beforeAfterOf, projectsOf } from "../shared/helpers";
import { ProjectMeta } from "./shared";

function Pane({ item, label, tone }: { item: MediaItem | null; label: string; tone: "before" | "after" }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      {item && <Media item={item} className="h-full w-full object-cover" />}
      <span className={cx("absolute start-3 top-3 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider text-white", tone === "before" ? "bg-black/60" : "bg-primary")}>{label}</span>
    </div>
  );
}

/** Before and after panes side by side with an arrow between them (stacked on phones). */
export function BeforeAfterSideBySide({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "before_after");
  return (
    <Section id="before-after" tone="bg">
      <Container wide>
        <SectionHeading title={ctx.text(p.beforeAfter.title) || ctx.ui("before_after")} subtitle={ctx.text(p.beforeAfter.subtitle)} />
        <div className="grid gap-8">
          {projects.map((pr) => {
            const { before, after } = beforeAfterOf(pr);
            return (
              <article key={pr.id} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="relative grid gap-1 sm:grid-cols-2">
                  <Pane item={before} label={ctx.ui("before")} tone="before" />
                  <Pane item={after} label={ctx.ui("after")} tone="after" />
                  <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-fg shadow-xl ring-4 ring-surface">
                    <svg viewBox="0 0 24 24" className={cx("h-6 w-6", ctx.dir === "rtl" && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
                <ProjectMeta ctx={ctx} project={pr} className="p-5" />
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
