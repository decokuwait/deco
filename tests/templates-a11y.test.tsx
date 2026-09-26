import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES, getTemplate } from "@/templates/registry";
import { buildCtx, contrastRatio, effectiveTokens } from "@/templates/ctx";
import { TemplateRenderer } from "@/templates/render/TemplateRenderer";
import { previewSiteData } from "@/lib/preview";
import { SIZES, responsiveSrc } from "@/templates/ui/img";
import { AR_LEADING, AR_LEADING_TALL } from "@/templates/leading";
import { arabicHeadingLeading } from "@/templates/fonts";
import { t } from "@/lib/i18n/site";
import type { Locale } from "@/lib/types";
import type { TemplateDef } from "@/templates/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

function render(def: TemplateDef, locale: Locale, mutate?: (site: ReturnType<typeof previewSiteData>) => void) {
  const site = previewSiteData(def);
  mutate?.(site);
  return renderToStaticMarkup(<TemplateRenderer ctx={buildCtx({ site, def, locale, visitorCode: "654321", preview: true })} />);
}

/** Class attributes carry the `:lang(ar)` variant escaped by JSX; match on the escaped form. */
const arLeadingIn = (html: string) => (html.match(/\[&amp;:lang\(ar\)\]:leading-\[[\d.]+\]/g) ?? []).length;

describe("arabic headings are not set at a latin display leading", () => {
  it.each(TEMPLATES.map((t) => [t.code, t] as const))("%s floors its <h1>", (_code, def) => {
    const html = render(def, "ar");
    const h1 = html.match(/<h1[^>]*class="([^"]*)"/);
    expect(h1, `${def.code} has no <h1>`).toBeTruthy();
    // Descenders (ج ح خ ع غ م ه ي ق) collide below about 1.35, and the hero headline is the largest
    // element on the page. Every h1 carries the floor next to its tight latin value.
    const floor = h1![1].match(/\[&amp;:lang\(ar\)\]:leading-\[([\d.]+)\]/);
    expect(floor, `${def.code} <h1> class "${h1![1]}" has no arabic line-height floor`).toBeTruthy();
    expect(Number(floor![1])).toBeGreaterThanOrEqual(1.35);
  });

  it("gives the naskh and ruqaa faces more room than the sans faces", () => {
    expect(arabicHeadingLeading("cairo")).toBe(AR_LEADING);
    expect(arabicHeadingLeading("amiri")).toBe(AR_LEADING_TALL);
    expect(arabicHeadingLeading("arefRuqaa")).toBe(AR_LEADING_TALL);
    // 107 is the editorial hero (the `leading-[1.02]` one) set in Amiri: the worst case in the catalogue.
    const html = render(getTemplate("107")!, "ar");
    expect(html).toContain("leading-[1.02]");
    expect(html).toContain(AR_LEADING_TALL.replace("&", "&amp;"));
  });

  it("floors section headings and the brand name too, not only the hero", () => {
    // SectionHeading, the nav Brand and the card headings all shipped `leading-tight` (1.25).
    expect(arLeadingIn(render(getTemplate("101")!, "ar"))).toBeGreaterThan(3);
  });

  it("leaves the latin value alone, so english display type stays tight", () => {
    const html = render(getTemplate("107")!, "en");
    expect(html).toContain("leading-[1.02]");
    // The floor rides along in the class list; it simply never matches on an `en` page.
    expect(html).toContain("lang=\"en\"");
  });
});

describe("content images are never declared decorative", () => {
  it.each(TEMPLATES.map((t) => [t.code, t] as const))("%s ships no empty alt", (_code, def) => {
    for (const locale of ["ar", "en"] as const) {
      const html = render(def, locale);
      // alt="" tells a screen reader the picture carries nothing; on a portfolio the pictures are the
      // page. Every <img> here is content — the decorative shapes are <svg aria-hidden> or divs.
      expect(html, `${def.code}/${locale} has an empty alt`).not.toContain('alt=""');
      expect(html, `${def.code}/${locale} has an <img> with no alt at all`).not.toMatch(/<img(?![^>]*\balt=)[^>]*>/);
    }
  });

  it("falls back to the project title and location when nothing is authored", () => {
    const def = getTemplate("101")!;
    const html = render(def, "ar", (site) => {
      for (const p of site.projects) {
        for (const m of p.media) {
          m.alt = null;
          m.caption = null;
        }
      }
    });
    const pr = previewSiteData(def).projects.find((p) => p.type === "before_after")!;
    expect(html).toContain(`${pr.title.ar} — ${pr.location!.ar}`);
  });

  it("prefers the authored alt over the generated one", () => {
    const html = render(getTemplate("101")!, "ar", (site) => {
      const p = site.projects.find((x) => x.type === "progress")!;
      for (const m of p.media) m.alt = { ar: "سقف جبس مع إضاءة مخفية", en: "Gypsum ceiling with cove lighting" };
    });
    expect(html).toContain("سقف جبس مع إضاءة مخفية");
  });
});

describe("the before/after comparison reads in the reader's direction", () => {
  const def = getTemplate("409")!; // beforeAfter: slider

  it("does not pin the frame to ltr any more", () => {
    const ar = render(def, "ar");
    const slider = ar.match(/<div[^>]*aspect-ratio:4\/3[^>]*>/) ?? ar.match(/<div[^>]*touch-action[^>]*>/);
    expect(slider, "slider frame not found").toBeTruthy();
    expect(slider![0]).toContain('dir="rtl"');
    expect(slider![0]).not.toContain('dir="ltr"');
    expect(render(def, "en")).toContain('dir="ltr"');
  });

  it("clips the before layer and places the labels from the inline start", () => {
    const ar = render(def, "ar");
    // "قبل" sits at the inline start (the right in Arabic) so the eye meets it first, and the divider is
    // offset with a logical property rather than a hard `left`.
    expect(ar).toMatch(/class="absolute top-3 start-3[^"]*"[^>]*>قبل/);
    expect(ar).toMatch(/class="absolute top-3 end-3[^"]*"[^>]*>بعد/);
    expect(ar).toContain("inset-inline-start");
    expect(ar).not.toMatch(/style="left:calc\(50% - 1px\)/);
  });

  it("keeps the vertical scroll escape hatch on touch", () => {
    // `none` used to swallow a scroll that began on the image; do not regress it.
    expect(render(def, "ar")).toContain("touch-action:pan-y");
  });
});

describe("an owner-set text colour cannot escape the contrast engine", () => {
  const def = TEMPLATES[0];

  it("floors white-on-white body text", () => {
    const site = previewSiteData(def);
    site.content.theme = { bg: "#ffffff", text: "#ffffff" };
    const tokens = effectiveTokens(def, site);
    expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("floors the text against the card and band surfaces as well as the page", () => {
    const site = previewSiteData(def);
    // A grey that just passes on the page background and fails on the surfaces every card sits on.
    site.content.theme = { text: "#949494", bg: "#ffffff" };
    const tokens = effectiveTokens(def, site);
    for (const bg of [tokens.bg, tokens.surface, tokens.surface2]) {
      expect(contrastRatio(tokens.text, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("leaves a legible choice exactly as the owner picked it", () => {
    const site = previewSiteData(def);
    site.content.theme = { text: "#1f1a12", bg: "#ffffff" };
    expect(effectiveTokens(def, site).text).toBe("#1f1a12");
  });
});

describe("responsive candidates", () => {
  it("still resizes the unsplash demo pictures", () => {
    const r = responsiveSrc("https://images.unsplash.com/photo-1?auto=format&w=1400");
    expect(r.srcSet).toContain("w=480 480w");
    expect(r.sizes).toBe(SIZES.half);
  });

  it("offers the upload derivatives when the stored url says they exist", () => {
    const r = responsiveSrc("https://cdn.example.com/sites/s1/2026/09/uuid-room@2000w.jpg", SIZES.third);
    expect(r.srcSet).toBe(
      [
        "https://cdn.example.com/sites/s1/2026/09/uuid-room@480w.jpg 480w",
        "https://cdn.example.com/sites/s1/2026/09/uuid-room@1080w.jpg 1080w",
        "https://cdn.example.com/sites/s1/2026/09/uuid-room@2000w.jpg 2000w",
      ].join(", "),
    );
    expect(r.sizes).toBe(SIZES.third);
  });

  it("never offers a candidate wider than the widest derivative", () => {
    const r = responsiveSrc("https://cdn.example.com/a/b@1080w.webp");
    expect(r.srcSet).toBe("https://cdn.example.com/a/b@480w.webp 480w, https://cdn.example.com/a/b@1080w.webp 1080w");
  });

  it("says nothing at all for a url with no derivatives, rather than a srcset of 404s", () => {
    expect(responsiveSrc("https://cdn.example.com/sites/s1/2026/09/uuid-room.jpg")).toEqual({});
    expect(responsiveSrc("/api/files/sites/s1/2026/09/uuid-room.jpg")).toEqual({});
    expect(responsiveSrc(null)).toEqual({});
  });
});

describe("the rest of the render-side fixes", () => {
  it("never renders an empty <h1>, whatever the owner left blank", () => {
    const def = getTemplate("107")!;
    const html = render(def, "ar", (site) => {
      site.content.hero.title = { ar: "", en: "" };
    });
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    expect(h1![1].replace(/<[^>]*>/g, "").trim()).not.toBe("");
    expect(html).toContain(previewSiteData(def).content.brand.name.ar);
  });

  it("localises the step dates instead of printing the stored ISO string", () => {
    const html = render(getTemplate("106")!, "ar");
    expect(html).not.toMatch(/>\s*20\d\d-\d\d-\d\d\s*</);
  });

  it("offers a skip link ahead of the nav, localised, on every page", () => {
    expect(render(TEMPLATES[0], "ar")).toContain(t("ar", "skip_to_content"));
    const en = render(TEMPLATES[0], "en");
    expect(en).toContain(t("en", "skip_to_content"));
    expect(en.indexOf("skip-to") < en.indexOf("<header")).toBe(true);
    expect(en).toContain('id="main"');
  });

  it("hides the footer services column when there are no services", () => {
    const def = getTemplate("101")!; // footer: columns
    const html = render(def, "ar", (site) => {
      site.content.services.items = [];
    });
    // The nav label is reused as the column heading; with no list under it the column is just a label.
    expect(html.match(/خدماتنا/g) ?? []).toHaveLength(0);
  });

  it("does not print the same stats band twice on the fullscreen hero", () => {
    const def = getTemplate("102")!; // hero: fullscreen
    const site = previewSiteData(def);
    const value = site.content.stats[0].value;
    const html = render(def, "ar");
    expect(html.split(`>${value}<`).length - 1, "stat value rendered more than once").toBe(1);
  });

  it("gives every content image an intrinsic ratio so a missing wrapper cannot shift the page", () => {
    for (const def of [getTemplate("101")!, getTemplate("106")!, getTemplate("409")!]) {
      const imgs = (render(def, "ar").match(/<img[^>]*>/g) ?? []).filter((i) => !/object-contain/.test(i));
      expect(imgs.length).toBeGreaterThan(4);
      // A logo opts out with `ratio={null}` — its own proportions decide its width. Everything else
      // reserves its box before the file arrives, whether or not its section wrapped it in an aspect box.
      // `h-full` is the second, equally valid way to have no shift: `Img` emits it for `fill`, which means
      // an ancestor has already given this picture a definite height (a bento row, an `absolute inset-0`
      // backdrop, a section-sized hero), so there is nothing left to reserve.
      for (const img of imgs) expect(img, "image with neither an intrinsic size nor a box from its ancestor").toMatch(/\bwidth="\d+" height="\d+"|\bh-full\b/);
    }
  });

  it("never lets a definite height silently kill the slot's own aspect ratio", () => {
    // The one way to apply the ratio contract and get nothing for it: name a slot and leave `h-full` on the
    // image (or keep the old `aspect-[…]` wrapper and fill it). A box with a definite height ignores
    // `aspect-ratio` entirely, so the slot would be dead code and the hand-written shape would still ship.
    for (const def of TEMPLATES) {
      for (const img of render(def, "ar").match(/<img[^>]*>/g) ?? []) {
        if (!/\baspect-\[/.test(img)) continue;
        expect(img, `${def.code}: an image carries both a slot ratio and h-full`).not.toMatch(/\bh-full\b/);
      }
    }
  });

  it("leaves no focusable control without an indicator", () => {
    const html = render(getTemplate("105")!, "ar"); // services: tabs
    // The tab panel is a tab stop; it used to carry `outline-none` and nothing in its place.
    const panel = html.match(/<div[^>]*role="tabpanel"[^>]*>/);
    expect(panel).toBeTruthy();
    expect(panel![0]).not.toContain("outline-none");
    expect(panel![0]).toContain("focus-visible:outline-2");
    // Every button built from the shared classes carries the same token.
    expect(html).toContain("focus-visible:outline-accent-text");
  });
});
