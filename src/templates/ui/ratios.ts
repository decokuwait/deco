/**
 * Aspect ratios for every picture slot in the template engine.
 *
 * The problem this solves: an owner uploads whatever his phone took — a 3:4 portrait of a majlis ceiling,
 * a 16:9 landscape of a façade, a square crop from Instagram — into a box whose shape was hard-coded per
 * component. A portrait in a 16:9 slot lost its top and bottom; a landscape in a 4:5 slot lost its sides.
 * Every slot now declares one ratio here, chosen so that `object-cover` crops the *least* interesting part
 * of a typical decor photograph rather than its subject.
 *
 * Why ratios and not `h-auto`: a box with no declared ratio has no height until its image decodes, which
 * is a layout shift on every card in the grid. Declaring the ratio reserves the space (CLS stays at zero)
 * and lets `object-cover` do the fitting.
 *
 * ## Choosing for phones
 *
 * Kuwaiti traffic is overwhelmingly mobile, and a phone is *narrow*: at 360–430 px CSS, a 16:9 box is only
 * ~200–240 px tall, which is too short for a room to read. Tall boxes are the opposite problem — a 4:5
 * hero at 430 px is 537 px tall and pushes the WhatsApp button off the first screen. So every slot below
 * starts from a mobile ratio that keeps the subject legible *and* leaves the call to action reachable,
 * then widens as the viewport does.
 *
 * `xs` (the `max-[380px]:` variant) exists because the 320–380 px band — an iPhone SE, a Galaxy A0x, the
 * older Androids still common in the Gulf — is where a tall ratio first starts pushing content below the
 * fold. Those devices get a slightly wider (shorter) box.
 *
 * Tailwind 4 emits arbitrary variants as written, so these strings are safe to compose with `cx()`. Keep
 * them as complete class strings rather than building them at runtime: Tailwind only sees literals.
 */

/** The ratio a slot reserves, mobile-first, as a Tailwind class string. */
export const RATIO = {
  /**
   * The portrait image beside hero copy (`HeroSplit`, `HeroArch`, `HeroEditorial`).
   * Phone: 4/5 — tall enough for a ceiling, short enough that the CTA stays on screen. Very narrow
   * phones get 1/1 so the copy above it is not pushed off. Desktop returns to 4/5 beside the text column.
   */
  heroPortrait: "aspect-[1/1] max-[380px]:aspect-[5/4] sm:aspect-[5/4] lg:aspect-[4/5]",

  /**
   * A wide hero image above or behind the copy (`HeroStacked`).
   * Never taller than 4/3 on a phone: this sits above the fold and competes with the headline.
   */
  heroWide: "aspect-[4/3] max-[380px]:aspect-[3/2] sm:aspect-[16/10] lg:aspect-[16/9]",

  /**
   * A hero photograph that is a *panel* of the section rather than a picture in a box (`HeroDiagonal`):
   * on a phone it stacks under the copy and needs a shape of its own, on a desktop the section's own
   * height decides and a declared ratio would fight it — hence `lg:aspect-auto`, which is why this
   * cannot be `heroWide`.
   */
  heroSide: "aspect-[4/3] max-[380px]:aspect-[3/2] sm:aspect-[16/10] lg:aspect-auto",

  /**
   * A full-bleed hero that fills the viewport (`HeroFullscreen`, `HeroVideo`).
   * Height comes from the section, not a ratio — the class is here so callers have one place to look.
   */
  heroFull: "",

  /**
   * One of the small images in a hero collage (`HeroGallery`, `HeroCards`).
   * Square on a phone so a row of them stays shallow; portrait once there is room.
   */
  heroTile: "aspect-[1/1] lg:aspect-[3/4]",

  /**
   * A project or service card in a grid.
   * 4/3 on a phone (a room reads better slightly wide than square), 3/2 on desktop where cards narrow.
   */
  card: "aspect-[4/3] max-[380px]:aspect-[3/2] lg:aspect-[3/2]",

  /** A card that spans two columns, or a bento feature cell. */
  cardWide: "aspect-[3/2] lg:aspect-[16/9]",

  /** A bento cell that is deliberately tall. */
  cardTall: "aspect-[4/3] sm:aspect-[3/4]",

  /**
   * A tall card whose caption is laid over the photograph: the services carousel, the finished-projects
   * filmstrip, the about strip.
   *
   * These cards are a *fraction* of the viewport, so a portrait ratio multiplies: a 3/4 card at 82% of a
   * 430 px phone stands 470 px tall and one card swallows the screen with its caption half off the bottom.
   * Square on a phone, wider still on the narrow band, and portrait only once several of them sit side by
   * side and each is a third of the row.
   */
  cardPortrait: "aspect-[1/1] max-[380px]:aspect-[4/3] sm:aspect-[4/5] lg:aspect-[3/4]",

  /**
   * A small portrait figure at a fixed width, floated into body copy (`AboutEditorial`).
   *
   * The one slot with no device band, deliberately: this box is `w-36 sm:w-52`, a constant rather than a
   * fraction of the viewport, so it cannot grow tall enough to push the page down and one honest shape
   * beats a breakpoint chain that would only make the figure stubby.
   */
  portrait: "aspect-[3/4]",

  /**
   * Before/after comparison. Both halves MUST use the same ratio or the slider reveals a mismatch, so
   * this is the one slot where the value matters for correctness and not only for looks.
   */
  compare: "aspect-[4/3] max-[380px]:aspect-[3/2] lg:aspect-[3/2]",

  /** A single step in a progress timeline or filmstrip. */
  step: "aspect-[4/3] lg:aspect-[3/2]",

  /** The about-section photograph, which sits beside body copy. */
  about: "aspect-[4/3] lg:aspect-[4/5]",

  /** A testimonial portrait or team avatar. Always square. */
  avatar: "aspect-[1/1]",

  /** The fixed thumbnail rail under a gallery. */
  thumb: "aspect-[1/1]",

  /** A wide band behind a CTA or stats strip. */
  band: "aspect-[16/9] lg:aspect-[21/9]",
} as const;

export type RatioSlot = keyof typeof RATIO;

/**
 * The numeric ratio for a slot, for `width`/`height` attributes.
 *
 * The attributes only need to encode the *shape* the browser should reserve before the image decodes, and
 * they cannot be responsive — so each slot reports its widest (shortest) form. The CSS class above is what
 * actually sizes the box at every breakpoint; these two agree on desktop, which is where an over-tall
 * reservation would be most visible.
 */
export const RATIO_ATTR: Record<RatioSlot, string | null> = {
  heroPortrait: "4/5",
  heroWide: "16/9",
  heroSide: "16/10",
  heroFull: null,
  heroTile: "3/4",
  card: "3/2",
  cardWide: "16/9",
  cardTall: "3/4",
  cardPortrait: "3/4",
  portrait: "3/4",
  compare: "3/2",
  step: "3/2",
  about: "4/5",
  avatar: "1/1",
  thumb: "1/1",
  band: "21/9",
};

/**
 * `object-position` from an authored focal point, so the owner decides what survives the crop.
 *
 * `object-cover` fills the box and throws away the overflow, and its default centre is wrong for the two
 * commonest decor shots: a ceiling (the subject is at the top) and a floor (at the bottom). `top` and
 * `bottom` are the two that matter; anything else centres.
 */
export function focalClass(focal?: string | null): string {
  if (focal === "top") return "object-top";
  if (focal === "bottom") return "object-bottom";
  return "object-center";
}
