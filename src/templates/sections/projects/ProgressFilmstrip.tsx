import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, Video, cx } from "../../ui/primitives";
import { RATIO } from "../../ui/ratios";
import { SIZES } from "../../ui/img";
import { progressSlides, projectsOf } from "../shared/helpers";

/** Horizontal snap-scroll filmstrip: every step is a frame with its label and date; videos play inline. */
export function ProgressFilmstrip({ ctx }: SectionProps) {
  const p = ctx.site.content.projects;
  const projects = projectsOf(ctx, "progress");
  return (
    <Section id="progress" tone="secondary" pattern className="overflow-hidden">
      <Container>
        <SectionHeading light title={ctx.text(p.progress.title) || ctx.ui("in_progress")} subtitle={ctx.text(p.progress.subtitle) || ctx.ui("progress_hint")} />
      </Container>
      <div className="grid gap-12">
        {projects.map((pr) => {
          const slides = progressSlides(ctx, pr);
          return (
            <article key={pr.id}>
              <Container className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-xl font-extrabold sm:text-2xl">{ctx.text(pr.title)}</h3>
                  {ctx.text(pr.location) && <p className="text-xs font-semibold text-accent-text">{ctx.text(pr.location)}</p>}
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold">
                  {slides.length} {ctx.ui("step")}
                </span>
              </Container>
              <div dir={ctx.dir} className="no-scrollbar snap-x-mandatory flex gap-3 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8">
                {slides.map((s, i) => (
                  <figure key={s.id} className="snap-item w-[78%] shrink-0 overflow-hidden rounded-card bg-black/30 ring-1 ring-white/15 sm:w-[46%] lg:w-[32%]">
                    {/* The video branch keeps the frame black and `object-contain`: a clip shot vertically
                        must not be cropped to the step's ratio, so it letterboxes inside the same box the
                        photographs reserve and the filmstrip stays even either way. */}
                    <div className={cx("relative bg-black", RATIO.step)}>
                      {s.kind === "video" ? <Video item={{ url: s.url, posterUrl: s.posterUrl }} className="h-full w-full object-contain" /> : <Img src={s.url} alt={s.alt} fill focal={s.focal} sizes={SIZES.third} />}
                      <span className="absolute start-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent font-heading text-sm font-black text-accent-fg">{i + 1}</span>
                    </div>
                    <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                      <span className="font-heading font-bold">{s.label}</span>
                      {s.date && <span className="text-xs opacity-75">{s.date}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
