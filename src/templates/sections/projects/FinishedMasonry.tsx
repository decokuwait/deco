import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, cx } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { coverOf, lightboxItems, projectsOf } from "../shared/helpers";

const RATIOS = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-[5/6]", "aspect-square"];

/** CSS-columns masonry with varying aspect ratios; captions slide up on hover. */
export function FinishedMasonry({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "finished");
  return (
    <Section id="projects" tone="surface" pattern>
      <Container wide>
        <SectionHeading eyebrow={ctx.text(p.title)} title={ctx.text(p.finished.title) || ctx.ui("finished_projects")} subtitle={ctx.text(p.finished.subtitle)} />
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {projects.map((pr, i) => {
            const items = lightboxItems(ctx, pr);
            const hasVideo = items.some((x) => x.kind === "video");
            return (
              <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
                <GalleryOpen index={0} disabled={!items.length} label={ctx.text(pr.title)} className={cx("group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-card bg-surface-2 text-start", RATIOS[i % RATIOS.length])}>
                  <Img src={coverOf(pr)} alt={ctx.text(pr.title)} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90 transition group-hover:opacity-100" />
                  {hasVideo && <PlayBadge className="opacity-90" />}
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <div className="font-heading text-lg font-bold drop-shadow">{ctx.text(pr.title)}</div>
                    {ctx.text(pr.location) && <div className="text-xs font-semibold text-accent">{ctx.text(pr.location)}</div>}
                    <div className="mt-1 max-h-0 overflow-hidden text-xs text-white/80 transition-all duration-500 group-hover:max-h-16">{ctx.text(pr.description)}</div>
                  </div>
                  {items.length > 1 && <span className="absolute end-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{items.length}</span>}
                </GalleryOpen>
              </GalleryFrame>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
