import { FACES } from "./font-faces";

/**
 * Google Fonts with Arabic support (plus a few Latin display fonts used for English headings), self-hosted
 * through next/font. `display` marks calligraphic / heavy faces that read well as a heading but not as a
 * paragraph: sections that set long text in the heading font fall back to the body font for those.
 */
const FAMILIES = {
  cairo: { family: "Cairo", fallback: "system-ui, sans-serif" },
  tajawal: { family: "Tajawal", fallback: "system-ui, sans-serif" },
  almarai: { family: "Almarai", fallback: "system-ui, sans-serif" },
  amiri: { family: "Amiri", fallback: "serif" },
  notoKufi: { family: "Noto Kufi Arabic", fallback: "system-ui, sans-serif" },
  notoNaskh: { family: "Noto Naskh Arabic", fallback: "serif" },
  notoSans: { family: "Noto Sans Arabic", fallback: "system-ui, sans-serif" },
  changa: { family: "Changa", fallback: "system-ui, sans-serif" },
  elMessiri: { family: "El Messiri", fallback: "system-ui, sans-serif" },
  markazi: { family: "Markazi Text", fallback: "serif" },
  readex: { family: "Readex Pro", fallback: "system-ui, sans-serif" },
  ibmPlex: { family: "IBM Plex Sans Arabic", fallback: "system-ui, sans-serif" },
  reemKufi: { family: "Reem Kufi", fallback: "system-ui, sans-serif" },
  baloo: { family: "Baloo Bhaijaan 2", fallback: "system-ui, sans-serif" },
  rubik: { family: "Rubik", fallback: "system-ui, sans-serif" },
  arefRuqaa: { family: "Aref Ruqaa", fallback: "serif", display: true },
  lalezar: { family: "Lalezar", fallback: "system-ui, sans-serif", display: true },
  mada: { family: "Mada", fallback: "system-ui, sans-serif" },
  vazirmatn: { family: "Vazirmatn", fallback: "system-ui, sans-serif" },
  alexandria: { family: "Alexandria", fallback: "system-ui, sans-serif" },
  zain: { family: "Zain", fallback: "system-ui, sans-serif" },
  harmattan: { family: "Harmattan", fallback: "system-ui, sans-serif" },
  lateef: { family: "Lateef", fallback: "serif" },
  kufam: { family: "Kufam", fallback: "system-ui, sans-serif" },
  marhey: { family: "Marhey", fallback: "system-ui, sans-serif", display: true },
  rakkas: { family: "Rakkas", fallback: "serif", display: true },
  scheherazade: { family: "Scheherazade New", fallback: "serif" },
  // Latin display faces: Arabic text inside them falls through to an Arabic family.
  playfair: { family: "Playfair Display", fallback: `${FACES.amiri}, serif` },
  manrope: { family: "Manrope", fallback: `${FACES.tajawal}, system-ui, sans-serif` },
  sora: { family: "Sora", fallback: `${FACES.cairo}, system-ui, sans-serif` },
} as const;

export type FontKey = keyof typeof FAMILIES;
export const FONT_KEYS = Object.keys(FAMILIES) as FontKey[];

/** Display name and the `font-family` CSS value (self-hosted face first, then system fallbacks). */
export const FONTS: Record<FontKey, { family: string; css: string }> = Object.fromEntries(
  FONT_KEYS.map((k) => [k, { family: FAMILIES[k].family, css: `${FACES[k]}, ${FAMILIES[k].fallback}` }]),
) as Record<FontKey, { family: string; css: string }>;

/** Heading faces that must not carry paragraphs (quotes, testimonials, story text). */
export function isDisplayFont(key: FontKey): boolean {
  return "display" in FAMILIES[key];
}

export function isFontKey(v: unknown): v is FontKey {
  return typeof v === "string" && v in FAMILIES;
}
