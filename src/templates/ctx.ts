import type { CSSProperties } from "react";
import type { LText, Locale, SiteData } from "@/lib/types";
import { lt, t as uiT, dirOf, type SiteUiKey } from "@/lib/i18n/site";
import { whatsappLink, telLink } from "@/lib/content/defaults";
import { FONTS, isFontKey, type FontKey } from "./fonts";
import { patternCss } from "./decor/patterns";
import type { DesignTokens, RenderCtx, TemplateDef } from "./types";

const RADIUS: Record<DesignTokens["radius"], string> = {
  none: "0px",
  sm: "6px",
  md: "12px",
  lg: "20px",
  xl: "32px",
  full: "999px",
};

/** Apply per-site theme overrides (admin colour/font choices) on top of template tokens. */
export function effectiveTokens(def: TemplateDef, site: SiteData): DesignTokens {
  const th = site.content.theme || {};
  const tokens: DesignTokens = { ...def.tokens };
  if (th.primary && /^#[0-9a-f]{6}$/i.test(th.primary)) tokens.primary = th.primary;
  if (th.secondary && /^#[0-9a-f]{6}$/i.test(th.secondary)) tokens.secondary = th.secondary;
  if (th.accent && /^#[0-9a-f]{6}$/i.test(th.accent)) tokens.accent = th.accent;
  if (isFontKey(th.headingFont)) tokens.headingFont = th.headingFont;
  if (isFontKey(th.bodyFont)) tokens.bodyFont = th.bodyFont;
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

export function fontKeysOf(tokens: DesignTokens): FontKey[] {
  return [tokens.headingFont, tokens.bodyFont];
}

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
    ui: (key: SiteUiKey) => uiT(locale, key),
    preview: !!input.preview,
  };
}
