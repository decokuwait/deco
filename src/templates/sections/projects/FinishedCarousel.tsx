import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading } from "../../ui/primitives";
import { Carousel } from "../../ui/client/Carousel";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { SIZES } from "../../ui/img";
import { coverPick, lightboxItems, projectAlt, projectsOf } from "../shared/helpers";

/** Large swipeable cards with caption overlays; tapping a card opens its lightbox. */
export function FinishedCarousel({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "finished");
  return (
    <Section id="projects" tone="secondary" pattern className="overflow-hidden">
      <Container>
        <SectionHeading light eyebrow={ctx.text(p.title)} title={ctx.text(p.finished.title) || ctx.ui("finished_projects")} subtitle={ctx.text(p.finished.subtitle)} />
      </Container>
      <Carousel prevLabel={ctx.ui("prev_slide")} nextLabel={ctx.ui("next_slide")} dotLabelTemplate={`${ctx.ui("go_to_slide")} {n} ${ctx.ui("of")} {total}`} dir={ctx.dir} autoplay={5000} itemClassName="w-[85%] sm:w-[60%] lg:w-[46%]">
        {projects.map((pr) => {
          const items = lightboxItems(ctx, pr);
          const hasVideo = items.some((x) => x.kind === "video");
          const cover = coverPick(pr);
          return (
            <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
              <GalleryOpen index={0} disabled={!items.length} label={ctx.text(pr.title)} className="group relative block w-full overflow-hidden rounded-card text-start shadow-2xl">
                <Img src={cover.url} alt={projectAlt(ctx, pr)} slot="card" focal={cover.focal} sizes={SIZES.half} className="transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                {hasVideo && <PlayBadge />}
                <div className="tone-dark absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                  <div>
                    <div className="font-heading text-xl font-bold">{ctx.text(pr.title)}</div>
                    {ctx.text(pr.location) && <div className="text-xs font-semibold text-accent-text">{ctx.text(pr.location)}</div>}
                  </div>
                  <span className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">{items.length}</span>
                </div>
              </GalleryOpen>
            </GalleryFrame>
          );
        })}
      </Carousel>
    </Section>
  );
}
