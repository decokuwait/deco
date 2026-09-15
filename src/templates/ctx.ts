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
  const darken = luminance(bg) > 0.18;
  let best = color;
  for (let i = 1; i <= 24; i++) {
    const nl = darken ? Math.max(0, l - i * 0.03) : Math.min(1, l + i * 0.03);
    best = hslToHex(h, Math.min(1, s), nl);
    if (contrastRatio(best, bg) >= min) return best;
  }
  return best;
}

function isDark(hex: string): boolean {
  const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

/** Apply per-site theme overrides (admin colour/font/shape choices) on top of template tokens. */
export function effectiveTokens(def: TemplateDef, site: SiteData): DesignTokens {
  const th = site.content.theme || {};
  const tokens: DesignTokens = { ...def.tokens };
  if (th.primary && HEX.test(th.primary)) {
    tokens.primary = th.primary.toLowerCase();
    tokens.primaryFg = isDark(tokens.primary) ? "#ffffff" : "#111111";
  }
  if (th.secondary && HEX.test(th.secondary)) {
    tokens.secondary = th.secondary.toLowerCase();
    tokens.secondaryFg = isDark(tokens.secondary) ? "#f8f8f8" : "#111111";
  }
  if (th.accent && HEX.test(th.accent)) {
    tokens.accent = th.accent.toLowerCase();
    tokens.accentFg = isDark(tokens.accent) ? "#ffffff" : "#111111";
  }
  if (th.bg && HEX.test(th.bg)) {
    tokens.bg = th.bg.toLowerCase();
    const dark = isDark(tokens.bg);
    tokens.mode = dark ? "dark" : "light";
    tokens.surface = th.surface && HEX.test(th.surface) ? th.surface.toLowerCase() : mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.04);
    tokens.surface2 = mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.08);
    tokens.border = mix(tokens.bg, dark ? "#ffffff" : "#000000", 0.14);
    if (!(th.text && HEX.test(th.text))) {
      tokens.text = dark ? "#f3f4f6" : "#111827";
      tokens.muted = dark ? "#a3a8b3" : "#5b6472";
    }
  } else if (th.surface && HEX.test(th.surface)) {
    tokens.surface = th.surface.toLowerCase();
  }
  if (th.text && HEX.test(th.text)) {
    tokens.text = th.text.toLowerCase();
    tokens.muted = mix(tokens.text, tokens.bg, 0.4);
  }
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
    "--t-accent-text": readableOn(tokens.accent, tokens.bg),
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
