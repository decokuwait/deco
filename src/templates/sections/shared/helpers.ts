import type { MediaItem, Project, ProjectType } from "@/lib/types";
import type { RenderCtx, SectionKey } from "../../types";
import type { LightboxItem } from "../../ui/client/Lightbox";
import type { ProgressSlide } from "../../ui/client/ProgressSlideshow";
import { effectiveTokens } from "../../ctx";
import { arabicHeadingLeading, isDisplayFont } from "../../fonts";
import { internationalDigits } from "@/lib/content/defaults";

/**
 * Font class for long text that a section wants in the heading face (a story quote, a testimonial): the
 * heading font when it is a text face, the body font when it is a calligraphic / display face that only
 * works at headline size.
 */
export function longTextFont(ctx: RenderCtx): "font-heading" | "font-body" {
  return isDisplayFont(effectiveTokens(ctx.def, ctx.site).headingFont) ? "font-body" : "font-heading";
}

/**
 * Arabic line-height floor for a heading set in the site's own heading face — see `AR_LEADING`. A section
 * adds it next to its Latin `leading-*`, which it overrides on an Arabic page.
 */
export function headingLeading(ctx: RenderCtx): string {
  return arabicHeadingLeading(effectiveTokens(ctx.def, ctx.site).headingFont);
}

/**
 * Alt text for a picture of a project. Never `""`: an empty alt declares an image decorative, and these
 * photographs are the content of the page (WCAG 1.1.1 Level A). The authored `MediaItem.alt` wins, then
 * the caption, then a description generated from what the project already tells us.
 */
export function projectAlt(ctx: RenderCtx, project: Project): string {
  const parts = [ctx.text(project.title), ctx.text(project.location)].filter(Boolean);
  return parts.join(" — ") || ctx.text(ctx.site.content.brand.name) || ctx.ui("photo");
}

export function mediaAlt(ctx: RenderCtx, item: MediaItem, project: Project): string {
  return ctx.text(item.alt) || ctx.text(item.caption) || projectAlt(ctx, project);
}

/** "… — 2 من 5" for one picture out of a set, so a screen reader can tell them apart. */
export function nthAlt(ctx: RenderCtx, base: string, i: number, total: number): string {
  return total > 1 ? `${base} — ${i + 1} ${ctx.ui("of")} ${total}` : base;
}

/**
 * What the hero's <h1> says. A site whose hero title has not been filled in used to render an empty <h1>
 * in all ten hero variants — no page heading at all, for a visitor and for a search engine.
 */
export function heroTitle(ctx: RenderCtx): string {
  const c = ctx.site.content;
  return ctx.text(c.hero.title) || ctx.text(c.brand.name) || ctx.text(c.brand.tagline) || ctx.ui("nav_home");
}

/** Alt text for a hero picture, which illustrates the headline it sits beside. */
export function heroAlt(ctx: RenderCtx): string {
  const c = ctx.site.content;
  return ctx.text(c.hero.title) || ctx.text(c.brand.name) || ctx.ui("photo");
}

/**
 * A step date is stored as a bare `YYYY-MM-DD`, and every progress section printed it exactly like that —
 * `2026-01-15` on an Arabic page, while the admin has formatted its dates with `Intl` all along. Same
 * convention as the admin: Latin numerals inside Arabic (`ar-KW-u-nu-latn`, what Kuwaiti sites use) and
 * Kuwait time, so a date does not slip a day on a server running in UTC.
 */
export function formatStepDate(ctx: RenderCtx, iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(ctx.locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Kuwait" }).format(d);
}

export function projectsOf(ctx: RenderCtx, type: ProjectType): Project[] {
  return ctx.site.projects.filter((p) => p.type === type && p.published);
}

export function projectsEnabled(ctx: RenderCtx, type: ProjectType): boolean {
  const p = ctx.site.content.projects;
  const flag = type === "finished" ? p.finished.enabled : type === "before_after" ? p.beforeAfter.enabled : p.progress.enabled;
  return flag && projectsOf(ctx, type).length > 0;
}

export function sectionEnabled(ctx: RenderCtx, key: SectionKey): boolean {
  const c = ctx.site.content;
  switch (key) {
    case "hero":
    case "contact":
      return true;
    case "about":
      return c.sections.about && !!(c.about.title.ar || c.about.title.en || c.about.body.ar || c.about.body.en);
    case "services":
      return c.sections.services && c.services.items.length > 0;
    case "stats":
      return c.sections.stats && c.stats.length > 0;
    case "process":
      return c.sections.process && c.process.steps.length > 0;
    case "testimonials":
      return c.sections.testimonials && c.testimonials.items.length > 0;
    case "faq":
      return c.sections.faq && c.faq.items.length > 0;
    case "cta":
      return c.sections.cta;
    case "finished":
      return projectsEnabled(ctx, "finished");
    case "beforeAfter":
      return projectsEnabled(ctx, "before_after");
    case "progress":
      return projectsEnabled(ctx, "progress");
  }
}

/** Anchor links are root-relative so they also work from inner pages such as /privacy. */
export function navLinks(ctx: RenderCtx): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [{ href: "/#top", label: ctx.ui("nav_home") }];
  if (sectionEnabled(ctx, "about")) links.push({ href: "/#about", label: ctx.ui("nav_about") });
  if (sectionEnabled(ctx, "services")) links.push({ href: "/#services", label: ctx.ui("nav_services") });
  if (sectionEnabled(ctx, "finished") || sectionEnabled(ctx, "beforeAfter") || sectionEnabled(ctx, "progress")) links.push({ href: projectsAnchor(ctx), label: ctx.ui("nav_projects") });
  if (sectionEnabled(ctx, "faq")) links.push({ href: "/#faq", label: ctx.ui("nav_faq") });
  links.push({ href: "/#contact", label: ctx.ui("nav_contact") });
  return links;
}

/** Legal links for footers (privacy policy page) — hidden in template previews and when the text is empty. */
export function legalLinks(ctx: RenderCtx): { href: string; label: string }[] {
  if (ctx.preview) return [];
  const legal = ctx.site.content.legal;
  if (!legal || !ctx.text(legal.privacy)) return [];
  return [{ href: "/privacy", label: ctx.text(legal.privacyTitle) || ctx.ui("privacy_policy") }];
}

/** First projects section id, so the hero "see our work" button can scroll to it. */
export function projectsAnchor(ctx: RenderCtx): string {
  if (sectionEnabled(ctx, "finished")) return "/#projects";
  if (sectionEnabled(ctx, "beforeAfter")) return "/#before-after";
  if (sectionEnabled(ctx, "progress")) return "/#progress";
  return "/#services";
}

export function mediaOf(project: Project): MediaItem[] {
  return [...project.media].sort((a, b) => a.order - b.order);
}

export function coverOf(project: Project): string | null {
  if (project.coverUrl) return project.coverUrl;
  const first = mediaOf(project).find((m) => m.kind === "image") || mediaOf(project)[0];
  return first ? first.posterUrl || first.url : null;
}

export function lightboxItems(ctx: RenderCtx, project: Project): LightboxItem[] {
  const media = mediaOf(project);
  const items: LightboxItem[] = media.map((m, i) => ({
    id: m.id,
    kind: m.kind,
    url: m.url,
    posterUrl: m.posterUrl,
    caption: ctx.text(m.caption) || ctx.text(project.title),
    alt: nthAlt(ctx, mediaAlt(ctx, m, project), i, media.length),
  }));
  if (!items.length && project.coverUrl) items.push({ id: `${project.id}-cover`, kind: "image", url: project.coverUrl, posterUrl: null, caption: ctx.text(project.title), alt: projectAlt(ctx, project) });
  return items;
}

export function beforeAfterOf(project: Project): { before: MediaItem | null; after: MediaItem | null } {
  const m = mediaOf(project);
  return { before: m.find((x) => x.role === "before") ?? null, after: m.find((x) => x.role === "after") ?? null };
}

export function progressSlides(ctx: RenderCtx, project: Project): ProgressSlide[] {
  return mediaOf(project)
    .filter((m) => m.role === "step" || m.role === "gallery")
    .map((m, i) => ({
      id: m.id,
      kind: m.kind,
      url: m.url,
      posterUrl: m.posterUrl,
      label: ctx.text(m.stepLabel) || ctx.text(m.caption) || `${ctx.ui("step")} ${i + 1}`,
      date: formatStepDate(ctx, m.stepDate),
      alt: ctx.text(m.alt) || ctx.text(m.stepLabel) || ctx.text(m.caption) || projectAlt(ctx, project),
    }));
}

/** Display form of a phone number. Shares one normaliser with `telLink`, so both agree on `00…` input. */
export function formatPhone(p: string | undefined | null): string {
  const d = internationalDigits(p);
  if (!d) return "";
  if (d.startsWith("965") && d.length === 11) return `+965 ${d.slice(3, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
