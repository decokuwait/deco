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
 */
export const SIZES = {
  /** Full-bleed: a fullscreen hero, a background photo. */
  full: "100vw",
  /** One of two columns on a desktop, full width below it. */
  half: "(min-width: 1024px) 50vw, 100vw",
  /** A three-column grid (finished projects, services). */
  third: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  /** A four-column grid or bento cell. */
  quarter: "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
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
