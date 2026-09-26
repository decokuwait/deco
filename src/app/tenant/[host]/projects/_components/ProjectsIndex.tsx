import type { Project, ProjectType } from "@/lib/types";
import { PROJECT_TYPES } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { Container, FOCUS_RING, Section, cx } from "@/templates/ui/primitives";
import { headingLeading } from "@/templates/sections/shared/helpers";
import { Breadcrumbs, EmptyState, HOME_HREF, LeadCta, ProjectCard, PROJECTS_HREF, SERVICES_HREF, projectHref, typeLabelKey } from "./shared";

/** One page of the portfolio holds this many projects. Beyond it the index paginates rather than grow. */
export const PAGE_SIZE = 24;

export interface IndexPageData {
  /** The projects on this page, already sliced. */
  projects: Project[];
  page: number;
  pageCount: number;
  total: number;
}

/** Split a page's projects into the three trade groupings, preserving their stored order. */
function groupByType(projects: Project[]): { type: ProjectType; items: Project[] }[] {
  return PROJECT_TYPES.map((type) => ({ type, items: projects.filter((p) => p.type === type) })).filter((g) => g.items.length > 0);
}

export function paginate(all: Project[], page: number): IndexPageData {
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  return { projects: all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pageCount, total: all.length };
}

/**
 * Pagination controls.
 *
 * Plain numbered links, because that is what a crawler follows; `rel=prev/next` is deliberately absent
 * (Google retired it in 2019 and each page self-canonicalises instead). Hidden entirely on one page.
 */
function Pager({ ctx, page, pageCount }: { ctx: RenderCtx; page: number; pageCount: number }) {
  if (pageCount < 2) return null;
  const href = (n: number) => (n <= 1 ? PROJECTS_HREF : `${PROJECTS_HREF}?page=${n}`);
  const link = cx("inline-flex h-11 min-w-11 items-center justify-center rounded-card border border-line px-3 text-sm font-bold transition hover:border-primary/40 hover:bg-surface-2", FOCUS_RING);
  return (
    <nav aria-label="pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <a href={href(page - 1)} rel="prev" className={link}>
          {ctx.ui("prev_page")}
        </a>
      )}
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) =>
        n === page ? (
          <span key={n} aria-current="page" className={cx(link, "border-primary bg-primary text-primary-fg")}>
            {n}
          </span>
        ) : (
          <a key={n} href={href(n)} className={link}>
            {n}
          </a>
        ),
      )}
      {page < pageCount && (
        <a href={href(page + 1)} rel="next" className={link}>
          {ctx.ui("next_page")}
        </a>
      )}
    </nav>
  );
}

/**
 * The portfolio index: every published project on the site, each one a link to its own page.
 *
 * Grouped by trade rather than filtered with a query string. A `?type=` filter would put the same card on
 * two crawlable URLs for no gain, which is exactly the duplicate-content problem these pages exist to
 * solve; the group headings are anchor targets instead, so the nav can still point at one of them.
 */
export function ProjectsIndex({ ctx, data }: { ctx: RenderCtx; data: IndexPageData }) {
  const c = ctx.site.content;
  const heading = ctx.text(c.projects.title) || ctx.ui("nav_projects");
  const crumbs = [{ label: ctx.ui("nav_home"), href: HOME_HREF }, { label: ctx.ui("all_projects") }];

  if (!data.total) {
    return (
      <>
        <Section tone="surface" className="py-10 sm:py-12">
          <Container>
            <Breadcrumbs crumbs={crumbs} />
            <h1 className={cx("mt-4 font-heading text-3xl font-extrabold sm:text-4xl", headingLeading(ctx))}>{heading}</h1>
          </Container>
        </Section>
        <EmptyState ctx={ctx} title={ctx.ui("no_projects_title")} text={ctx.ui("no_projects_text")} />
      </>
    );
  }

  const groups = groupByType(data.projects);
  let rendered = 0;
  return (
    <>
      <Section tone="surface" className="py-10 sm:py-12" pattern>
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <h1 className={cx("mt-4 font-heading text-3xl font-extrabold sm:text-4xl", headingLeading(ctx))}>{heading}</h1>
          {ctx.text(c.projects.subtitle) && <p className="mt-3 max-w-2xl text-lg text-muted">{ctx.text(c.projects.subtitle)}</p>}
          {groups.length > 1 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {groups.map((g) => (
                <li key={g.type}>
                  <a href={`#${g.type}`} className={cx("inline-flex h-11 items-center rounded-full border border-line bg-bg px-4 text-sm font-bold transition hover:border-primary/40", FOCUS_RING)}>
                    {ctx.ui(typeLabelKey(g.type))}
                    <span className="ms-2 text-muted">{g.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>

      <Section tone="bg">
        <Container wide>
          {groups.map((g) => (
            <section key={g.type} id={g.type} className="mb-14 last:mb-0 scroll-mt-24">
              <h2 className={cx("mb-6 font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{ctx.ui(typeLabelKey(g.type))}</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => {
                  // Only the first row is eager: those are the images that decide the largest contentful paint.
                  const eager = rendered++ < 3;
                  return <ProjectCard key={p.id} ctx={ctx} project={p} eager={eager} />;
                })}
              </div>
            </section>
          ))}
          <Pager ctx={ctx} page={data.page} pageCount={data.pageCount} />
        </Container>
      </Section>

      <Section tone="surface">
        <Container className="grid gap-6">
          <LeadCta ctx={ctx} subject={heading} />
          {ctx.site.content.services.items.length > 0 && (
            <p className="text-center text-muted">
              <a href={SERVICES_HREF} className={cx("font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
                {ctx.ui("nav_services")}
              </a>
            </p>
          )}
        </Container>
      </Section>
    </>
  );
}

/** Compact "more of our work" strip used at the bottom of a project or service page. */
export function ProjectStrip({ ctx, projects, title }: { ctx: RenderCtx; projects: Project[]; title: string }) {
  if (!projects.length) return null;
  return (
    <Section tone="surface">
      <Container wide>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={cx("font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{title}</h2>
          <a href={PROJECTS_HREF} className={cx("text-sm font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
            {ctx.ui("all_projects")}
          </a>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} ctx={ctx} project={p} />
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** Text link to a single project, used where a card would be too heavy. */
export function ProjectLink({ ctx, project }: { ctx: RenderCtx; project: Project }) {
  const slug = (project.slug || "").trim();
  if (!slug) return null;
  return (
    <a href={projectHref(slug)} className={cx("font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
      {ctx.text(project.title)}
    </a>
  );
}
