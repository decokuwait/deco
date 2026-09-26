import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { SIZES } from "../../ui/img";
import { coverPick, lightboxItems, projectAlt, projectsOf } from "../shared/helpers";
import { ProjectMeta } from "./shared";

/** Horizontal snap-scrolling strip of tall portrait cards, cinema style. */
export function FinishedFilmstrip({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "finished");
  return (
    <Section id="projects" tone="surface2" className="overflow-hidden">
      <Container wide className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading align="start" className="mb-0 sm:mb-0" eyebrow={ctx.text(p.title)} title={ctx.text(p.finished.title) || ctx.ui("finished_projects")} subtitle={ctx.text(p.finished.subtitle)} />
        <span className="hidden text-xs font-bold uppercase tracking-widest text-muted sm:block">{ctx.ui("progress_hint")}</span>
      </Container>
      <div dir={ctx.dir} className="no-scrollbar snap-x-mandatory mt-8 flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
        {projects.map((pr, i) => {
          const items = lightboxItems(ctx, pr);
          const hasVideo = items.some((x) => x.kind === "video");
          const cover = coverPick(pr);
          return (
            <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
              <article className="snap-item w-[72%] shrink-0 sm:w-[44%] lg:w-[26%]">
                <GalleryOpen index={0} disabled={!items.length} label={ctx.text(pr.title)} className="group relative block w-full overflow-hidden rounded-card text-start shadow-lg ring-1 ring-line">
                  <Img src={cover.url} alt={projectAlt(ctx, pr)} slot="cardPortrait" focal={cover.focal} sizes={SIZES.third} className="transition duration-700 group-hover:scale-105" />
                  <span className="absolute start-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
                  {hasVideo && <PlayBadge />}
                  <span className="absolute bottom-3 end-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-black">{items.length}</span>
                </GalleryOpen>
                <ProjectMeta ctx={ctx} project={pr} className="px-1 pt-4" compact />
              </article>
            </GalleryFrame>
          );
        })}
      </div>
    </Section>
  );
}
