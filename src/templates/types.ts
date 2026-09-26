import type { Category, LText, Locale, SiteData } from "@/lib/types";
import type { SiteUiKey } from "@/lib/i18n/site";
import type { FontKey } from "./fonts";
import type { PatternKey } from "./decor/patterns";

export type NavVariant = "classic" | "centered" | "split" | "minimal" | "pill" | "transparent" | "boxed";
export type HeroVariant = "split" | "fullscreen" | "centered" | "diagonal" | "cards" | "video" | "editorial" | "gallery" | "arch" | "stacked";
export type ServicesVariant = "grid" | "list" | "bento" | "zigzag" | "iconrow" | "tabs" | "carousel";
export type AboutVariant = "split" | "editorial" | "band" | "cards" | "quote";
export type StatsVariant = "band" | "cards" | "inline" | "circles";
export type ProcessVariant = "steps" | "timeline" | "numbers" | "cards";
export type FinishedVariant = "grid" | "masonry" | "carousel" | "bento" | "filmstrip";
export type BeforeAfterVariant = "slider" | "sidebyside" | "tabs" | "hover";
export type ProgressVariant = "slideshow" | "timeline" | "stepper" | "filmstrip";
export type TestimonialsVariant = "cards" | "carousel" | "quotewall" | "single";
export type FaqVariant = "accordion" | "twocol" | "cards";
export type CtaVariant = "band" | "card" | "split" | "minimal";
export type ContactVariant = "split" | "cards" | "map" | "inline";
export type FooterVariant = "columns" | "minimal" | "centered" | "big";

export type SectionKey =
  | "hero"
  | "about"
  | "services"
  | "stats"
  | "process"
  | "finished"
  | "beforeAfter"
  | "progress"
  | "testimonials"
  | "faq"
  | "cta"
  | "contact";

export const DEFAULT_ORDER: SectionKey[] = [
  "hero",
  "about",
  "services",
  "stats",
  "finished",
  "beforeAfter",
  "progress",
  "process",
  "testimonials",
  "faq",
  "cta",
  "contact",
];

export type Radius = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type ButtonStyle = "solid" | "outline" | "pill" | "square" | "glow" | "underline";
export type Divider = "none" | "wave" | "diagonal" | "curve" | "zigzag" | "arch";

export interface DesignTokens {
  /** Main brand colour and the text colour on it. */
  primary: string;
  primaryFg: string;
  /** Secondary brand colour used for deep backgrounds/bands. */
  secondary: string;
  secondaryFg: string;
  /** Accent for highlights, badges, icons. */
  accent: string;
  accentFg: string;
  /** Page background, card surfaces and an alternate surface for banding. */
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  radius: Radius;
  pattern: PatternKey;
  mode: "light" | "dark";
  buttonStyle: ButtonStyle;
  divider: Divider;
}

export interface TemplateLayout {
  nav: NavVariant;
  hero: HeroVariant;
  services: ServicesVariant;
  about: AboutVariant;
  stats: StatsVariant;
  process: ProcessVariant;
  finished: FinishedVariant;
  beforeAfter: BeforeAfterVariant;
  progress: ProgressVariant;
  testimonials: TestimonialsVariant;
  faq: FaqVariant;
  cta: CtaVariant;
  contact: ContactVariant;
  footer: FooterVariant;
  order?: SectionKey[];
}

export interface TemplateDef {
  /** Three digit code: 1xx gypsum, 2xx aluminum, 3xx partition, 4xx ceramic. */
  code: string;
  category: Category;
  name: LText;
  description: LText;
  tokens: DesignTokens;
  layout: TemplateLayout;
}

/** Everything a section component needs. Sections are pure functions of this context. */
export interface RenderCtx {
  site: SiteData;
  def: TemplateDef;
  locale: Locale;
  dir: "rtl" | "ltr";
  visitorCode: string | null;
  whatsappHref: string;
  telHref: string;
  /** Localised text from an LText with fallback. */
  text: (t: LText | null | undefined, fallback?: string) => string;
  /** UI string for the site chrome (buttons, labels). */
  ui: (key: SiteUiKey) => string;
  /** Whether this render is a template preview (no tracking, demo data). */
  preview: boolean;
  /**
   * Whether this render is the site's own home page, where every section anchor exists on the page.
   *
   * It decides whether a section link is a bare `#about` or a root-relative `/#about`, and that is not
   * cosmetic: a root-relative hash resolves against the *origin*, so from a URL carrying a query — which
   * is every Meta and TikTok ad click, since they all arrive with UTM parameters — `/#about` points at a
   * different document and the browser does a full page reload instead of scrolling. On an inner page
   * (`/projects`, `/services`) the anchor genuinely is elsewhere and the absolute form is required.
   */
  home: boolean;
}

export interface SectionProps {
  ctx: RenderCtx;
}
