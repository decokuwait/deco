import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, cx } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { coverOf, lightboxItems, projectsOf } from "../shared/helpers";

/** Bento grid: the first project spans 2x2, the rest fill around it; titles sit on dark overlays. */
export function FinishedBento({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "finished");
  return (
    <Section id="projects" tone="bg">
      <Container wide>
        <SectionHeading align="start" eyebrow={ctx.text(p.title)} title={ctx.text(p.finished.title) || ctx.ui("finished_projects")} subtitle={ctx.text(p.finished.subtitle)} />
        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] lg:grid-cols-4 lg:gap-4">
          {projects.map((pr, i) => {
            const items = lightboxItems(ctx, pr);
            const hasVideo = items.some((x) => x.kind === "video");
            const big = i === 0;
            const wide = i === 3 || i === 6;
            return (
              <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
                <GalleryOpen
                  index={0}
                  disabled={!items.length}
                  label={ctx.text(pr.title)}
                  className={cx("group relative block h-full w-full overflow-hidden rounded-card bg-surface-2 text-start ring-1 ring-line", big && "col-span-2 row-span-2", wide && !big && "col-span-2")}
                >
                  <Img src={coverOf(pr)} alt={ctx.text(pr.title)} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  {hasVideo && <PlayBadge />}
                  <div className="tone-dark absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                    <div className={cx("font-heading font-bold drop-shadow", big ? "text-xl sm:text-2xl" : "text-sm sm:text-base")}>{ctx.text(pr.title)}</div>
                    {ctx.text(pr.location) && <div className="text-[11px] font-semibold text-accent-text">{ctx.text(pr.location)}</div>}
                    {big && ctx.text(pr.description) && <p className="mt-1 hidden max-w-md text-xs text-white/80 sm:block">{ctx.text(pr.description)}</p>}
                  </div>
                </GalleryOpen>
              </GalleryFrame>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
