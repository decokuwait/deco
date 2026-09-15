const UNSPLASH = /^https:\/\/images\.unsplash\.com\/[^?]+\?[^#]*[?&]w=\d+/;
const WIDTHS = [480, 768, 1080, 1400];

/**
 * Responsive candidates for the demo (Unsplash) pictures, which accept a `w=` size parameter: a phone then
 * downloads a 480px file instead of the 1400px one. Uploaded files are served exactly as stored (they are
 * already resized on the device before upload), so they get no candidates.
 */
export function responsiveSrc(src: string | null | undefined, sizes = "(min-width: 1024px) 50vw, 100vw"): { srcSet?: string; sizes?: string } {
  if (!src || !UNSPLASH.test(src)) return {};
  return { srcSet: WIDTHS.map((w) => `${src.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(", "), sizes };
}
