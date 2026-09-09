/**
 * Decorative background patterns inspired by Kuwaiti and Gulf heritage (Sadu weaving, Islamic
 * geometry, mashrabiya lattice, dhow sails / sea waves). Returned as CSS background-image data URIs
 * tinted with the given colour. Kept subtle: use with low opacity overlays.
 */
export type PatternKey = "none" | "sadu" | "geometric" | "arabesque" | "mashrabiya" | "waves" | "dots" | "lines" | "hex" | "stars" | "diamonds";

export const PATTERN_KEYS: PatternKey[] = ["none", "sadu", "geometric", "arabesque", "mashrabiya", "waves", "dots", "lines", "hex", "stars", "diamonds"];

function svg(w: number, h: number, body: string) {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
}

export function patternCss(key: PatternKey, color: string, opacity = 0.12): { backgroundImage: string; backgroundSize: string } | null {
  const c = color;
  const o = opacity;
  switch (key) {
    case "sadu":
      return {
        backgroundImage: svg(
          48,
          48,
          `<g fill='${c}' fill-opacity='${o}'><path d='M24 0l12 12-12 12L12 12z'/><path d='M0 24l12 12L0 48zM48 24L36 36l12 12z'/><path d='M24 24l12 12-12 12-12-12z' fill-opacity='${o * 0.6}'/></g>`,
        ),
        backgroundSize: "48px 48px",
      };
    case "geometric":
      return {
        backgroundImage: svg(
          64,
          64,
          `<g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1'><path d='M32 4l8 20 20 8-20 8-8 20-8-20-20-8 20-8z'/><path d='M12 12l40 40M52 12L12 52'/><circle cx='32' cy='32' r='6'/></g>`,
        ),
        backgroundSize: "64px 64px",
      };
    case "arabesque":
      return {
        backgroundImage: svg(
          80,
          80,
          `<g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.2'><path d='M40 0c0 22-18 40-40 40 22 0 40 18 40 40 0-22 18-40 40-40C58 40 40 22 40 0z'/><circle cx='40' cy='40' r='10'/><circle cx='0' cy='0' r='10'/><circle cx='80' cy='0' r='10'/><circle cx='0' cy='80' r='10'/><circle cx='80' cy='80' r='10'/></g>`,
        ),
        backgroundSize: "80px 80px",
      };
    case "mashrabiya":
      return {
        backgroundImage: svg(
          40,
          40,
          `<g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1'><path d='M20 0v40M0 20h40'/><path d='M20 8l12 12-12 12L8 20z'/><circle cx='20' cy='20' r='3'/></g>`,
        ),
        backgroundSize: "40px 40px",
      };
    case "waves":
      return {
        backgroundImage: svg(
          120,
          24,
          `<path d='M0 12c15-12 30-12 45 0s30 12 45 0 30-12 45 0' fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.5'/>`,
        ),
        backgroundSize: "120px 24px",
      };
    case "dots":
      return { backgroundImage: svg(24, 24, `<circle cx='2' cy='2' r='1.6' fill='${c}' fill-opacity='${o}'/>`), backgroundSize: "24px 24px" };
    case "lines":
      return {
        backgroundImage: svg(32, 32, `<path d='M0 32L32 0' stroke='${c}' stroke-opacity='${o}' stroke-width='1'/>`),
        backgroundSize: "32px 32px",
      };
    case "hex":
      return {
        backgroundImage: svg(
          56,
          64,
          `<g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1'><path d='M28 2l24 14v28L28 58 4 44V16z'/><path d='M28 2v56M4 16l48 28M52 16L4 44' stroke-opacity='${o * 0.5}'/></g>`,
        ),
        backgroundSize: "56px 64px",
      };
    case "stars":
      return {
        backgroundImage: svg(
          72,
          72,
          `<g fill='${c}' fill-opacity='${o}'><path d='M36 12l4 10 10 4-10 4-4 10-4-10-10-4 10-4z'/><path d='M8 52l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/><path d='M62 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/></g>`,
        ),
        backgroundSize: "72px 72px",
      };
    case "diamonds":
      return {
        backgroundImage: svg(
          32,
          32,
          `<path d='M16 2l14 14-14 14L2 16z' fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1'/>`,
        ),
        backgroundSize: "32px 32px",
      };
    default:
      return null;
  }
}

/** Section divider shapes rendered between sections. */
export function dividerPath(kind: "wave" | "diagonal" | "curve" | "zigzag" | "arch"): string {
  switch (kind) {
    case "wave":
      return "M0,32 C240,80 480,0 720,32 C960,64 1200,0 1440,32 L1440,80 L0,80 Z";
    case "diagonal":
      return "M0,80 L1440,0 L1440,80 Z";
    case "curve":
      return "M0,0 C480,90 960,90 1440,0 L1440,80 L0,80 Z";
    case "zigzag":
      return "M0,80 L120,20 L240,80 L360,20 L480,80 L600,20 L720,80 L840,20 L960,80 L1080,20 L1200,80 L1320,20 L1440,80 Z";
    case "arch":
      return "M0,80 C0,80 300,0 720,0 C1140,0 1440,80 1440,80 Z";
  }
}
