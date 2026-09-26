/**
 * What the browser does to a picture before it is uploaded, expressed as data so the rules can be tested
 * without a canvas.
 */

/** Longest edge a stored original may have. The site never lays an image out wider than this. */
export const MAX_EDGE = 2000;

/**
 * The smaller derivatives generated beside every upload. These exact numbers are the contract with the
 * renderer: `src/templates/ui/img.ts` builds its srcSet from `[480, 1080, <the widest>]` and expects a
 * sibling file named `…@480w.jpg` / `…@1080w.jpg` to exist for each one below the widest.
 */
export const UPLOAD_LADDER = [480, 1080] as const;

/**
 * Client ceiling for a video, well under the server's 300 MB.
 *
 * Two minutes of 4K off a phone is ~300 MB. On Kuwaiti mobile data that is a ten-minute upload behind a
 * percentage counter, and the owner has no way to know it will not finish — so it is refused before it
 * starts, with an instruction that fixes it.
 */
export const MAX_VIDEO_CLIENT_BYTES = 80 * 1024 * 1024;

/** Types the bucket accepts (kept in step with ALLOWED_TYPES in src/lib/storage.ts). */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

/**
 * `accept="image/*"` matched `.heic`, the canvas step threw, the catch handed back the original, and the
 * raw HEIC was uploaded — a broken image everywhere except Safari, with nothing said. Listing the types
 * explicitly also makes iOS transcode a HEIC photo to JPEG in the picker, which is the fix the owner
 * never has to know about.
 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

export function acceptFor(kind: "image" | "video"): string {
  return kind === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT;
}

const HEIC = /\.(heic|heif)$/i;

/** Why this file cannot be uploaded, as an error code the panel has a sentence for, or null. */
export function fileProblem(file: { name: string; type: string; size: number }, kind: "image" | "video"): string | null {
  if (kind === "video") {
    if (!VIDEO_TYPES.has(file.type)) return "unsupported_type";
    return file.size > MAX_VIDEO_CLIENT_BYTES ? "video_too_large" : null;
  }
  // A picker can still hand over HEIC (Android file managers, "All files"), and it is worth its own
  // sentence: the owner has to change one camera setting, not find another photo.
  if (file.type === "image/heic" || file.type === "image/heif" || HEIC.test(file.name)) return "heic";
  return IMAGE_TYPES.has(file.type) ? null : "unsupported_type";
}

export interface VariantPlan {
  /** The stored original, capped to MAX_EDGE on its longest edge. */
  base: { width: number; height: number };
  /** Smaller widths to generate beside it, largest first is not required — ascending. */
  variants: { width: number; height: number }[];
}

/**
 * The ladder for a picture of `width` x `height`.
 *
 * The marker written into the file name is the derivative's real *width*, not the longest edge: a phone
 * portrait capped to 1500x2000 is a 1500px-wide candidate, and telling the browser it is 2000 would have
 * it download the big file for a 390px phone — the exact waste this exists to remove.
 */
export function variantPlan(width: number, height: number): VariantPlan {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const base = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  const variants = UPLOAD_LADDER.filter((w) => w < base.width).map((w) => ({
    width: w,
    height: Math.max(1, Math.round((height * w) / width)),
  }));
  return { base, variants };
}

/** JPEG unless the source needs its own format (PNG for flat art, WebP stays WebP). */
export function encodeTypeFor(sourceType: string): string {
  return sourceType === "image/png" ? "image/png" : sourceType === "image/webp" ? "image/webp" : "image/jpeg";
}

export function extensionFor(encodeType: string): string {
  return encodeType === "image/png" ? ".png" : encodeType === "image/webp" ? ".webp" : ".jpg";
}
