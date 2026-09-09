import type { MediaItem, Project, ProjectType } from "@/lib/types";
import type { RenderCtx, SectionKey } from "../../types";
import type { LightboxItem } from "../../ui/client/Lightbox";
import type { ProgressSlide } from "../../ui/client/ProgressSlideshow";

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

export function navLinks(ctx: RenderCtx): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [{ href: "#top", label: ctx.ui("nav_home") }];
  if (sectionEnabled(ctx, "about")) links.push({ href: "#about", label: ctx.ui("nav_about") });
  if (sectionEnabled(ctx, "services")) links.push({ href: "#services", label: ctx.ui("nav_services") });
  if (sectionEnabled(ctx, "finished") || sectionEnabled(ctx, "beforeAfter") || sectionEnabled(ctx, "progress")) links.push({ href: "#projects", label: ctx.ui("nav_projects") });
  if (sectionEnabled(ctx, "faq")) links.push({ href: "#faq", label: ctx.ui("nav_faq") });
  links.push({ href: "#contact", label: ctx.ui("nav_contact") });
  return links;
}

/** First projects section id, so the hero "see our work" button can scroll to it. */
export function projectsAnchor(ctx: RenderCtx): string {
  if (sectionEnabled(ctx, "finished")) return "#projects";
  if (sectionEnabled(ctx, "beforeAfter")) return "#before-after";
  if (sectionEnabled(ctx, "progress")) return "#progress";
  return "#services";
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
  const items = mediaOf(project).map((m) => ({ id: m.id, kind: m.kind, url: m.url, posterUrl: m.posterUrl, caption: ctx.text(m.caption) || ctx.text(project.title) }));
  if (!items.length && project.coverUrl) items.push({ id: `${project.id}-cover`, kind: "image", url: project.coverUrl, posterUrl: null, caption: ctx.text(project.title) });
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
      date: m.stepDate,
    }));
}

export function formatPhone(p: string | undefined | null): string {
  const d = (p || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (d.startsWith("965") && d.length === 11) return `+965 ${d.slice(3, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
