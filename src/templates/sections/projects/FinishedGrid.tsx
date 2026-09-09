import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { coverOf, lightboxItems, projectsOf } from "../shared/helpers";
import { ProjectMeta } from "./shared";

/** Card grid of finished projects; each card opens its media (images + videos) in a lightbox. */
export function FinishedGrid({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "finished");
  return (
    <Section id="projects" tone="bg">
      <Container wide>
        <SectionHeading eyebrow={ctx.text(p.title)} title={ctx.text(p.finished.title) || ctx.ui("finished_projects")} subtitle={ctx.text(p.finished.subtitle)} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((pr) => {
            const items = lightboxItems(ctx, pr);
            const hasVideo = items.some((i) => i.kind === "video");
            return (
              <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
                <article className="group overflow-hidden rounded-card border border-line bg-surface">
                  <GalleryOpen index={0} disabled={!items.length} label={ctx.text(pr.title)} className="relative block aspect-[4/3] w-full overflow-hidden text-start">
                    <Img src={coverOf(pr)} alt={ctx.text(pr.title)} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    {hasVideo && <PlayBadge />}
                    {items.length > 1 && <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{items.length}</span>}
                  </GalleryOpen>
                  <ProjectMeta ctx={ctx} project={pr} className="p-5" />
                </article>
              </GalleryFrame>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
