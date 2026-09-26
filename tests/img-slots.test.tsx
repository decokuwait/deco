import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Img, Media, intrinsic } from "@/templates/ui/primitives";
import { RATIO, RATIO_ATTR, type RatioSlot } from "@/templates/ui/ratios";
import type { MediaItem } from "@/lib/types";

/**
 * The ratio contract, at the primitive.
 *
 * The owner's report was that an uploaded photo did not fit the space it was put in. The cause was that a
 * picture's shape was three separate decisions at every call site — an `aspect-[…]` on the wrapper, a
 * `ratio="…"` string on the image, an `object-cover` somewhere in a className — and nothing made them
 * agree. These tests hold the resolved version: one slot name decides the box, the reserved size, the fit
 * and the crop point together, so a section cannot half-apply it.
 */

const SRC = "https://cdn.example.com/sites/s1/2026/09/room@2000w.jpg";
const item = (extra: Partial<MediaItem> = {}): MediaItem => ({ id: "m1", kind: "image", url: SRC, posterUrl: null, role: "gallery", order: 0, ...extra });
const attr = (html: string, name: string) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";

describe("a ratio slot decides the box, the reserved size and the fit together", () => {
  it("emits the slot's responsive aspect classes verbatim", () => {
    const cls = attr(renderToStaticMarkup(<Img src={SRC} alt="صورة مشروع" slot="card" />), "class");
    // Tailwind 4 only sees class literals, so the class string has to survive from `RATIO` to the markup
    // untouched — a value built up at runtime would compile to nothing and the box would have no height.
    for (const part of RATIO.card.split(" ")) expect(cls.split(" ")).toContain(part);
    expect(cls.split(" ")).toContain("w-full");
  });

  it("reserves the matching width/height so the box exists before the file arrives", () => {
    const html = renderToStaticMarkup(<Img src={SRC} alt="صورة مشروع" slot="card" />);
    const { width, height } = intrinsic(RATIO_ATTR.card!);
    expect(attr(html, "width")).toBe(String(width));
    expect(attr(html, "height")).toBe(String(height));
    // 3/2 on the widest breakpoint, which is where an over-tall reservation would be most visible.
    expect(Number(attr(html, "width")) / Number(attr(html, "height"))).toBeCloseTo(1.5, 2);
  });

  it("crops instead of stretching, on every slot", () => {
    // `object-fit` defaults to `fill`. A reserved ratio with no fit class is therefore a *stretched* photo,
    // which was reachable from the old `ratio = "4/3"` default any time a caller forgot `object-cover`.
    for (const slot of Object.keys(RATIO) as RatioSlot[]) {
      const cls = attr(renderToStaticMarkup(<Img src={SRC} alt="صورة" slot={slot} />), "class");
      expect(cls, `${slot} does not declare a fit`).toContain("object-cover");
      expect(cls, `${slot} letterboxes`).not.toContain("object-contain");
    }
  });

  it("gives every slot a reserved shape or a box from its ancestor, never neither", () => {
    for (const slot of Object.keys(RATIO) as RatioSlot[]) {
      const html = renderToStaticMarkup(<Img src={SRC} alt="صورة" slot={slot} />);
      const reserved = /\bwidth="\d+" height="\d+"/.test(html);
      const filled = /\bh-full\b/.test(attr(html, "class"));
      expect(reserved || filled, `${slot} neither reserves a ratio nor fills its ancestor`).toBe(true);
      // The two are mutually exclusive: a definite height makes the browser ignore `aspect-ratio`.
      if (filled) expect(attr(html, "class"), `${slot} fills and declares a ratio`).not.toContain("aspect-[");
    }
  });

  it("keeps RATIO and RATIO_ATTR in step", () => {
    for (const slot of Object.keys(RATIO) as RatioSlot[]) {
      expect(RATIO_ATTR, `${slot} has no numeric ratio`).toHaveProperty(slot);
      const a = RATIO_ATTR[slot];
      // `heroFull` is the one slot with no ratio at all: its height comes from the section.
      if (a === null) expect(RATIO[slot]).toBe("");
      else expect(intrinsic(a).width, `${slot}: "${a}" is not a parseable ratio`).toBe(1600);
    }
  });

  it("gives a narrow phone its own band on the slots that need one", () => {
    // 320–380px is where a tall box first pushes the WhatsApp button under the fold.
    for (const slot of ["heroPortrait", "heroWide", "card", "compare"] as RatioSlot[]) {
      expect(RATIO[slot], `${slot} has no narrow-phone band`).toContain("max-[380px]:aspect-[");
    }
  });
});

describe("the owner's focal point reaches object-position", () => {
  it("maps each authored position to its class", () => {
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="سقف" slot="card" focal="top" />), "class")).toContain("object-top");
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="أرضية" slot="card" focal="bottom" />), "class")).toContain("object-bottom");
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="صورة" slot="card" focal="center" />), "class")).toContain("object-center");
    // Absent means centre, which is what every photo had before the picker existed.
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="صورة" slot="card" />), "class")).toContain("object-center");
  });

  it("Media reads it off the item, so a section does not have to know the field exists", () => {
    expect(attr(renderToStaticMarkup(<Media item={item({ focal: "top" })} alt="سقف جبس" slot="card" />), "class")).toContain("object-top");
    expect(attr(renderToStaticMarkup(<Media item={item({ focal: "bottom" })} alt="أرضية" slot="card" />), "class")).toContain("object-bottom");
    // An explicit prop still wins — a thumbnail rail may want the centre of every frame.
    expect(attr(renderToStaticMarkup(<Media item={item({ focal: "top" })} alt="سقف" slot="thumb" focal="center" />), "class")).toContain("object-center");
  });

  it("applies it to a video too, so a before/after pair cannot mismatch", () => {
    const html = renderToStaticMarkup(<Media item={item({ kind: "video", url: "/api/files/clip.mp4", focal: "top" })} alt="مقطع" slot="compare" />);
    expect(html).toContain("<video");
    expect(attr(html, "class")).toContain("object-top");
    for (const part of RATIO.compare.split(" ")) expect(attr(html, "class").split(" ")).toContain(part);
  });
});

describe("the escape hatches still work", () => {
  it("ratio={null} leaves a logo's own proportions alone", () => {
    // Six call sites depend on this: the four footers, NavClassic and the shared nav Brand.
    const html = renderToStaticMarkup(<Img src="/api/files/logo.png" alt="ديكور الكويت" ratio={null} className="h-10 w-auto object-contain" />);
    expect(html).not.toMatch(/\bwidth="/);
    expect(html).not.toMatch(/\bheight="/);
    expect(attr(html, "class")).toBe("h-10 w-auto object-contain");
    // No emitted `object-cover` to fight the caller's `object-contain`, and no placeholder background to
    // show through a transparent PNG.
    expect(attr(html, "class")).not.toContain("object-cover");
    expect(attr(html, "class")).not.toContain("img-ph");
  });

  it("fill hands the box to the ancestor and reserves nothing", () => {
    const html = renderToStaticMarkup(<Img src={SRC} alt="خلفية" fill className="absolute inset-0" />);
    expect(html).not.toMatch(/\bwidth="/);
    expect(attr(html, "class").split(" ")).toEqual(expect.arrayContaining(["h-full", "w-full", "object-cover", "absolute", "inset-0"]));
    expect(attr(html, "class")).not.toContain("aspect-[");
  });

  it("treats slot=heroFull as a fill, because its height comes from the section", () => {
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="غلاف" slot="heroFull" />), "class")).toContain("h-full");
  });

  it("a raw ratio string still reserves a shape and still crops", () => {
    const html = renderToStaticMarkup(<Img src={SRC} alt="شريط" ratio="21/9" />);
    expect(Number(attr(html, "width")) / Number(attr(html, "height"))).toBeCloseTo(21 / 9, 2);
    expect(attr(html, "class")).toContain("object-cover");
  });
});

describe("an empty or broken slot reads as a photo that has not arrived", () => {
  it("draws the placeholder in the slot's own shape", () => {
    const html = renderToStaticMarkup(<Img src={null} alt="صورة مشروع" slot="card" className="rounded-card" />);
    expect(html).toContain("aria-hidden");
    const cls = attr(html, "class").split(" ");
    expect(cls).toContain("img-ph");
    expect(cls).toContain("img-ph-empty");
    expect(cls).toContain("rounded-card");
    // The shape is the slot's, so an unfilled grid does not collapse and then jump when it is filled.
    for (const part of RATIO.card.split(" ")) expect(cls).toContain(part);
  });

  it("carries the placeholder as the image's own background so a 404 degrades to it", () => {
    // A server-rendered <img> cannot run an onerror handler; its background is the only fallback there is.
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="صورة" slot="card" />), "class")).toContain("img-ph");
  });

  it("keeps it off the pictures it would show through", () => {
    // `contain` letterboxes — the bars would show the placeholder mark beside the photo.
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="رسم" slot="card" fit="contain" />), "class")).not.toContain("img-ph");
    expect(attr(renderToStaticMarkup(<Img src={SRC} alt="شعار" ratio={null} />), "class")).not.toContain("img-ph");
  });
});
