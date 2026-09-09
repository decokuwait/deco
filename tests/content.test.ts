import { describe, expect, it } from "vitest";
import { deepMerge, emptyContent, normalizeContent, whatsappLink, telLink } from "@/lib/content/defaults";
import { demoContent, demoProjects } from "@/lib/demo/content";
import { CATEGORIES } from "@/lib/types";

describe("content defaults", () => {
  it("deepMerge merges objects, replaces arrays and ignores undefined", () => {
    const base = { a: { b: 1, c: [1, 2] }, d: "x" };
    const out = deepMerge(base, { a: { c: [9] }, d: undefined, e: true });
    expect(out).toEqual({ a: { b: 1, c: [9] }, d: "x", e: true });
  });
  it("normalizeContent fills every field", () => {
    const c = normalizeContent({ brand: { name: { ar: "x", en: "y" } } });
    expect(c.brand.name.ar).toBe("x");
    expect(c.contact.whatsappMessage.ar).toContain("{id}");
    expect(c.sections.services).toBe(true);
    expect(c.settings.signalMode).toBe("smart");
    expect(c.projects.finished.enabled).toBe(true);
  });
  it("emptyContent is a fresh object each time", () => {
    const a = emptyContent();
    const b = emptyContent();
    a.brand.name.ar = "changed";
    expect(b.brand.name.ar).toBe("");
  });
  it("whatsappLink embeds the visitor id in the first message", () => {
    const url = whatsappLink("+965 5000 0000", "مرحباً، رقم الزائر: {id}", "123456");
    expect(url.startsWith("https://wa.me/96550000000?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("مرحباً، رقم الزائر: 123456");
  });
  it("whatsappLink handles missing code", () => {
    expect(decodeURIComponent(whatsappLink("965", "id {id}", null).split("text=")[1])).toBe("id ------");
  });
  it("telLink normalizes", () => {
    expect(telLink("965 5000 0000")).toBe("tel:+96550000000");
    expect(telLink("")).toBe("#");
  });
});

describe("demo content", () => {
  it.each(CATEGORIES)("%s demo content and projects are complete", (cat) => {
    const c = demoContent(cat);
    expect(c.brand.name.ar).not.toBe("");
    expect(c.brand.name.en).not.toBe("");
    expect(c.services.items.length).toBeGreaterThanOrEqual(6);
    expect(c.faq.items.length).toBeGreaterThanOrEqual(4);
    expect(c.testimonials.items.length).toBeGreaterThanOrEqual(3);
    expect(c.hero.imageUrl).toMatch(/^https:/);
    const p = demoProjects(cat);
    expect(p.filter((x) => x.type === "finished").length).toBeGreaterThanOrEqual(6);
    expect(p.filter((x) => x.type === "before_after").length).toBeGreaterThanOrEqual(3);
    expect(p.filter((x) => x.type === "progress").length).toBeGreaterThanOrEqual(2);
    for (const pr of p.filter((x) => x.type === "before_after")) {
      expect(pr.media.some((m) => m.role === "before")).toBe(true);
      expect(pr.media.some((m) => m.role === "after")).toBe(true);
    }
    for (const pr of p.filter((x) => x.type === "progress")) {
      expect(pr.media.every((m) => m.role === "step" && m.stepLabel)).toBe(true);
    }
    expect(p.some((x) => x.media.some((m) => m.kind === "video"))).toBe(true);
    const ids = p.flatMap((x) => x.media.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
