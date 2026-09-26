import type { ReactNode } from "react";
import type { Project, ProjectType } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { Btn, Container, FOCUS_RING, Img, Section, WhatsAppIcon, cx } from "@/templates/ui/primitives";
import { WhatsAppLink } from "@/templates/ui/client/WhatsAppLink";
import { SIZES } from "@/templates/ui/img";
import { coverOf, headingLeading, projectAlt } from "@/templates/sections/shared/helpers";
import { whatsappLink } from "@/lib/content/defaults";
import type { SiteUiKey } from "@/lib/i18n/site";

/** Root-relative URLs for the inner tenant pages. Every link in the tree goes through these two. */
export function projectHref(slug: string): string {
  return `/projects/${encodeURIComponent(slug)}`;
}
export function serviceHref(slug: string): string {
  return `/services/${encodeURIComponent(slug)}`;
}

export const PROJECTS_HREF = "/projects";
export const SERVICES_HREF = "/services";

/**
 * Links back into the home page.
 *
 * Plain anchors, like every link in the templates: these are fragment targets on a different route, the
 * whole tenant tree is served through a rewrite, and a router navigation would reload the route instead
 * of scrolling. Kept as constants so the intent is stated once rather than inline at each use.
 */
export const HOME_HREF = "/";
export const HOME_FAQ_HREF = "/#faq";

/** UI label for a project type, reusing the dictionary keys the home page already uses for its sections. */
export function typeLabelKey(type: ProjectType): SiteUiKey {
  return type === "finished" ? "finished_projects" : type === "before_after" ? "before_after" : "in_progress";
}

export interface Crumb {
  label: string;
  /** Root-relative. Omitted on the current page, which is rendered as plain text. */
  href?: string;
}

/**
 * Visible breadcrumb trail. Real `<a>` elements, so it is a crawl path and not only JSON-LD, and a
 * visitor who arrives on a project page from an ad has a way up into the rest of the site.
 */
export function Breadcrumbs({ crumbs, className = "" }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label="breadcrumb" className={cx("text-sm text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-x-2">
            {i > 0 && (
              <span aria-hidden className="opacity-50">
                /
              </span>
            )}
            {c.href ? (
              <a href={c.href} className={cx("hover:text-primary-text hover:underline", FOCUS_RING)}>
                {c.label}
              </a>
            ) : (
              <span aria-current="page" className="font-semibold text-fg">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Lead block. The WhatsApp href carries the visitor id exactly as the home page does — `whatsappLink`
 * substitutes `{id}` — with this page's subject appended, so the owner can tell which project or service
 * the message is about without having to ask.
 */
export function LeadCta({ ctx, subject, title, className = "" }: { ctx: RenderCtx; subject?: string; title?: string; className?: string }) {
  const c = ctx.site.content;
  const base = ctx.text(c.contact.whatsappMessage);
  const message = subject ? `${base}\n${ctx.ui("ask_about")}: ${subject}` : base;
  const href = whatsappLink(c.contact.whatsapp, message, ctx.visitorCode);
  return (
    <div className={cx("rounded-card border border-line bg-surface p-6 sm:p-8", className)}>
      <h2 className={cx("font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{title || ctx.text(c.cta.title) || ctx.ui("get_quote")}</h2>
      {ctx.text(c.cta.subtitle) && <p className="mt-2 text-muted">{ctx.text(c.cta.subtitle)}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <WhatsAppLink href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-card bg-primary px-7 py-3.5 font-bold text-primary-fg transition hover:opacity-90", FOCUS_RING)}>
          <WhatsAppIcon />
          {ctx.ui("whatsapp")}
        </WhatsAppLink>
        {c.contact.phone && (
          <WhatsAppLink kind="call_click" href={ctx.telHref} className={cx("inline-flex items-center justify-center gap-2 rounded-card border border-line px-7 py-3.5 font-bold text-fg transition hover:bg-surface-2", FOCUS_RING)}>
            {ctx.ui("call_now")}
          </WhatsAppLink>
        )}
      </div>
    </div>
  );
}

/**
 * Portfolio card that links to the project's own page.
 *
 * `eager` is passed for the first row of the index so the largest contentful paint is not a lazy image.
 */
export function ProjectCard({ ctx, project, eager = false }: { ctx: RenderCtx; project: Project; eager?: boolean }) {
  const loc = ctx.text(project.location);
  const count = project.media.length;
  const slug = (project.slug || "").trim();
  const body = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
        <Img src={coverOf(project)} alt={projectAlt(ctx, project)} sizes={SIZES.third} eager={eager} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <span className="absolute top-3 start-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">{ctx.ui(typeLabelKey(project.type))}</span>
        {count > 1 && <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">{count}</span>}
      </div>
      <div className="p-5">
        <h3 className={cx("font-heading text-lg font-bold group-hover:text-primary-text", headingLeading(ctx))}>{ctx.text(project.title)}</h3>
        {loc && <p className="mt-1 text-xs font-semibold text-primary-text">{loc}</p>}
        {ctx.text(project.description) && <p className="mt-2 line-clamp-2 text-sm text-muted">{ctx.text(project.description)}</p>}
      </div>
    </>
  );
  return (
    <article className="group overflow-hidden rounded-card border border-line bg-surface transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
      {/* A project with no slug has no page of its own; it still shows as a card rather than vanishing. */}
      {slug ? (
        <a href={projectHref(slug)} className={cx("block text-start", FOCUS_RING)}>
          {body}
        </a>
      ) : (
        body
      )}
    </article>
  );
}

/** "Nothing here yet" panel: a brand-new tenant must not be shown a broken or embarrassing page. */
export function EmptyState({ ctx, title, text, children }: { ctx: RenderCtx; title: string; text: string; children?: ReactNode }) {
  return (
    <Section tone="bg">
      <Container className="max-w-2xl text-center">
        <h2 className={cx("font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{title}</h2>
        <p className="mt-3 text-muted">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Btn ctx={ctx} href={HOME_HREF} variant="primary">
            {ctx.ui("back_home")}
          </Btn>
          <WhatsAppLink href={ctx.whatsappHref} className={cx("inline-flex items-center rounded-card border border-line px-6 py-3 font-bold text-fg hover:bg-surface-2", FOCUS_RING)}>
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
        </div>
        {children}
      </Container>
    </Section>
  );
}
