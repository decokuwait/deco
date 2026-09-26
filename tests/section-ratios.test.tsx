import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { RATIO } from "@/templates/ui/ratios";
import type { Locale } from "@/lib/types";
import type { TemplateDef } from "@/templates/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

function render(def: TemplateDef, locale: Locale = "ar", mutate?: (site: ReturnType<typeof previewSiteData>) => void) {
  const site = previewSiteData(def);
  mutate?.(site);
  return renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale, visitorCode: "654321", preview: true })} />);
}

/** The markup of one section, from its id to the start of the next `<section>`. */
function sectionHtml(html: string, id: string): string {
  const at = html.indexOf(`id="${id}"`);
  if (at === -1) return "";
  const next = html.indexOf("<section", at + 1);
  return html.slice(at, next === -1 ? undefined : next);
}

const aspectsIn = (html: string) => [...html.matchAll(/aspect-\[[^\]"\s]+\]/g)].map((m) => m[0]);
const boxesIn = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map(([t]) => `${/\bwidth="(\d+)"/.exec(t)?.[1] ?? "-"}x${/\bheight="(\d+)"/.exec(t)?.[1] ?? "-"}`);

const first = (pick: (t: TemplateDef) => boolean) => TEMPLATES.find(pick)!;

describe("a before/after pair is one shape", () => {
  // The slider wipes one photograph across the other inside a single frame, and the tabs and the hover
  // reveal swap them in place. Two different shapes turn the comparison into a jump at the handle, which
  // is why `RATIO.compare` is the one slot whose value is a correctness question and not a taste one.
  const withCompare = TEMPLATES.filter((t) => sectionHtml(render(t), "before-after").length > 0);

  it("covers all four before/after variants", () => {
    expect(new Set(withCompare.map((t) => t.layout.beforeAfter)).size).toBe(4);
  });

  it.each(withCompare.map((t) => [`${t.code} (${t.layout.beforeAfter})`, t] as const))("%s crops both halves to RATIO.compare", (_label, def) => {
    for (const locale of ["ar", "en"] as const) {
      const section = sectionHtml(render(def, locale), "before-after");
      const allowed = new Set(RATIO.compare.split(/\s+/).map((c) => c.replace(/^[^:]*:/, "")));
      const found = new Set(aspectsIn(section));
      expect([...found].filter((a) => !allowed.has(a)), `${def.code} comparison uses a shape outside the contract`).toEqual([]);
      expect(found.has("aspect-[4/3]"), `${def.code} comparison reserves no phone ratio`).toBe(true);
      // Where the halves are real <img> elements, the reserved box must match too, not only the CSS.
      const boxes = new Set(boxesIn(section).filter((b) => b !== "-x-"));
      expect(boxes.size, `${def.code} comparison reserves ${[...boxes].join(" and ")}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("a grid reserves one box for every card in the row", () => {
  it.each(["grid", "masonry", "carousel", "bento", "filmstrip"].map((v) => [v, first((t) => t.layout.finished === v)] as const))(
    "finished: %s",
    (variant, def) => {
      const section = sectionHtml(render(def), "projects");
      const boxes = boxesIn(section).filter((b) => b !== "-x-");
      // Masonry is the deliberate exception: its columns alternate a tall cell and a wide one. Even there
      // the shapes come from the contract, so there are two and not six.
      expect(new Set(boxes).size, `${def.code} (${variant}) reserves ${[...new Set(boxes)].join(", ")}`).toBeLessThanOrEqual(variant === "masonry" ? 2 : 1);
    },
  );
});

describe("the owner's focal point reaches the markup", () => {
  it("a project cover cropped to the top keeps its ceiling", () => {
    const def = first((t) => t.layout.finished === "grid");
    const html = render(def, "ar", (site) => {
      for (const p of site.projects.filter((p) => p.type === "finished")) {
        p.coverUrl = null;
        for (const m of p.media) m.focal = "top";
      }
    });
    expect(sectionHtml(html, "projects")).toContain("object-top");
  });

  it("defaults to the centre when the owner has not chosen", () => {
    const def = first((t) => t.layout.finished === "grid");
    const html = render(def, "ar", (site) => {
      for (const p of site.projects) for (const m of p.media) m.focal = null;
    });
    const section = sectionHtml(html, "projects");
    expect(section).toContain("object-center");
    expect(section).not.toContain("object-top");
  });

  it("gives a before/after pair ONE focal point, not one each", () => {
    // Two different `object-position` values slide the room sideways as the handle travels; the "after"
    // shot is the one being sold, so its framing wins for both halves.
    for (const variant of ["slider", "hover", "sidebyside", "tabs"] as const) {
      const def = first((t) => t.layout.beforeAfter === variant);
      const html = render(def, "ar", (site) => {
        for (const p of site.projects.filter((p) => p.type === "before_after")) {
          for (const m of p.media) m.focal = m.role === "after" ? "bottom" : "top";
        }
      });
      const section = sectionHtml(html, "before-after");
      expect(section, `${def.code} (${variant})`).toContain("object-bottom");
      expect(section, `${def.code} (${variant}) crops its two halves differently`).not.toContain("object-top");
    }
  });

  it("carries the focal point through the progress widgets, which drop it into a client payload", () => {
    for (const variant of ["slideshow", "filmstrip", "stepper", "timeline"] as const) {
      const def = first((t) => t.layout.progress === variant);
      const html = render(def, "ar", (site) => {
        for (const p of site.projects.filter((p) => p.type === "progress")) for (const m of p.media) m.focal = "bottom";
      });
      expect(sectionHtml(html, "progress"), `${def.code} (progress: ${variant})`).toContain("object-bottom");
    }
  });
});

describe("a tenant with no photographs yet", () => {
  // The state every site is in on day one. A slot that reserved nothing left the grid collapsed to a row
  // of captions; a slot that reserved a box but drew nothing in it left the browser's broken-image glyph.
  const bare = (site: ReturnType<typeof previewSiteData>) => {
    for (const p of site.projects) {
      p.coverUrl = null;
      p.media = [];
    }
    site.content.about.imageUrl = "";
    site.content.hero.imageUrl = "";
    site.content.hero.images = [];
    for (const s of site.content.services.items) s.imageUrl = "";
  };

  it.each(TEMPLATES.map((t) => [t.code, t] as const))("%s reserves a real box for every picture it has not got yet", (_code, def) => {
    const html = render(def, "ar", bare);
    // Every empty slot reserves a shape and paints the tonal placeholder. A placeholder with neither is a
    // zero-height box: the grid collapses to a row of captions until the owner uploads something.
    const empties = [...html.matchAll(/<div\b[^>]*class="[^"]*img-ph-empty[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(empties.length, `${def.code} renders no empty slots at all`).toBeGreaterThan(0);
    for (const div of empties) expect(div, `${def.code} has a placeholder with no reserved shape`).toMatch(/aspect-\[|h-full/);
    expect(html).toContain('id="contact"');
  });

  it("still hides a projects section that has no projects — the auto-hide survived the ratio work", () => {
    const def = first((t) => t.layout.finished === "grid");
    const html = render(def, "ar", (site) => {
      bare(site);
      site.projects = [];
    });
    expect(html).not.toContain('id="projects"');
    expect(html).not.toContain('id="before-after"');
    expect(html).not.toContain('id="progress"');
    expect(html).toContain('id="contact"');
  });
});

describe("no section invents its own shape", () => {
  // Every picture box in these directories declares its ratio through `src/templates/ui/ratios.ts`. A
  // hand-written `aspect-[…]` is how the engine got into the state this fixed: a portrait uploaded into a
  // 16:9 slot lost its subject, and no two sections agreed on what a card was.
  const DIRS = ["about", "contact", "cta", "faq", "footer", "process", "projects", "services", "stats", "testimonials", "shared"];
  const root = path.join(process.cwd(), "src", "templates", "sections");

  it.each(DIRS)("sections/%s writes no aspect-[…] of its own", (dir) => {
    const offenders: string[] = [];
    for (const f of fs.readdirSync(path.join(root, dir))) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = fs.readFileSync(path.join(root, dir, f), "utf8");
      src.split("\n").forEach((line, i) => {
        if (/aspect-\[/.test(line)) offenders.push(`${dir}/${f}:${i + 1}`);
      });
    }
    expect(offenders, `hand-written ratios: ${offenders.join(", ")}`).toEqual([]);
  });
});
