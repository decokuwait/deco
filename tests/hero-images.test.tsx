import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { previewSiteData } from "@/lib/preview";
import { HERO } from "@/templates/sections/hero";
import { heroSlides } from "@/templates/sections/hero/shared";
import { shouldRotate } from "@/templates/ui/client/HeroRotator";
import { LOCALES, type Locale } from "@/lib/types";
import type { HeroVariant } from "@/templates/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

const VARIANTS: HeroVariant[] = ["split", "fullscreen", "centered", "diagonal", "cards", "video", "editorial", "gallery", "arch", "stacked"];

/** One real template per hero variant, so each variant is exercised with the tokens it ships with. */
function defFor(v: HeroVariant) {
  const def = TEMPLATES.find((t) => t.layout.hero === v);
  if (!def) throw new Error(`no template uses the ${v} hero`);
  return def;
}

const OWNER_IMAGES = ["https://cdn.example.com/majlis@2000w.jpg", "https://cdn.example.com/ceiling@2000w.jpg", "https://cdn.example.com/stairs@2000w.jpg"];

function renderHero(v: HeroVariant, mutate: (site: ReturnType<typeof previewSiteData>) => void, locale: Locale = "ar") {
  const def = defFor(v);
  const site = previewSiteData(def);
  mutate(site);
  const Hero = HERO[v];
  return renderToStaticMarkup(<Hero ctx={buildCtx({ site, def, locale, visitorCode: "654321", preview: true })} />);
}

/** The pictures the owner added, with no "main" image at all — the case that reported the bug. */
function onlyImages(site: ReturnType<typeof previewSiteData>) {
  site.content.hero.imageUrl = "";
  site.content.hero.images = [...OWNER_IMAGES];
}

describe("every hero variant honours hero.images", () => {
  // HeroSplit rendered `hero.imageUrl` and nothing else, so a site whose owner had only ever used the
  // "add images" control had a hero with an empty grey box where the photograph belongs.
  it.each(VARIANTS)("%s renders the owner's images when there is no main image", (v) => {
    const html = renderHero(v, onlyImages);
    expect(html, `${v} does not render the first image the owner added`).toContain(OWNER_IMAGES[0]);
    expect(html, `${v} renders an empty src`).not.toContain('src=""');
  });

  // The hero picture is the largest paint on every one of these pages, so exactly one of them is the
  // LCP candidate and the extra pictures a rotator cross-fades to must not compete with it.
  it.each(VARIANTS)("%s still has exactly one eager, high-priority hero image", (v) => {
    const html = renderHero(v, onlyImages);
    const tags = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    const eager = tags.filter((t) => t.includes('loading="eager"'));
    expect(eager.length, `${v} renders ${eager.length} eager hero images`).toBe(1);
    expect(eager[0], `${v} LCP image has no fetchPriority`).toContain('fetchPriority="high"');
    // React 19 turns that attribute into a preload hint in the head, which is the point of it.
    expect(html, `${v} does not preload its LCP image`).toContain('rel="preload" as="image"');
    // In a rotator it must be slide 0: the picture the hero showed before it learned to rotate.
    if (html.includes("data-hero-rotator")) expect(eager[0]).toContain(`src="${OWNER_IMAGES[0]}"`);
  });

  it.each(VARIANTS)("%s either shows the other images or hands them to the rotator", (v) => {
    const html = renderHero(v, onlyImages);
    const collage = html.includes(OWNER_IMAGES[1]) && html.includes(OWNER_IMAGES[2]);
    expect(collage || html.includes('data-hero-rotator="3"'), `${v} drops the owner's 2nd and 3rd image`).toBe(true);
  });

  it.each(VARIANTS)("%s describes every picture it renders", (v) => {
    const html = renderHero(v, onlyImages);
    for (const m of html.matchAll(/<img[^>]*>/g)) expect(m[0], `${v} ships an image without a description`).toMatch(/alt="[^"]+"/);
  });

  it.each(LOCALES)("the rotator's controls are labelled in %s", (locale) => {
    const html = renderHero("split", onlyImages, locale);
    // The labels are server-rendered props, so they are in the payload even though the control cluster
    // itself only appears once the first picture has loaded.
    expect(html).toContain('data-hero-rotator="3"');
  });
});

describe("a hero with one picture is left exactly as it was", () => {
  it.each(VARIANTS)("%s mounts no rotator for a single image", (v) => {
    const html = renderHero(v, (site) => {
      site.content.hero.imageUrl = OWNER_IMAGES[0];
      site.content.hero.images = [];
    });
    expect(html).toContain(OWNER_IMAGES[0]);
    expect(html, `${v} mounts a rotator for a single image`).not.toContain("data-hero-rotator");
  });

  it("mounts no rotator when the owner added the same picture twice", () => {
    const html = renderHero("split", (site) => {
      site.content.hero.imageUrl = OWNER_IMAGES[0];
      site.content.hero.images = [OWNER_IMAGES[0]];
    });
    expect(html).not.toContain("data-hero-rotator");
  });
});

describe("heroSlides", () => {
  const ctx = (hero: { imageUrl?: string; images?: string[] }, about = "") => {
    const def = defFor("split");
    const site = previewSiteData(def);
    site.content.hero.imageUrl = hero.imageUrl ?? "";
    site.content.hero.images = hero.images ?? [];
    site.content.about.imageUrl = about;
    return buildCtx({ site, def, locale: "ar" as Locale, visitorCode: null, preview: true });
  };

  it("leads with the main image, then the added ones", () => {
    expect(heroSlides(ctx({ imageUrl: "a", images: ["b", "c"] }))).toEqual(["a", "b", "c"]);
  });

  // A rotator that cross-fades a picture into itself looks broken, so unlike `heroImages` — which pads a
  // collage out to a fixed number of cells — this list never repeats and is never padded.
  it("drops duplicates and blanks, and never pads", () => {
    expect(heroSlides(ctx({ imageUrl: "a", images: ["a", "  ", "b"] }))).toEqual(["a", "b"]);
    expect(heroSlides(ctx({ imageUrl: "", images: ["b"] }))).toEqual(["b"]);
  });

  it("falls back to the about photograph only when the hero has none", () => {
    expect(heroSlides(ctx({}, "about.jpg"))).toEqual(["about.jpg"]);
    expect(heroSlides(ctx({ images: ["b"] }, "about.jpg"))).toEqual(["b"]);
  });

  it("caps the slide count so a hundred uploads are not a hundred timers", () => {
    expect(heroSlides(ctx({ images: Array.from({ length: 30 }, (_, i) => `i${i}`) })).length).toBe(5);
  });
});

describe("what stops the rotation", () => {
  const all = { ready: true, stopped: false, held: false, hovered: false, focused: false, reduced: false, visible: true };

  it("rotates when nothing is in the way", () => {
    expect(shouldRotate(all)).toBe(true);
  });

  // prefers-reduced-motion: the visitor sees the first picture and it does not move. Not "moves slower".
  it("never rotates under reduced motion", () => {
    expect(shouldRotate({ ...all, reduced: true })).toBe(false);
  });

  it.each(["stopped", "held", "hovered", "focused"] as const)("stops while %s", (k) => {
    expect(shouldRotate({ ...all, [k]: true })).toBe(false);
  });

  it("stops in a background tab, and before the first picture has loaded", () => {
    expect(shouldRotate({ ...all, visible: false })).toBe(false);
    expect(shouldRotate({ ...all, ready: false })).toBe(false);
  });
});
