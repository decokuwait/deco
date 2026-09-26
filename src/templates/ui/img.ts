const UNSPLASH = /^https:\/\/images\.unsplash\.com\/[^?]+\?[^#]*[?&]w=\d+/;
const WIDTHS = [480, 768, 1080, 1400];

/**
 * The derivative ladder an uploaded picture is resized into at upload time, and the marker that says so.
 *
 * A stored file used to be served at whatever size it was uploaded at, to every device: the demo
 * previews got a proper srcSet from Unsplash while a real customer's phone downloaded the full ~2000px
 * original. Uploads now carry their widest derivative's width in the file name — `…@2000w.jpg` — and the
 * smaller ones sit beside it under the same name. `safeFilename` strips `@` from every uploaded name, so
 * the marker can only have been written by the derivative step: an older upload, a hand-typed URL or a
 * video poster has none and gets no candidates at all, rather than a srcSet full of 404s.
 */
const UPLOAD_WIDTHS = [480, 1080, 2000];
const DERIVATIVE = /^(.+)@(\d{2,5})w(\.[a-z0-9]{1,5})?$/i;

/**
 * The `sizes` a picture is actually laid out at. One value cannot serve them all: the old default claimed
 * every image was half the viewport, which made a 33vw grid card and a 96px thumbnail each fetch a file
 * about three times wider than the box it lands in.
 *
 * ## Why these are lengths and not bare `vw` fractions
 *
 * `33vw` is not what a card is. `Container` is `px-4 sm:px-6 lg:px-8` inside `max-w-6xl`/`max-w-7xl`, and a
 * grid adds a gap between every pair of columns, so a three-up card on a 1920px desktop is 400px wide while
 * `33vw` claims 634 — enough of an overstatement to jump the browser a whole rung up the candidate ladder
 * (1400px instead of 768px from Unsplash, 2000px instead of 1080px from an upload). On the phone plans this
 * product is sold into, that one wrong number is the largest avoidable payload on the page, and it is on
 * every card of every grid. The values below subtract the gutters and the gaps and cap at the container's
 * real maximum, measured against the rendered boxes rather than assumed.
 *
 * ## Why they are not trimmed any further
 *
 * `sizes` only describes *width*, and `object-cover` binds on whichever axis is short. A 16:9 landscape
 * dropped into a 3:4 portrait slot is scaled until its height covers, so the source width the browser
 * actually consumes is wider than the box — and `sizes` cannot express that. Declaring a box narrower than
 * it is would therefore show up as softness on exactly the mixed-orientation uploads the ratio work exists
 * to accommodate. So: honest, never miserly.
 */
export const SIZES = {
  /** Full-bleed: a fullscreen hero, a background photo that spans the viewport. */
  full: "100vw",
  /** One picture the full width of the page container (a project detail lead image). */
  container: "(min-width: 1344px) 1216px, calc(100vw - 2rem)",
  /** One of two columns on a desktop, full container width below it. */
  half: "(min-width: 1344px) 608px, (min-width: 1024px) calc(50vw - 2.5rem), calc(100vw - 2rem)",
  /** A three-column grid (finished projects, services): 3 up from `lg`, 2 up from `sm`, 1 up on a phone. */
  third: "(min-width: 1344px) 400px, (min-width: 1024px) calc(33.3vw - 2.25rem), (min-width: 640px) calc(50vw - 2.25rem), calc(100vw - 2rem)",
  /** A four-column grid or bento cell that is one-up on a phone (`ServicesBento`). */
  quarter: "(min-width: 1344px) 296px, (min-width: 1024px) calc(25vw - 1.75rem), (min-width: 640px) calc(50vw - 2rem), calc(100vw - 2rem)",
  /** A bento cell that stays two-up on a phone (`FinishedBento` is `grid-cols-2` from the smallest width). */
  bento: "(min-width: 1344px) 296px, (min-width: 1024px) calc(25vw - 1.75rem), calc(50vw - 1.5rem)",
  /** A testimonial portrait or team avatar. */
  avatar: "96px",
  /** A fixed thumbnail rail. */
  thumb: "96px",
} as const;

/** Candidates for an uploaded file, or null when this URL carries no derivative marker. */
function uploadedSrcSet(src: string): string | null {
  const cut = src.search(/[?#]/);
  const path = cut === -1 ? src : src.slice(0, cut);
  const query = cut === -1 ? "" : src.slice(cut);
  const slash = path.lastIndexOf("/");
  const m = DERIVATIVE.exec(path.slice(slash + 1));
  if (!m) return null;
  const [, base, widest, ext = ""] = m;
  const max = Number(widest);
  const dir = path.slice(0, slash + 1);
  // Never offer a candidate wider than the widest derivative: upscaling an original is the one thing the
  // upload step will not do, so those files do not exist.
  const widths = [...UPLOAD_WIDTHS.filter((w) => w < max), max];
  return widths.map((w) => `${dir}${base}@${w}w${ext}${query} ${w}w`).join(", ");
}

/**
 * Responsive candidates for a picture: the demo (Unsplash) URLs, which accept a `w=` size parameter, and
 * uploaded files that carry the derivative marker above. Anything else is served exactly as stored.
 */
export function responsiveSrc(src: string | null | undefined, sizes: string = SIZES.half): { srcSet?: string; sizes?: string } {
  if (!src) return {};
  if (UNSPLASH.test(src)) return { srcSet: WIDTHS.map((w) => `${src.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(", "), sizes };
  const uploaded = uploadedSrcSet(src);
  return uploaded ? { srcSet: uploaded, sizes } : {};
}
