import { beforeAll, afterAll, describe, expect, it } from "vitest";

// Same preamble as db.test.ts: PGlite in memory unless a real Postgres is configured.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";
process.env.SUPER_ADMIN_EMAILS = "owner@example.com";

import { getDb, resetDb } from "@/lib/db/client";
import { listProjects } from "@/lib/db/projects";
import { provisionSite, starterContent } from "@/lib/provision";
import { starterCopy, clampDescription } from "@/lib/demo/starter";
import { demoContent, demoProjects } from "@/lib/demo/content";
import { CATEGORIES, type Category, type SiteContent } from "@/lib/types";

beforeAll(async () => {
  await getDb();
});
afterAll(async () => {
  await resetDb();
});

/** Eight plausible Kuwaiti trade names, reused for every category. */
const NAMES = ["Elite Decor", "Al Salam Works", "Bayt Al Fann", "Gulf Craft", "Sadu Interiors", "Al Waha", "Meshref Group", "Dar Al Handasa"];
const site = (i: number, category: Category): { name: string; slug: string; category: Category } => ({
  name: NAMES[i],
  slug: `${category}-${NAMES[i].toLowerCase().replace(/\s+/g, "-")}`,
  category,
});

function starter(i: number, category: Category): SiteContent {
  const s = site(i, category);
  return starterContent({ category, name: s.name, slug: s.slug, whatsapp: "96550001111" });
}

describe("starter copy is unique per tenant", () => {
  // The whole point of the rewrite: ten contractors in one trade used to ship one headline, one
  // tagline and one meta description between them — Google's "scaled content abuse" shape.
  it.each(CATEGORIES)("%s: no two sites share a headline, tagline, description or CTA", (category) => {
    const contents = NAMES.map((_, i) => starter(i, category));
    const distinct = (pick: (c: SiteContent) => string) => new Set(contents.map(pick)).size;
    expect(distinct((c) => c.hero.title.ar)).toBe(NAMES.length);
    expect(distinct((c) => c.hero.title.en)).toBe(NAMES.length);
    expect(distinct((c) => c.seo.description.ar)).toBe(NAMES.length);
    expect(distinct((c) => c.seo.description.en)).toBe(NAMES.length);
    expect(distinct((c) => c.brand.tagline.ar)).toBeGreaterThan(1);
    expect(distinct((c) => c.cta.title.ar)).toBeGreaterThan(1);
    expect(distinct((c) => c.hero.subtitle.ar)).toBeGreaterThan(1);
  });

  it("two sites in one category differ across every shared string, not just the name", () => {
    const a = starter(0, "gypsum");
    const b = starter(1, "gypsum");
    for (const pick of [
      (c: SiteContent) => c.hero.title.ar,
      (c: SiteContent) => c.hero.title.en,
      (c: SiteContent) => c.brand.tagline.ar,
      (c: SiteContent) => c.seo.description.ar,
      (c: SiteContent) => c.cta.title.ar,
    ]) {
      expect(pick(a)).not.toBe(pick(b));
    }
  });

  it("is stable: the same site regenerates the same words", () => {
    expect(starterCopy("ceramic", "Bayt Al Fann", "bayt-al-fann")).toEqual(starterCopy("ceramic", "Bayt Al Fann", "bayt-al-fann"));
    // ...and the slug, not just the name, is what varies it.
    expect(starterCopy("ceramic", "Bayt Al Fann", "bayt-al-fann-2").heroTitle.ar).not.toBe("");
  });

  it("weaves the business name into the strings that duplication costs us", () => {
    const c = starter(2, "aluminum");
    expect(c.hero.title.ar).toContain("Bayt Al Fann");
    expect(c.seo.description.ar).toContain("Bayt Al Fann");
    expect(c.seo.title.ar).toBe("Bayt Al Fann");
  });

  it("never renders an empty h1 and keeps the description inside Google's snippet", () => {
    for (const category of CATEGORIES) {
      for (let i = 0; i < NAMES.length; i++) {
        const c = starter(i, category);
        expect(c.hero.title.ar.trim()).not.toBe("");
        expect(c.hero.title.en.trim()).not.toBe("");
        expect(c.seo.description.ar.length).toBeLessThanOrEqual(160);
        expect(c.seo.description.en.length).toBeLessThanOrEqual(160);
      }
    }
    // Even a blank name cannot produce an empty heading.
    expect(starterContent({ category: "gypsum", name: "", slug: "nameless" }).hero.title.ar.trim()).not.toBe("");
  });

  it("clampDescription cuts on a word boundary", () => {
    expect(clampDescription("short", 20)).toBe("short");
    const out = clampDescription("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
  });
});

describe("starter content invents nothing", () => {
  it.each(CATEGORIES)("%s: no testimonials, stats, services or placeholder contact details", (category) => {
    const c = starter(0, category);
    expect(c.testimonials.items).toEqual([]);
    // An empty "what clients say" is worse than no section: it stays off until there are real ones.
    expect(c.sections.testimonials).toBe(false);
    expect(c.stats).toEqual([]);
    expect(c.services.items).toEqual([]);
    expect(c.faq.items).toEqual([]);
    expect(c.about.body.ar).toBe("");
    expect(c.contact.email).toBe("");
    expect(c.contact.address.ar).toBe("");
    expect(c.hero.imageUrl ?? "").toBe("");
    expect(JSON.stringify(c)).not.toContain("example.com");
    expect(JSON.stringify(c)).not.toContain("96550000000");
    expect(c.settings.demo).toBe(false);
  });

  it("carries the operator's own contact details through", () => {
    const c = starterContent({ category: "partition", name: "Gulf Craft", slug: "gulf-craft", whatsapp: "96599887766", email: "sales@gulfcraft.com" });
    expect(c.contact.whatsapp).toBe("96599887766");
    expect(c.contact.phone).toBe("96599887766");
    expect(c.contact.email).toBe("sales@gulfcraft.com");
  });
});

describe("demo content", () => {
  it.each(CATEGORIES)("%s: is flagged as a demo and hotlinks nothing", (category) => {
    const c = demoContent(category);
    expect(c.settings.demo).toBe(true);
    expect(c.contact.email).toBe("");
    // The portfolio used to play Big Buck Bunny from a third-party test-asset host.
    const urls = demoProjects(category).flatMap((p) => [p.coverUrl ?? "", ...p.media.map((m) => m.url)]);
    for (const url of urls) expect(url).toMatch(/^https:\/\/images\.unsplash\.com\//);
    expect(JSON.stringify(c)).not.toContain("test-videos.co.uk");
  });

  it.each(CATEGORIES)("%s: every demo project has a usable, unique slug", (category) => {
    const slugs = demoProjects(category).map((p) => p.slug);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sizes the small variants down (the regex used to be `w=d+` and matched nothing)", () => {
    const c = demoContent("gypsum");
    expect(c.hero.images?.[0]).toContain("w=900");
    expect(c.services.items[0].imageUrl).toContain("w=800");
  });
});

describe("provisioning defaults", () => {
  it("creates a paused site with starter content and no seeded projects", async () => {
    const { site: created } = await provisionSite({ slug: "real-customer", name: "Real Customer", category: "gypsum", whatsapp: "96551112222", provisionVercel: false });
    // A brand-new site must not serve Google a half-written shell from its own domain.
    expect(created.status).toBe("paused");
    expect(created.content.settings.demo).toBe(false);
    expect(created.content.testimonials.items).toEqual([]);
    expect(created.content.hero.title.ar).toContain("Real Customer");
    expect(created.content.contact.whatsapp).toBe("96551112222");
    expect(await listProjects(created.id)).toEqual([]);
  });

  it("seeds the showcase only when the demo is explicitly asked for", async () => {
    const { site: created } = await provisionSite({ slug: "showcase", name: "Showcase", category: "ceramic", whatsapp: "96550000000", demo: true, status: "active", provisionVercel: false });
    expect(created.status).toBe("active");
    expect(created.content.settings.demo).toBe(true);
    expect(created.content.testimonials.items.length).toBeGreaterThan(0);
    const projects = await listProjects(created.id);
    expect(projects.length).toBeGreaterThan(8);
    for (const p of projects) expect(p.slug).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
  });

  it("cannot write a fabricated testimonial to a site that is not a demo", async () => {
    // The guard is on the write path, not on the caller: even content that arrived carrying
    // testimonials loses them unless the site says it is a showcase.
    const { site: created } = await provisionSite({ slug: "no-fakes", name: "No Fakes", category: "aluminum", demo: false, provisionVercel: false });
    expect(created.content.testimonials.items).toEqual([]);
    expect(created.content.stats).toEqual([]);
    expect(JSON.stringify(created.content)).not.toContain("example.com");
  });
});
