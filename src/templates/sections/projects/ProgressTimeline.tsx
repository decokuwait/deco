import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, cx } from "../../ui/primitives";
import { GalleryFrame, GalleryOpen } from "../../ui/client/GalleryFrame";
import { PlayBadge } from "../../ui/client/Lightbox";
import { progressSlides, projectsOf } from "../shared/helpers";

/** Vertical timeline: one row per step/day with date chip, label and a media thumbnail that opens the lightbox. */
export function ProgressTimeline({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "progress");
  return (
    <Section id="progress" tone="surface" pattern>
      <Container>
        <SectionHeading title={ctx.text(p.progress.title) || ctx.ui("in_progress")} subtitle={ctx.text(p.progress.subtitle)} />
        <div className="grid gap-14">
          {projects.map((pr) => {
            const slides = progressSlides(ctx, pr);
            const items = slides.map((s) => ({ id: s.id, kind: s.kind, url: s.url, posterUrl: s.posterUrl, caption: s.label }));
            return (
              <GalleryFrame key={pr.id} items={items} closeLabel={ctx.ui("close")}>
                <article>
                  <div className="mb-8 text-center">
                    <span className="inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-text">{ctx.ui("in_progress")}</span>
                    <h3 className="mt-2 font-heading text-2xl font-extrabold">{ctx.text(pr.title)}</h3>
                    {ctx.text(pr.location) && <p className="mt-1 text-sm font-semibold text-primary-text">{ctx.text(pr.location)}</p>}
                    {ctx.text(pr.description) && <p className="mx-auto mt-2 max-w-2xl text-muted">{ctx.text(pr.description)}</p>}
                  </div>
                  <ol className="relative border-s-2 border-line ps-8 sm:ms-[calc(50%-1px)] sm:ps-0">
                    {slides.map((s, i) => {
                      const left = i % 2 === 0;
                      return (
                        <li key={s.id} className={cx("relative mb-10 sm:w-1/2", left ? "sm:-ms-[100%] sm:pe-10 sm:text-end" : "sm:ps-10")}>
                          <span className={cx("absolute top-3 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-heading text-xs font-black text-primary-fg ring-4 ring-surface -start-8 sm:-start-4 rtl:translate-x-1/2", left && "sm:start-auto sm:-end-4 rtl:sm:-translate-x-1/2 sm:translate-x-1/2")}>
                            {i + 1}
                          </span>
                          <div className={cx("rounded-card border border-line bg-bg p-4", left ? "sm:ms-auto" : "")}>
                            <div className={cx("flex flex-wrap items-center gap-2 text-xs", left ? "sm:justify-end" : "")}>
                              {s.date && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono font-bold text-muted">{s.date}</span>}
                              <span className="font-heading text-base font-bold">{s.label}</span>
                            </div>
                            <GalleryOpen index={i} label={s.label} className="relative mt-3 block aspect-[16/10] w-full overflow-hidden rounded-card bg-surface-2">
                              <Img src={s.kind === "video" ? s.posterUrl || "" : s.url} alt={s.label} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                              {s.kind === "video" && <PlayBadge />}
                            </GalleryOpen>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </article>
              </GalleryFrame>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
