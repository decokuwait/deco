/** Google Fonts with Arabic support (plus a few Latin display fonts used for English headings). */
export const FONTS = {
  cairo: { family: "Cairo", css: "'Cairo', system-ui, sans-serif", gf: "Cairo:wght@400;600;700;800;900" },
  tajawal: { family: "Tajawal", css: "'Tajawal', system-ui, sans-serif", gf: "Tajawal:wght@400;500;700;800;900" },
  almarai: { family: "Almarai", css: "'Almarai', system-ui, sans-serif", gf: "Almarai:wght@300;400;700;800" },
  amiri: { family: "Amiri", css: "'Amiri', serif", gf: "Amiri:ital,wght@0,400;0,700;1,400" },
  notoKufi: { family: "Noto Kufi Arabic", css: "'Noto Kufi Arabic', system-ui, sans-serif", gf: "Noto+Kufi+Arabic:wght@400;500;700;800;900" },
  notoNaskh: { family: "Noto Naskh Arabic", css: "'Noto Naskh Arabic', serif", gf: "Noto+Naskh+Arabic:wght@400;500;600;700" },
  notoSans: { family: "Noto Sans Arabic", css: "'Noto Sans Arabic', system-ui, sans-serif", gf: "Noto+Sans+Arabic:wght@400;500;600;700;800" },
  changa: { family: "Changa", css: "'Changa', system-ui, sans-serif", gf: "Changa:wght@400;500;600;700;800" },
  elMessiri: { family: "El Messiri", css: "'El Messiri', system-ui, sans-serif", gf: "El+Messiri:wght@400;500;600;700" },
  markazi: { family: "Markazi Text", css: "'Markazi Text', serif", gf: "Markazi+Text:wght@400;500;600;700" },
  readex: { family: "Readex Pro", css: "'Readex Pro', system-ui, sans-serif", gf: "Readex+Pro:wght@300;400;500;600;700" },
  ibmPlex: { family: "IBM Plex Sans Arabic", css: "'IBM Plex Sans Arabic', system-ui, sans-serif", gf: "IBM+Plex+Sans+Arabic:wght@300;400;500;600;700" },
  reemKufi: { family: "Reem Kufi", css: "'Reem Kufi', system-ui, sans-serif", gf: "Reem+Kufi:wght@400;500;600;700" },
  baloo: { family: "Baloo Bhaijaan 2", css: "'Baloo Bhaijaan 2', system-ui, sans-serif", gf: "Baloo+Bhaijaan+2:wght@400;500;600;700;800" },
  rubik: { family: "Rubik", css: "'Rubik', system-ui, sans-serif", gf: "Rubik:wght@400;500;600;700;800;900" },
  arefRuqaa: { family: "Aref Ruqaa", css: "'Aref Ruqaa', serif", gf: "Aref+Ruqaa:wght@400;700" },
  lalezar: { family: "Lalezar", css: "'Lalezar', system-ui, sans-serif", gf: "Lalezar" },
  mada: { family: "Mada", css: "'Mada', system-ui, sans-serif", gf: "Mada:wght@300;400;500;600;700;900" },
  vazirmatn: { family: "Vazirmatn", css: "'Vazirmatn', system-ui, sans-serif", gf: "Vazirmatn:wght@300;400;500;600;700;800" },
  alexandria: { family: "Alexandria", css: "'Alexandria', system-ui, sans-serif", gf: "Alexandria:wght@300;400;500;600;700;800" },
  zain: { family: "Zain", css: "'Zain', system-ui, sans-serif", gf: "Zain:wght@300;400;700;800;900" },
  harmattan: { family: "Harmattan", css: "'Harmattan', system-ui, sans-serif", gf: "Harmattan:wght@400;500;600;700" },
  lateef: { family: "Lateef", css: "'Lateef', serif", gf: "Lateef:wght@400;500;600;700" },
  kufam: { family: "Kufam", css: "'Kufam', system-ui, sans-serif", gf: "Kufam:wght@400;500;600;700;800" },
  marhey: { family: "Marhey", css: "'Marhey', system-ui, sans-serif", gf: "Marhey:wght@300;400;500;600;700" },
  rakkas: { family: "Rakkas", css: "'Rakkas', serif", gf: "Rakkas" },
  scheherazade: { family: "Scheherazade New", css: "'Scheherazade New', serif", gf: "Scheherazade+New:wght@400;500;600;700" },
  playfair: { family: "Playfair Display", css: "'Playfair Display', 'Amiri', serif", gf: "Playfair+Display:wght@400;600;700;800" },
  manrope: { family: "Manrope", css: "'Manrope', 'Tajawal', system-ui, sans-serif", gf: "Manrope:wght@400;500;600;700;800" },
  sora: { family: "Sora", css: "'Sora', 'Cairo', system-ui, sans-serif", gf: "Sora:wght@400;500;600;700;800" },
} as const;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export function isFontKey(v: unknown): v is FontKey {
  return typeof v === "string" && v in FONTS;
}

export function googleFontsHref(keys: FontKey[]): string {
  const uniq = [...new Set(keys)];
  return `https://fonts.googleapis.com/css2?${uniq.map((k) => `family=${FONTS[k].gf}`).join("&")}&display=swap`;
}
