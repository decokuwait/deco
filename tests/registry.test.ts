import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate, templatesFor, isTemplateCode, neighbours } from "@/templates/registry";
import { DEFAULT_ORDER, type HeroVariant, type NavVariant, type ServicesVariant } from "@/templates/types";
import { FONTS } from "@/templates/fonts";
import { PATTERN_KEYS } from "@/templates/decor/patterns";
import { CATEGORIES } from "@/lib/types";
import { readableOn, contrastRatio } from "@/templates/ctx";
import { NAV as NAV_MAP } from "@/templates/sections/nav";
import { HERO as HERO_MAP } from "@/templates/sections/hero";
import { SERVICES as SERVICES_MAP } from "@/templates/sections/services";
import { ABOUT } from "@/templates/sections/about";
import { STATS } from "@/templates/sections/stats";
import { PROCESS } from "@/templates/sections/process";
import { FINISHED, BEFORE_AFTER, PROGRESS } from "@/templates/sections/projects";
import { TESTIMONIALS } from "@/templates/sections/testimonials";
import { FAQ } from "@/templates/sections/faq";
import { CTA } from "@/templates/sections/cta";
import { CONTACT } from "@/templates/sections/contact";
import { FOOTER } from "@/templates/sections/footer";

const HEROES: HeroVariant[] = ["split", "fullscreen", "centered", "diagonal", "cards", "video", "editorial", "gallery", "arch", "stacked"];
const NAVS: NavVariant[] = ["classic", "centered", "split", "minimal", "pill", "transparent", "boxed"];
const SERVICES: ServicesVariant[] = ["grid", "list", "bento", "zigzag", "iconrow", "tabs", "carousel"];
const OFFSET = { gypsum: 0, aluminum: 3, partition: 6, ceramic: 9 } as const;
const PREFIX = { gypsum: "1", aluminum: "2", partition: "3", ceramic: "4" } as const;
const HEX = /^#[0-9a-f]{6}$/;

function luminance(hex: string) {
  const c = hex.slice(1).match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("template registry", () => {
  it("has exactly 60 templates, 15 per category, with sequential 3-digit codes", () => {
    expect(TEMPLATES.length).toBe(60);
    for (const cat of CATEGORIES) {
      const list = templatesFor(cat);
      expect(list.length).toBe(15);
      list.forEach((t, i) => {
        expect(t.code).toBe(`${PREFIX[cat]}${String(i + 1).padStart(2, "0")}`);
        expect(t.category).toBe(cat);
      });
    }
    expect(new Set(TEMPLATES.map((t) => t.code)).size).toBe(60);
  });

  it("follows the hero/nav/services rotation so every template composition is unique", () => {
    const triples = new Set<string>();
    for (const cat of CATEGORIES) {
      templatesFor(cat).forEach((t, i) => {
        const o = OFFSET[cat];
        expect(t.layout.hero).toBe(HEROES[(i + o) % 10]);
        expect(t.layout.nav).toBe(NAVS[(2 * i + o) % 7]);
        expect(t.layout.services).toBe(SERVICES[(3 * i + o) % 7]);
        triples.add(`${t.layout.hero}|${t.layout.nav}|${t.layout.services}`);
      });
    }
    expect(triples.size).toBe(60);
  });

  it("uses unique primary colours and full layouts across all 60", () => {
    expect(new Set(TEMPLATES.map((t) => t.tokens.primary.toLowerCase())).size).toBe(60);
    expect(new Set(TEMPLATES.map((t) => JSON.stringify({ ...t.layout, order: undefined }))).size).toBe(60);
    // Every template is browsable by name in the gallery and the super admin picker: names never repeat.
    expect(new Set(TEMPLATES.map((t) => t.name.ar)).size).toBe(60);
    expect(new Set(TEMPLATES.map((t) => t.name.en.toLowerCase())).size).toBe(60);
    expect(new Set(TEMPLATES.map((t) => t.description.ar)).size).toBe(60);
    expect(new Set(TEMPLATES.map((t) => t.description.en)).size).toBe(60);
  });

  it("uses every section variant at least once and every nav/footer variant inside each category", () => {
    const slots = {
      nav: NAV_MAP,
      hero: HERO_MAP,
      services: SERVICES_MAP,
      about: ABOUT,
      stats: STATS,
      process: PROCESS,
      finished: FINISHED,
      beforeAfter: BEFORE_AFTER,
      progress: PROGRESS,
      testimonials: TESTIMONIALS,
      faq: FAQ,
      cta: CTA,
      contact: CONTACT,
      footer: FOOTER,
    } as const;
    for (const [slot, registry] of Object.entries(slots)) {
      const used = new Set(TEMPLATES.map((t) => t.layout[slot as keyof typeof slots] as string));
      for (const variant of Object.keys(registry)) expect(used.has(variant), `${slot}:${variant} is never used`).toBe(true);
      for (const variant of used) expect(variant in registry, `${slot}:${variant} has no component`).toBe(true);
    }
    for (const cat of CATEGORIES) {
      const list = templatesFor(cat);
      expect(new Set(list.map((t) => t.layout.nav)).size, `${cat} navs`).toBe(Object.keys(NAV_MAP).length);
      expect(new Set(list.map((t) => t.layout.footer)).size, `${cat} footers`).toBe(Object.keys(FOOTER).length);
      expect(list.filter((t) => t.layout.order).length, `${cat} custom orders`).toBeGreaterThanOrEqual(5);
    }
  });

  it("derives a legible accent for text on every background (eyebrows, numerals, captions)", () => {
    for (const t of TEMPLATES) {
      const k = t.tokens;
      expect(contrastRatio(readableOn(k.accent, k.bg), k.bg), `${t.code} accent text on bg`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(readableOn(k.accent, k.surface), k.surface), `${t.code} accent text on surface`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(readableOn(k.accent, k.secondary), k.secondary), `${t.code} accent text on dark band`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(readableOn(k.accent, k.primary), k.primary), `${t.code} accent text on primary`).toBeGreaterThanOrEqual(2.5);
    }
    // Already-legible colours are returned untouched; illegible ones keep their hue.
    expect(readableOn("#b45309", "#ffffff")).toBe("#b45309");
    expect(readableOn("#ffffff", "#000000")).toBe("#ffffff");
    const fixed = readableOn("#f5d76e", "#ffffff");
    expect(fixed).not.toBe("#f5d76e");
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(3);
  });

  it("has valid tokens, fonts, patterns, and readable contrast", () => {
    for (const t of TEMPLATES) {
      const k = t.tokens;
      for (const c of [k.primary, k.primaryFg, k.secondary, k.secondaryFg, k.accent, k.accentFg, k.bg, k.surface, k.surface2, k.text, k.muted, k.border]) {
        expect(c, `${t.code} colour ${c}`).toMatch(HEX);
      }
      expect(k.headingFont in FONTS, `${t.code} headingFont`).toBe(true);
      expect(k.bodyFont in FONTS, `${t.code} bodyFont`).toBe(true);
      expect(PATTERN_KEYS.includes(k.pattern), `${t.code} pattern`).toBe(true);
      expect(contrast(k.primary, k.primaryFg), `${t.code} primary contrast`).toBeGreaterThanOrEqual(3);
      expect(contrast(k.secondary, k.secondaryFg), `${t.code} secondary contrast`).toBeGreaterThanOrEqual(3);
      expect(contrast(k.accent, k.accentFg), `${t.code} accent contrast`).toBeGreaterThanOrEqual(3);
      expect(contrast(k.bg, k.text), `${t.code} text on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(k.surface, k.text), `${t.code} text on surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(k.surface2, k.text), `${t.code} text on surface2`).toBeGreaterThanOrEqual(4);
      expect(contrast(k.bg, k.muted), `${t.code} muted on bg`).toBeGreaterThanOrEqual(3);
      if (k.mode === "dark") expect(luminance(k.bg)).toBeLessThan(0.2);
      else expect(luminance(k.bg)).toBeGreaterThan(0.5);
      expect(t.name.ar.trim()).not.toBe("");
      expect(t.name.en.trim()).not.toBe("");
      expect(t.description.ar.trim()).not.toBe("");
      expect(t.description.en.trim()).not.toBe("");
      if (t.layout.order) {
        expect([...t.layout.order].sort()).toEqual([...DEFAULT_ORDER].sort());
        expect(t.layout.order[0]).toBe("hero");
        expect(t.layout.order[t.layout.order.length - 1]).toBe("contact");
      }
    }
  });

  it("has variety per category (dark modes, fonts, radii)", () => {
    for (const cat of CATEGORIES) {
      const list = templatesFor(cat);
      expect(list.filter((t) => t.tokens.mode === "dark").length).toBeGreaterThanOrEqual(3);
      expect(new Set(list.map((t) => t.tokens.headingFont)).size).toBeGreaterThanOrEqual(7);
      expect(new Set(list.map((t) => t.tokens.radius)).size).toBeGreaterThanOrEqual(5);
      expect(new Set(list.map((t) => t.tokens.pattern)).size).toBeGreaterThanOrEqual(6);
      expect(new Set(list.map((t) => t.tokens.buttonStyle)).size).toBeGreaterThanOrEqual(4);
    }
  });

  it("lookup helpers work", () => {
    expect(getTemplate("101")?.category).toBe("gypsum");
    expect(getTemplate("999")).toBeNull();
    expect(isTemplateCode("415")).toBe(true);
    expect(isTemplateCode("416")).toBe(false);
    const n = neighbours("101");
    expect(n.prev?.code).toBe("415");
    expect(n.next?.code).toBe("102");
  });
});
