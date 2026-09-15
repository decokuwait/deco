import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { LOCALES } from "@/lib/types";
import { DEFAULT_ORDER } from "@/templates/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

describe("template rendering", () => {
  it.each(TEMPLATES.map((t) => [t.code, t] as const))("template %s renders in both languages with visitor id and all project types", (_code, def) => {
    for (const locale of LOCALES) {
      const site = previewSiteData(def);
      const ctx = buildCtx({ site, def, locale, visitorCode: "654321", preview: true });
      const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
      expect(html.length).toBeGreaterThan(20000);
      // WhatsApp links carry the 6-digit visitor id inside the prefilled message
      const wa = html.match(/https:\/\/wa\.me\/96550000000\?text=([^"]+)"/);
      expect(wa, `${def.code}/${locale} wa.me link`).toBeTruthy();
      expect(decodeURIComponent(wa![1].replace(/&amp;/g, "&"))).toContain("654321");
      // direction + language
      expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(html).toContain(`data-template="${def.code}"`);
      // sections present
      for (const id of ["top", "about", "services", "projects", "before-after", "progress", "faq", "contact"]) {
        expect(html, `${def.code}/${locale} missing #${id}`).toContain(`id="${id}"`);
      }
      // localized brand appears
      expect(html).toContain(locale === "ar" ? site.content.brand.name.ar : site.content.brand.name.en);
      // progress steps are rendered with their labels (first step of the first progress project)
      const firstStep = site.projects.find((p) => p.type === "progress")!.media[0].stepLabel![locale].replace(/&/g, "&amp;");
      expect(html, `${def.code}/${locale} progress step label`).toContain(firstStep);
      // before/after labels present
      expect(html).toContain(locale === "ar" ? "قبل" : "Before");
      // fonts are self-hosted: no third-party stylesheet
      expect(html).not.toContain("fonts.googleapis.com");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("[object Object]");
    }
  });

  // Tailwind v4 orders single-property utilities alphabetically, so `hidden` (display:none) loses to any
  // later display utility on the same element: `inline-flex hidden md:inline-flex` never hides. Such an
  // element stays visible on phones and pushes its neighbours off the screen. Hide with `max-md:hidden`.
  it.each(TEMPLATES.map((t) => [t.code, t] as const))("template %s never pairs `hidden` with a stronger display utility", (_code, def) => {
    const inlineFamily = new Set(["inline", "inline-block", "inline-flex", "inline-grid", "inline-table", "table", "table-cell", "table-row"]);
    for (const locale of LOCALES) {
      const site = previewSiteData(def);
      const ctx = buildCtx({ site, def, locale, visitorCode: "654321", preview: true });
      const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        const tokens = m[1].split(/\s+/).filter((t) => t && !t.includes(":"));
        if (!tokens.includes("hidden")) continue;
        const clash = tokens.filter((t) => inlineFamily.has(t));
        expect(clash, `${def.code}/${locale}: "${m[1]}" combines hidden with ${clash.join(", ")}`).toEqual([]);
      }
    }
  });

  it("hides disabled project types and sections", () => {
    const def = TEMPLATES[0];
    const site = previewSiteData(def);
    site.content.projects.beforeAfter.enabled = false;
    site.content.projects.progress.enabled = false;
    site.content.sections.faq = false;
    site.content.sections.testimonials = false;
    const ctx = buildCtx({ site, def, locale: "ar", visitorCode: null, preview: true });
    const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
    expect(html).toContain('id="projects"');
    expect(html).not.toContain('id="before-after"');
    expect(html).not.toContain('id="progress"');
    expect(html).not.toContain('id="faq"');
    expect(html).not.toContain(site.content.testimonials.items[0].text.ar);
  });

  it("hides a project type when enabled but empty", () => {
    const def = TEMPLATES[5];
    const site = previewSiteData(def);
    site.projects = site.projects.filter((p) => p.type !== "progress");
    const ctx = buildCtx({ site, def, locale: "en", visitorCode: "111111", preview: true });
    const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
    expect(html).not.toContain('id="progress"');
    expect(html).toContain('id="before-after"');
  });

  it("applies admin theme overrides", () => {
    const def = TEMPLATES[10];
    const site = previewSiteData(def);
    site.content.theme = { primary: "#123456", headingFont: "amiri" };
    const ctx = buildCtx({ site, def, locale: "ar", visitorCode: "111111", preview: true });
    const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
    expect(html).toContain("--t-primary:#123456");
    expect(html).toContain("Amiri");
  });

  it("renders with completely empty content without crashing", () => {
    const def = TEMPLATES[20];
    const site = previewSiteData(def);
    site.content = JSON.parse(JSON.stringify(site.content));
    const strip = (o: unknown): unknown => {
      if (Array.isArray(o)) return [];
      if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, strip(v)]));
      if (typeof o === "string") return "";
      return o;
    };
    site.content = { ...(strip(site.content) as typeof site.content), settings: site.content.settings, sections: site.content.sections, projects: { ...site.content.projects } };
    site.projects = [];
    const ctx = buildCtx({ site, def, locale: "ar", visitorCode: null, preview: true });
    const html = renderToStaticMarkup(<TemplateRenderer ctx={ctx} />);
    expect(html).toContain('id="contact"');
  });
});

describe("site-level rendering options", () => {
  it("links the privacy page from the footer on real sites (not in previews) and honours label overrides", () => {
    const def = TEMPLATES[3];
    const site = previewSiteData(def);
    site.content.ui = { whatsapp: { ar: "واتس فوري", en: "Chat now" } };
    const live = renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale: "en", visitorCode: "222222", preview: false })} />);
    expect(live).toContain('href="/privacy"');
    expect(live).toContain(site.content.legal.privacyTitle.en);
    expect(live).toContain("Chat now");
    expect(live).not.toContain('aria-label="WhatsApp us"');
    const preview = renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale: "en", visitorCode: "222222", preview: true })} />);
    expect(preview).not.toContain('href="/privacy"');
  });

  it("applies a complete custom section order and ignores an incomplete one", () => {
    const def = TEMPLATES[7];
    const site = previewSiteData(def);
    const order = [...(def.layout.order ?? DEFAULT_ORDER)];
    // Move contact right after the hero: every other section keeps its relative order.
    const custom = ["hero", "contact", ...order.filter((k) => k !== "hero" && k !== "contact")] as typeof order;
    site.content.sections.order = custom;
    const html = renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale: "ar", visitorCode: null, preview: true })} />);
    expect(html.indexOf('id="contact"')).toBeLessThan(html.indexOf('id="about"'));
    site.content.sections.order = ["contact", "hero"];
    const fallback = renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale: "ar", visitorCode: null, preview: true })} />);
    expect(fallback.indexOf('id="about"')).toBeLessThan(fallback.indexOf('id="contact"'));
  });

  it("exposes the accent text token and tone overrides for legible eyebrows", () => {
    const def = TEMPLATES[0];
    const site = previewSiteData(def);
    const html = renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale: "ar", visitorCode: null, preview: true })} />);
    expect(html).toContain("--t-accent-text:");
    expect(html).toContain("--t-accent-on-dark:");
    expect(html).toContain("tone-dark");
  });
});
