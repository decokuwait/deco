import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer, TemplateShell } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { navLinks } from "@/templates/sections/shared/helpers";
import { LOCALES } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

/**
 * "Home" did nothing.
 *
 * The link is `/#top` and `id="top"` used to sit on the sticky `<header>`. A sticky element never leaves
 * the viewport, so the browser considered the anchor already in view and scrolled nowhere — and a cold
 * load of `/#top` was worse still, because the target moved down with every scroll step and the page
 * landed 8586px in. The target is now a zero-height, static span rendered *before* the bar, so it is a
 * fixed point at y=0. These assertions are the shape of that fix: one target, outside the sticky element,
 * ahead of it in the document.
 */
describe("the Home link scrolls to the top of the page", () => {
  it.each(TEMPLATES.map((t) => [t.code, t] as const))("template %s anchors #top above its sticky bar", (_code, def) => {
    for (const locale of LOCALES) {
      const site = previewSiteData(def);
      const ctx = buildCtx({ site, def, locale, visitorCode: "654321", preview: true });
      const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);

      // Exactly one target, or the browser picks the first and the other is dead markup.
      const targets = html.match(/id="top"/g) ?? [];
      expect(targets, `${def.code}/${locale}: expected one #top, found ${targets.length}`).toHaveLength(1);

      // It is not the header itself: a sticky/fixed bar is always in view, which is the bug.
      const header = html.slice(html.indexOf("<header"), html.indexOf(">", html.indexOf("<header")) + 1);
      expect(header, `${def.code}/${locale}: #top is back on the sticky header`).not.toContain('id="top"');

      // And it sits above the bar in the document, so scrolling to it means scrolling to the very top.
      const anchor = html.indexOf('id="top"');
      expect(anchor, `${def.code}/${locale}: no #top target`).toBeGreaterThan(-1);
      expect(anchor, `${def.code}/${locale}: #top renders after the header`).toBeLessThan(html.indexOf("<header"));

      // The element carrying it must not be positioned, or it travels with the viewport again.
      const tag = html.slice(html.lastIndexOf("<", anchor), html.indexOf(">", anchor) + 1);
      expect(tag).not.toMatch(/\bclass="[^"]*\b(sticky|fixed)\b/);

      // And "Home" still points at it. Inside a preview the site is mounted under /template/<code>, so the
      // link is the bare hash — a root-relative one would leave the preview instead of scrolling it.
      expect(navLinks(ctx)[0]).toEqual({ href: "#top", label: ctx.ui("nav_home") });
      expect(html, `${def.code}/${locale}: no Home link`).toContain('href="#top"');

      // On a live HOME page the link is the bare hash too, and for a measured reason rather than a
      // preference: a root-relative `/#top` resolves against the origin, so from `/?utm_source=meta` it
      // names a different URL than the one being viewed and the browser reloads the page instead of
      // scrolling. Every Meta and TikTok ad click arrives with UTM parameters, so the absolute form broke
      // in-page navigation for exactly the paid traffic the site exists to convert.
      const live = buildCtx({ site, def, locale, visitorCode: "654321", preview: false });
      expect(navLinks(live)[0]).toEqual({ href: "#top", label: live.ui("nav_home") });
      expect(renderToStaticMarkup(<TemplateRenderer ctx={live} />)).toContain('href="#top"');

      // An INNER page (/projects, /services) is the case the absolute form exists for: the section really
      // is on another document there, so the root-relative href is kept.
      const inner = buildCtx({ site, def, locale, visitorCode: "654321", preview: false, home: false });
      expect(navLinks(inner)[0]).toEqual({ href: "/#top", label: inner.ui("nav_home") });
    }
  });

  it("inner pages (the shell around /privacy) carry the same single target", () => {
    const def = TEMPLATES[0];
    const site = previewSiteData(def);
    const ctx = buildCtx({ site, def, locale: "ar", visitorCode: null, preview: false });
    const html = renderToStaticMarkup(
      <TemplateShell ctx={ctx}>
        <p>x</p>
      </TemplateShell>,
    );
    expect(html.match(/id="top"/g) ?? []).toHaveLength(1);
    expect(html.indexOf('id="top"')).toBeLessThan(html.indexOf("<header"));
  });
});
