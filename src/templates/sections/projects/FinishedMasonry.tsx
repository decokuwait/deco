import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, cx } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { SIZES } from "../../ui/img";
import { coverPick, lightboxItems, projectAlt, projectsOf } from "../shared/helpers";
import { RATIO } from "../../ui/ratios";

/**
 * The rhythm of cell shapes down the masonry columns.
 *
 * It used to be six hand-written ratios — 4/5, square, 3/4, 4/3, 5/6, square — six different crops, none
 * of them the shape any other section reserves, so the same photograph was cut six ways depending on where
 * it happened to land. The variety is the point of a masonry wall, so it stays, but it now comes from two
 * contract slots: a tall cell and a wide one. They agree on 4/3 on a phone, which is what makes the single
 * column read as a column instead of a stack of unrelated shapes, and diverge from `sm` up where there are
 * two or three columns for the eye to compare.
 */
const CELLS = [RATIO.cardTall, RATIO.card, RATIO.cardTall, RATIO.cardTall, RATIO.card, RATIO.cardTall];

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
            const cover = coverPick(pr);
            return (
              <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
                <GalleryOpen index={0} disabled={!items.length} label={ctx.text(pr.title)} className={cx("group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-card bg-surface-2 text-start", CELLS[i % CELLS.length])}>
                  <Img src={cover.url} alt={projectAlt(ctx, pr)} fill focal={cover.focal} sizes={SIZES.third} className="transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-90 transition group-hover:opacity-100" />
                  {hasVideo && <PlayBadge className="opacity-90" />}
                  <div className="tone-dark absolute inset-x-0 bottom-0 p-4 text-white">
                    <div className="font-heading text-lg font-bold drop-shadow">{ctx.text(pr.title)}</div>
                    {ctx.text(pr.location) && <div className="text-xs font-semibold text-accent-text">{ctx.text(pr.location)}</div>}
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
