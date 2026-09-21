import type { CSSProperties } from "react";
import type { LText, Locale, SiteData } from "@/lib/types";
import { lt, t as uiT, dirOf, SITE_UI, type SiteUiKey } from "@/lib/i18n/site";
import { whatsappLink, telLink } from "@/lib/content/defaults";
import { FONTS, isFontKey } from "./fonts";
import { patternCss, PATTERN_KEYS, type PatternKey } from "./decor/patterns";
import type { ButtonStyle, DesignTokens, Radius, RenderCtx, TemplateDef } from "./types";

/** Card/frame radius per token. "full" stays a generous rounding for cards; pill shapes are for buttons only. */
const RADIUS: Record<DesignTokens["radius"], string> = {
  none: "0px",
  sm: "6px",
  md: "12px",
  lg: "18px",
  xl: "26px",
  full: "36px",
};

const HEX = /^#[0-9a-f]{6}$/i;
const RADII: Radius[] = ["none", "sm", "md", "lg", "xl", "full"];
const BUTTONS: ButtonStyle[] = ["solid", "outline", "pill", "square", "glow", "underline"];

function mix(hex: string, towards: string, amount: number): string {
  const a = hex.slice(1).match(/.{2}/g)!.map((h) => parseInt(h, 16));
  const b = towards.slice(1).match(/.{2}/g)!.map((h) => parseInt(h, 16));
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const c = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * The colour itself when it already reads on `bg`, otherwise the same hue darkened (light backgrounds)
 * or lightened (dark backgrounds) just enough to reach the requested contrast. Used for accent text.
 */
export function readableOn(color: string, bg: string, min = 3): string {
  if (!HEX.test(color) || !HEX.test(bg)) return color;
  if (contrastRatio(color, bg) >= min) return color;
  const [h, s, l] = hexToHsl(color);
  // Walk the hue's lightness in both directions and take the first value that reaches `min`, or the
  // highest contrast found. Committing to one direction from the background's luminance alone lost on
  // mid-tone backgrounds, where the shorter way to readable text is often the one it did not try.
  let best = color;
  let bestRatio = contrastRatio(color, bg);
  for (let i = 1; i <= 34; i++) {
    for (const nl of [l - i * 0.03, l + i * 0.03]) {
      if (nl < 0 || nl > 1) continue;
      const candidate = hslToHex(h, Math.min(1, s), nl);
      const ratio = contrastRatio(candidate, bg);
      if (ratio >= min) return candidate;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    }
  }
  return best;
}

/**
 * Whether white text reads better than black on this colour.
 *
 * This used to weigh the raw sRGB channels and compare against 0.45. sRGB is gamma-encoded, so that
 * formula overstates how bright a mid-tone is and picked the wrong foreground for a whole band of
 * ordinary brand colours. `luminance()` above already linearises the channels the way WCAG defines it;
 * the decision is now simply which of black or white has the better contrast ratio against `hex`.
 */
function isDark(hex: string): boolean {
  if (!HEX.test(hex)) return false;
  return contrastRatio("#ffffff", hex) >= contrastRatio("#111111", hex);
}

/** Black or white, whichever reads better on `bg`. */
function foregroundOn(bg: string, dark = "#111111", light = "#ffffff"): string {
  return isDark(bg) ? light : dark;
}

/**
 * The most readable text colour on `bg`, trying each candidate and letting `readableOn` push it.
 *
 * Choosing the candidate from the mode alone is not enough on a mid-tone background (a saturated pink, a
 * mid green): the mode says "dark", so the light grey is chosen, and no amount of lightening reaches
 * 4.5:1 because white itself only manages about 3:1 there. Trying both and keeping the better result
 * finds the direction that actually works.
 */
function bestTextOn(bg: string, min: number, ...candidates: string[]): string {
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const tuned = readableOn(c, bg, min);
    const ratio = contrastRatio(tuned, bg);
    if (ratio >= min) return tuned;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = tuned;
    }
  }
  return best;
}

/**
 * Of several backgrounds, the one `color` reads worst on — so raising it there satisfies all of them.
 *
 * It has to be judged against the colour itself, not against an absolute like "the darkest". In a dark
 * theme the banded surfaces are *lighter* than the page, and light text has the least room there; in a
 * light theme they are darker and dark text has the least room. Picking an extreme gets one of the two
 * backwards and pushes the text the wrong way.
 */
function hardestFor(color: string, ...backgrounds: string[]): string {
  const valid = backgrounds.filter((b) => HEX.test(b));
  if (!valid.length || !HEX.test(color)) return valid[0] ?? "#ffffff";
  return valid.reduce((worst, b) => (contrastRatio(color, b) < contrastRatio(color, worst) ? b : worst), valid[0]);
}

/** Apply per-site theme overrides (admin colour/font/shape choices) on top of template tokens. */
export function effectiveTokens(def: TemplateDef, site: SiteData): DesignTokens {
  const th = site.content.theme || {};
  const tokens: DesignTokens = { ...def.tokens };
  if (th.primary && HEX.test(th.primary)) {
    tokens.primary = th.primary.toLowerCase();
    tokens.primaryFg = foregroundOn(tokens.primary);
  }
  if (th.secondary && HEX.test(th.secondary)) {
    tokens.secondary = th.secondary.toLowerCase();
    tokens.secondaryFg = foregroundOn(tokens.secondary, "#111111", "#f8f8f8");
  }
  if (th.accent && HEX.test(th.accent)) {
    tokens.accent = th.accent.toLowerCase();
    tokens.accentFg = foregroundOn(tokens.accent);
  }
  if (th.bg && HEX.test(th.bg)) {
    tokens.bg = th.bg.toLowerCase();
    const dark = isDark(tokens.bg);
    tokens.mode = dark ? "dark" : "light";
    tokens.surface = th.surface && HEX.test(th.surface) ? th.surface.toLowerCase() : mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.04);
    tokens.surface2 = mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.08);
    tokens.border = mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.14);
    if (!(th.text && HEX.test(th.text))) {
      // Two fixed greys cannot serve every background an owner picks: on a mid-tone (a brand green, a
      // dusty blue) the light one is too light and the dark one too dark, and the muted grey landed as
      // low as 1.3:1 — invisible secondary text. Start from the pair that suits the mode, then push each
      // one until it actually reads on this background.
      tokens.text = bestTextOn(tokens.bg, 7, dark ? "#f3f4f6" : "#111827", dark ? "#111827" : "#f3f4f6");
      tokens.muted = bestTextOn(tokens.bg, 4.5, dark ? "#a3a8b3" : "#5b6472", dark ? "#5b6472" : "#a3a8b3");
    }
  } else if (th.surface && HEX.test(th.surface)) {
    tokens.surface = th.surface.toLowerCase();
  }
  if (th.text && HEX.test(th.text)) {
    tokens.text = th.text.toLowerCase();
    // The muted tone is the text colour faded towards the background; keep fading only while it still reads.
    tokens.muted = readableOn(mix(tokens.text, tokens.bg, 0.4), tokens.bg, 4.5);
  }
  // Last word on the two tokens that only ever carry text. A template ships its own palette, and eight of
  // them had `muted` sitting just under 4.5:1 on the banded surface — small secondary text (step dates,
  // captions, stat labels) that misses AA. Guaranteeing it here covers every template, and every future
  // one, instead of nudging hex values one by one.
  tokens.muted = readableOn(tokens.muted, hardestFor(tokens.muted, tokens.bg, tokens.surface, tokens.surface2), 4.5);
  if (isFontKey(th.headingFont)) tokens.headingFont = th.headingFont;
  if (isFontKey(th.bodyFont)) tokens.bodyFont = th.bodyFont;
  if (th.radius && (RADII as string[]).includes(th.radius)) tokens.radius = th.radius as Radius;
  if (th.buttonStyle && (BUTTONS as string[]).includes(th.buttonStyle)) tokens.buttonStyle = th.buttonStyle as ButtonStyle;
  if (th.pattern && (PATTERN_KEYS as string[]).includes(th.pattern)) tokens.pattern = th.pattern as PatternKey;
  return tokens;
}

export function tokensToStyle(tokens: DesignTokens): CSSProperties {
  const pattern = patternCss(tokens.pattern, tokens.text, tokens.mode === "dark" ? 0.08 : 0.07);
  return {
    "--t-primary": tokens.primary,
    "--t-primary-fg": tokens.primaryFg,
    "--t-secondary": tokens.secondary,
    "--t-secondary-fg": tokens.secondaryFg,
    "--t-accent": tokens.accent,
    "--t-accent-fg": tokens.accentFg,
    "--t-accent-text": readableOn(tokens.accent, tokens.bg, 4.5),
    // `primary` is a fill colour first, so it is not always legible as small text on the page background
    // (two shipped templates sat at 3.05:1 and 3.50:1). Sections that set primary *as text* use this
    // token instead, exactly like `--t-accent-text`; it equals `--t-primary` whenever that already reads.
    "--t-primary-text": readableOn(tokens.primary, tokens.bg, 4.5),
    "--t-accent-on-dark": readableOn(tokens.accent, tokens.secondary),
    "--t-accent-on-primary": readableOn(tokens.accent, tokens.primary),
    "--t-bg": tokens.bg,
    "--t-surface": tokens.surface,
    "--t-surface-2": tokens.surface2,
    "--t-text": tokens.text,
    "--t-muted": tokens.muted,
    "--t-border": tokens.border,
    "--t-font-heading": FONTS[tokens.headingFont].css,
    "--t-font-body": FONTS[tokens.bodyFont].css,
    "--t-radius": RADIUS[tokens.radius],
    "--t-pattern": pattern?.backgroundImage ?? "none",
    "--t-pattern-size": pattern?.backgroundSize ?? "auto",
    colorScheme: tokens.mode,
    backgroundColor: tokens.bg,
    color: tokens.text,
    fontFamily: FONTS[tokens.bodyFont].css,
  } as CSSProperties;
}

/** Site-editable chrome labels (nav, buttons, footer) fall back to the dictionary. */
export function uiLabel(site: SiteData, locale: Locale, key: SiteUiKey): string {
  const custom = site.content.ui?.[key];
  const v = custom ? lt(locale, custom, "") : "";
  return v || uiT(locale, key);
}

/** Keys that site admins may override from the "labels" content section. */
export const EDITABLE_UI_KEYS: SiteUiKey[] = (Object.keys(SITE_UI) as SiteUiKey[]).filter((k) => k !== "lang_switch");

export function buildCtx(input: {
  site: SiteData;
  def: TemplateDef;
  locale: Locale;
  visitorCode: string | null;
  preview?: boolean;
}): RenderCtx {
  const { site, def, locale } = input;
  const c = site.content;
  const text = (v: LText | null | undefined, fallback = "") => lt(locale, v, fallback);
  return {
    site,
    def,
    locale,
    dir: dirOf(locale),
    visitorCode: input.visitorCode,
    whatsappHref: whatsappLink(c.contact.whatsapp, text(c.contact.whatsappMessage), input.visitorCode),
    telHref: telLink(c.contact.phone || c.contact.whatsapp),
    text,
    ui: (key: SiteUiKey) => uiLabel(site, locale, key),
    preview: !!input.preview,
  };
}
