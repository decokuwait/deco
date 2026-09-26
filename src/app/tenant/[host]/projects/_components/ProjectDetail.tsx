import type { MediaItem, Project, Service } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { Container, FOCUS_RING, Img, Section, Video, cx } from "@/templates/ui/primitives";
import { SIZES } from "@/templates/ui/img";
import { GalleryFrame, GalleryOpen } from "@/templates/ui/client/GalleryFrame";
import { PlayBadge } from "@/templates/ui/client/Lightbox";
import { BeforeAfterSlider } from "@/templates/ui/client/BeforeAfterSlider";
import { beforeAfterOf, formatStepDate, headingLeading, lightboxItems, mediaAlt, mediaOf, nthAlt, projectAlt } from "@/templates/sections/shared/helpers";
import { Breadcrumbs, HOME_HREF, LeadCta, PROJECTS_HREF, serviceHref, typeLabelKey } from "./shared";
import { ProjectStrip } from "./ProjectsIndex";

/** The media a project shows in its gallery grid, per type: the comparison and the timeline own their own. */
export function galleryMedia(project: Project): MediaItem[] {
  const all = mediaOf(project);
  if (project.type === "before_after") {
    const { before, after } = beforeAfterOf(project);
    return all.filter((m) => m !== before && m !== after);
  }
  if (project.type === "progress") return all.filter((m) => m.role !== "step");
  return all;
}

/** Every picture this page shows, for the `ImageObject` graph. Videos are excluded on purpose. */
export function pageImages(ctx: RenderCtx, project: Project): { url: string; alt: string; caption?: string }[] {
  const images = mediaOf(project).filter((m) => m.kind === "image");
  return images.map((m, i) => ({
    url: m.url,
    alt: nthAlt(ctx, mediaAlt(ctx, m, project), i, images.length),
    caption: ctx.text(m.caption) || undefined,
  }));
}

/**
 * Before/after comparison.
 *
 * The draggable slider keeps both images in the DOM at all times, so both photographs are crawlable —
 * which is half the reason this page exists. A project missing one of the two falls back to whichever it
 * has rather than rendering an empty frame.
 */
function Comparison({ ctx, project }: { ctx: RenderCtx; project: Project }) {
  const { before, after } = beforeAfterOf(project);
  if (!before || !after) {
    const one = before || after;
    if (!one) return null;
    return <Img src={one.url} alt={mediaAlt(ctx, one, project)} sizes={SIZES.full} eager className="w-full rounded-card object-cover" />;
  }
  return (
    <figure>
      <BeforeAfterSlider
        before={before.url}
        after={after.url}
        beforeLabel={ctx.ui("before")}
        afterLabel={ctx.ui("after")}
        beforeAlt={`${ctx.ui("before")} — ${mediaAlt(ctx, before, project)}`}
        afterAlt={`${ctx.ui("after")} — ${mediaAlt(ctx, after, project)}`}
        hint={ctx.ui("drag_hint")}
        dir={ctx.dir}
        aspect="16/10"
      />
      <figcaption className="mt-3 text-sm text-muted">{projectAlt(ctx, project)}</figcaption>
    </figure>
  );
}

/**
 * Progress timeline, rendered on the server with every step visible.
 *
 * The home page uses a stepper or a slideshow, which keeps one photo in the DOM and the rest behind a
 * click: on a page whose purpose is to be indexed that would publish one image out of eight. Here every
 * stage is a figure with its own label, date and alt text.
 */
function Timeline({ ctx, project }: { ctx: RenderCtx; project: Project }) {
  const steps = mediaOf(project).filter((m) => m.role === "step");
  if (!steps.length) return null;
  return (
    <ol className="grid gap-8">
      {steps.map((m, i) => {
        const label = ctx.text(m.stepLabel) || ctx.text(m.caption) || `${ctx.ui("step")} ${i + 1}`;
        const date = formatStepDate(ctx, m.stepDate);
        return (
          <li key={m.id} className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10 font-heading text-base font-black text-primary-text">
              {i + 1}
            </span>
            <figure className="overflow-hidden rounded-card border border-line bg-surface">
              {m.kind === "video" ? (
                <Video item={m} className="aspect-video w-full bg-black object-contain" />
              ) : (
                <Img
                  src={m.url}
                  alt={nthAlt(ctx, mediaAlt(ctx, m, project), i, steps.length)}
                  sizes={SIZES.half}
                  eager={i === 0}
                  className="aspect-[16/10] w-full object-cover"
                />
              )}
              <figcaption className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <span className="font-heading font-bold">{label}</span>
                {date && (
                  <time dateTime={m.stepDate || undefined} className="text-xs font-semibold text-muted">
                    {date}
                  </time>
                )}
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ol>
  );
}

/** Thumbnail grid that opens the project's media in the site's own lightbox. */
function Gallery({ ctx, project, items }: { ctx: RenderCtx; project: Project; items: MediaItem[] }) {
  if (!items.length) return null;
  const all = lightboxItems(ctx, project);
  const indexOf = (m: MediaItem) => Math.max(0, all.findIndex((it) => it.id === m.id));
  return (
    <GalleryFrame items={all} closeLabel={ctx.ui("close")}>
      <h2 className={cx("mb-6 font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{ctx.ui("photo_gallery")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m, i) => (
          <GalleryOpen
            key={m.id}
            index={indexOf(m)}
            label={mediaAlt(ctx, m, project)}
            className={cx("group relative block aspect-[4/3] w-full overflow-hidden rounded-card border border-line bg-surface-2 text-start", FOCUS_RING)}
          >
            {m.kind === "video" ? (
              <>
                <Img src={m.posterUrl || null} alt={mediaAlt(ctx, m, project)} sizes={SIZES.third} className="h-full w-full object-cover" />
                <PlayBadge />
              </>
            ) : (
              <Img
                src={m.url}
                alt={nthAlt(ctx, mediaAlt(ctx, m, project), i, items.length)}
                sizes={SIZES.third}
                eager={i === 0 && project.type === "finished"}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            )}
          </GalleryOpen>
        ))}
      </div>
    </GalleryFrame>
  );
}

/**
 * A single project's page — the highest-value page in this fix programme.
 *
 * It is the only URL on the platform that carries one project's photographs, one Kuwaiti area name and
 * one piece of prose no other tenant has, which is exactly what lifts a site out of the duplicate-content
 * problem. Everything renders on the server; the only client components are the comparison slider and the
 * lightbox, and both keep their images in the DOM.
 */
export function ProjectDetail({
  ctx,
  project,
  related,
  services,
}: {
  ctx: RenderCtx;
  project: Project;
  related: Project[];
  services: { service: Service; slug: string }[];
}) {
  const title = ctx.text(project.title);
  const loc = ctx.text(project.location);
  const description = ctx.text(project.description);
  const gallery = galleryMedia(project);
  const crumbs = [
    { label: ctx.ui("nav_home"), href: HOME_HREF },
    { label: ctx.ui("all_projects"), href: PROJECTS_HREF },
    { label: title },
  ];
  return (
    <>
      <Section tone="surface" className="py-10 sm:py-12" pattern>
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <span className="mt-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary-text">
            {ctx.ui(typeLabelKey(project.type))}
          </span>
          <h1 className={cx("mt-3 font-heading text-3xl font-extrabold sm:text-4xl lg:text-5xl", headingLeading(ctx))}>{title}</h1>
          {loc && (
            <p className="mt-3 text-base font-semibold text-primary-text">
              <span className="text-muted">{ctx.ui("location")}: </span>
              {loc}
            </p>
          )}
          {description && (
            <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-muted">
              {description
                .split(/\n{2,}|\n/)
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
          )}
        </Container>
      </Section>

      <Section tone="bg">
        <Container wide className="grid gap-12">
          {project.type === "before_after" && <Comparison ctx={ctx} project={project} />}
          {project.type === "progress" && <Timeline ctx={ctx} project={project} />}
          <Gallery ctx={ctx} project={project} items={gallery} />
          <LeadCta ctx={ctx} subject={loc ? `${title} — ${loc}` : title} />
          {services.length > 0 && (
            <div>
              <h2 className={cx("mb-4 font-heading text-xl font-extrabold", headingLeading(ctx))}>{ctx.ui("related_services")}</h2>
              <ul className="flex flex-wrap gap-3">
                {services.map(({ service, slug }) => (
                  <li key={service.id}>
                    <a
                      href={serviceHref(slug)}
                      className={cx("inline-flex h-11 items-center rounded-card border border-line bg-surface px-4 font-bold transition hover:border-primary/40 hover:bg-surface-2", FOCUS_RING)}
                    >
                      {ctx.text(service.title)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Container>
      </Section>

      <ProjectStrip ctx={ctx} projects={related} title={ctx.ui("related_projects")} />
    </>
  );
}
