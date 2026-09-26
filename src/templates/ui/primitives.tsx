import { responsiveSrc } from "./img";
import { RATIO, RATIO_ATTR, focalClass, type RatioSlot } from "./ratios";
import type { CSSProperties, ReactNode } from "react";
import type { MediaItem } from "@/lib/types";
import type { ButtonStyle, RenderCtx } from "../types";
import { dividerPath } from "../decor/patterns";
import { AR_LEADING } from "../leading";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Container({ children, className = "", wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cx("mx-auto w-full px-4 sm:px-6 lg:px-8", wide ? "max-w-7xl" : "max-w-6xl", className)}>{children}</div>;
}

export function Section({
  id,
  children,
  className = "",
  tone = "bg",
  pattern = false,
  style,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "bg" | "surface" | "surface2" | "primary" | "secondary" | "accent";
  pattern?: boolean;
  style?: CSSProperties;
}) {
  const tones: Record<string, string> = {
    bg: "bg-bg text-fg",
    surface: "bg-surface text-fg",
    surface2: "bg-surface-2 text-fg",
    primary: "bg-primary text-primary-fg",
    secondary: "bg-secondary text-secondary-fg",
    accent: "bg-accent text-accent-fg",
  };
  return (
    <section id={id} className={cx("relative py-16 sm:py-20 lg:py-24", tones[tone], tone === "secondary" && "tone-dark", tone === "primary" && "tone-primary", className)} style={style}>
      {pattern && <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-60" />}
      <div className="relative">{children}</div>
    </section>
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = "center",
  eyebrow,
  className = "",
  light = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  align?: "center" | "start";
  className?: string;
  light?: boolean;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className={cx("mb-10 sm:mb-14", align === "center" ? "text-center mx-auto max-w-2xl" : "text-start max-w-2xl", className)}>
      {eyebrow && (
        <span className={cx("mb-3 inline-block text-xs font-bold uppercase tracking-widest", light ? "text-accent-text" : "text-primary-text")}>{eyebrow}</span>
      )}
      <h2 className={cx("font-heading text-3xl font-extrabold leading-tight sm:text-4xl", AR_LEADING)}>{title}</h2>
      {subtitle && <p className={cx("mt-3 text-base sm:text-lg", light ? "opacity-85" : "text-muted")}>{subtitle}</p>}
    </div>
  );
}

/**
 * The site's focus indicator, on every shared control class below.
 *
 * Nothing here designed one, so a keyboard visitor was left with whatever the browser drew on top of a
 * branded surface — and with nothing at all where a component had switched the outline off. One token,
 * in the accent's text-legible variant (which the `tone-*` bands re-point for themselves), keeps the
 * indicator visible on every background the templates use. WCAG 2.4.7.
 */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text";

export function buttonClass(style: ButtonStyle, variant: "primary" | "accent" | "ghost" | "light" = "primary", size: "md" | "lg" = "md") {
  const base = cx("inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 select-none whitespace-nowrap", FOCUS_RING);
  // `md` measured 40px tall — under the 44px tap minimum, and it is the size the WhatsApp and call buttons
  // use, i.e. the conversion actions on a phone-first site. The floor is set here rather than at each call
  // site, which is where it kept being forgotten.
  const sizes = size === "lg" ? "min-h-12 px-7 py-3.5 text-base sm:text-lg" : "min-h-11 px-5 py-2.5 text-sm sm:text-base";
  const shape =
    style === "pill"
      ? "rounded-full"
      : style === "square"
        ? "rounded-none"
        : style === "underline"
          ? "rounded-none border-b-2 px-1"
          : "rounded-card";
  const palette: Record<string, string> = {
    primary:
      style === "outline"
        ? "border-2 border-primary text-primary-text hover:bg-primary hover:text-primary-fg"
        : style === "underline"
          ? "border-primary text-primary-text hover:text-accent hover:border-accent"
          : style === "glow"
            ? "bg-primary text-primary-fg shadow-[0_10px_30px_-10px_var(--t-primary)] hover:shadow-[0_14px_40px_-10px_var(--t-primary)] hover:-translate-y-0.5"
            : "bg-primary text-primary-fg hover:opacity-90 hover:-translate-y-0.5",
    accent:
      style === "outline"
        ? "border-2 border-accent text-accent hover:bg-accent hover:text-accent-fg"
        : style === "underline"
          ? "border-accent text-accent-text hover:opacity-80"
          : style === "glow"
            ? "bg-accent text-accent-fg shadow-[0_10px_30px_-10px_var(--t-accent)] hover:-translate-y-0.5"
            : "bg-accent text-accent-fg hover:opacity-90 hover:-translate-y-0.5",
    ghost: "border border-line text-fg hover:bg-surface-2",
    light: "bg-white/15 text-white backdrop-blur border border-white/30 hover:bg-white/25",
  };
  return cx(base, sizes, shape, palette[variant]);
}

/**
 * Where sticky and fixed site chrome comes to rest. Zero on a real site. A template preview puts the
 * platform's own toolbar across the top of the viewport and sets --dk-chrome-top, so the site's nav rests
 * below it instead of sliding underneath, where only the bottom edge of its buttons stayed visible.
 */
export const CHROME_TOP = "top-[var(--dk-chrome-top,0px)]";

/** The same offset for a nav that floats a little below the top edge (the pill bar). */
export const CHROME_TOP_FLOAT = "top-[calc(var(--dk-chrome-top,0px)+0.75rem)] sm:top-[calc(var(--dk-chrome-top,0px)+1rem)]";

/**
 * Tap target for the icon-only and short-label controls in the site chrome: the menu button and the
 * language switch. They sit on patterned pages, on near-white surfaces and over photographs, where a
 * hairline outline on its own disappears, so they carry the template's alternate surface as a fill plus
 * a hairline border and a soft shadow. Shape follows each nav's own language (card or round).
 *
 * The box is always 44px tall. `slim` used to drop it to 40px for tighter nav bars, which put the menu
 * button and the language switch — the two controls on every page of every template — under the minimum
 * comfortable tap target on a phone. It now trims the horizontal padding only.
 */
export function chromeButtonClass({ round = false, icon = false, slim = false }: { round?: boolean; icon?: boolean; slim?: boolean } = {}) {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 border border-line bg-surface-2 text-fg shadow-sm transition",
    "hover:border-primary/40 hover:bg-surface hover:shadow active:scale-95",
    FOCUS_RING,
    round ? "rounded-full" : "rounded-card",
    icon ? "h-11 w-11" : cx("h-11 text-xs font-bold", slim ? "px-3" : "px-3.5"),
  );
}

export function Btn({
  ctx,
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  target,
}: {
  ctx: RenderCtx;
  href: string;
  children: ReactNode;
  variant?: "primary" | "accent" | "ghost" | "light";
  size?: "md" | "lg";
  className?: string;
  target?: string;
}) {
  return (
    <a href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} className={cx(buttonClass(ctx.def.tokens.buttonStyle, variant, size), className)}>
      {children}
    </a>
  );
}

/**
 * Intrinsic size for a remote picture whose real dimensions are not known at render time. Only the
 * *ratio* matters: it reserves a box of the right shape before the file arrives, so a section that
 * forgets to wrap its image in an `aspect-[…]` container no longer shifts the page when the image loads.
 * Every call site that does size the image in CSS (`h-full w-full`, an `aspect-*` parent) overrides it,
 * which is why it is safe to default. `ratio={null}` is for a picture whose own proportions decide its
 * width — a logo set with `h-10 w-auto` — where claiming a ratio it does not have sets that width wrong.
 */
export function intrinsic(ratio: string | null): { width?: number; height?: number } {
  if (!ratio) return {};
  const [w, h] = ratio.split("/").map(Number);
  if (!w || !h) return {};
  return { width: 1600, height: Math.round((1600 * h) / w) };
}

export type ImgFit = "cover" | "contain";

/** The named ratio slots a caller may ask for — see `src/templates/ui/ratios.ts`. */
export type { RatioSlot };

/**
 * The box a picture reserves, the fit that fills it and the point that survives the crop — resolved
 * together, from one word.
 *
 * These used to be three independent decisions spread across a call site: an `aspect-[4/3]` class on the
 * wrapper, a `ratio="16/9"` string on the image, and an `object-cover` somewhere in a `className`. Nothing
 * made them agree, and each way of disagreeing has its own failure:
 *
 * - box 4/3 + reserved ratio 16/9 — the browser reserves one shape and CSS draws another: a jump on load.
 * - a reserved ratio and no `object-*` — `object-fit` defaults to **`fill`**, so the photo is *stretched*
 *   into the box. That was reachable straight from the old default (`ratio = "4/3"` and no fit class), and
 *   it is the distortion an owner saw on any slot whose caller forgot `object-cover`.
 * - `object-cover` and no `object-position` — the centre survives, which is the wrong part of the two
 *   commonest decor shots: a ceiling (subject at the top) and a floor (at the bottom).
 *
 * Naming a slot resolves all of it from `RATIO`, `RATIO_ATTR` and `focalClass`, so they cannot disagree.
 *
 * `shaped` says whether this picture has a declared shape at all. Only a shaped, cropping picture takes
 * the placeholder background: a `contain` fit letterboxes, and the bars would show the placeholder
 * through, while `ratio={null}` is usually a transparent logo whose background must stay transparent.
 *
 * Exported for the handful of places that cannot use `Img` because they need a ref or a per-element class
 * on the `<img>` itself — the hero rotator, the before/after slider, the progress steppers. They get the
 * same box, fit and crop point from the same one word instead of copying the class string and drifting.
 */
export function imgFrame(o: { slot?: RatioSlot; fill?: boolean; ratio?: string | null; focal?: MediaItem["focal"]; fit?: ImgFit }): { box: string; attrs: { width?: number; height?: number }; shaped: boolean } {
  return frame({ ...o, fit: o.fit ?? "cover" });
}

function frame(o: { slot?: RatioSlot; fill?: boolean; ratio?: string | null; focal?: MediaItem["focal"]; fit: ImgFit }): { box: string; attrs: { width?: number; height?: number }; shaped: boolean } {
  const fit = o.fit === "contain" ? "object-contain" : "object-cover";
  const where = focalClass(o.focal);
  // A full-bleed picture takes its height from the section around it (`RATIO.heroFull` is deliberately
  // empty), so there is no ratio to reserve — only a box to fill.
  if (o.fill || o.slot === "heroFull") return { box: cx("h-full w-full", fit, where), attrs: {}, shaped: true };
  if (o.slot) return { box: cx(RATIO[o.slot], "w-full", fit, where), attrs: intrinsic(RATIO_ATTR[o.slot]), shaped: true };
  // No slot: the legacy raw-ratio path, for the few call sites whose shape is genuinely their own.
  const ratio = o.ratio === undefined ? "4/3" : o.ratio;
  if (ratio === null) return { box: "", attrs: {}, shaped: false };
  return { box: cx(fit, where), attrs: intrinsic(ratio), shaped: true };
}

export interface ImgProps {
  src?: string | null;
  /**
   * Required, and `""` is not a description: an empty alt declares a picture decorative, and on a
   * decoration portfolio the photographs *are* the content (WCAG 1.1.1 Level A). Callers derive it from
   * the authored `MediaItem.alt`, the caption, or the project title and location — see `mediaAlt`.
   */
  alt: string;
  /** Names the shape this picture is for. Supplies the responsive box, the `width`/`height` and the fit. */
  slot?: RatioSlot;
  /** The ancestor owns the box (a full-bleed hero, an `absolute inset-0` backdrop). No ratio is reserved. */
  fill?: boolean;
  /** Which part of the photograph must survive the crop, as the owner authored it. */
  focal?: MediaItem["focal"];
  /** `cover` crops to fill, `contain` fits inside. Only a logo or a diagram wants `contain`. */
  fit?: ImgFit;
  className?: string;
  eager?: boolean;
  sizes?: string;
  /**
   * Escape hatch. A raw `"w/h"` string for a one-off shape, or `null` for a picture whose own proportions
   * decide its size — a logo set with `h-10 w-auto`, where claiming a ratio it does not have sets that
   * width wrong. `null` also opts out of the fit class and the placeholder, so the six logo call sites
   * keep their own `object-contain` and a transparent PNG keeps its transparency. Prefer `slot`.
   */
  ratio?: string | null;
  style?: CSSProperties;
}

export function Img({ src, alt, slot, fill, focal, fit = "cover", className = "", eager = false, sizes, ratio, style }: ImgProps) {
  const f = frame({ slot, fill, ratio, focal, fit });
  // No picture yet. On a brand-new tenant that is most of the site, so an empty slot gets the same
  // deliberate tonal frame a loading picture shows, rather than a bare grey block that reads as breakage.
  if (!src) return <div className={cx("img-ph img-ph-empty", f.box, className)} style={style} aria-hidden />;
  // Eager images are the LCP candidates (hero, first cards): tell the browser to fetch them first.
  return (
    <img
      src={src}
      {...responsiveSrc(src, sizes)}
      {...f.attrs}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      // The placeholder doubles as the image's own background, which is the only way a server-rendered
      // <img> can degrade without JavaScript: a 404 or a slow file shows the tonal frame instead of the
      // browser's broken-image glyph, and a picture that does arrive covers the background completely.
      className={cx(f.box, f.shaped && fit === "cover" && "img-ph", className)}
      style={style}
    />
  );
}

/**
 * A `<video preload="metadata">` with no poster paints a black rectangle until it is played — in the
 * template gallery a prospect is looking at, that is what a whole progress section looks like. The media
 * fragment asks the browser to seek to the first frame while it loads the metadata it was going to load
 * anyway, so the frame itself becomes the poster.
 */
export function posterSrc(item: Pick<MediaItem, "url" | "posterUrl">): string {
  if (!item.url || item.posterUrl || item.url.includes("#")) return item.url;
  return `${item.url}#t=0.1`;
}

export function Video({ item, className = "", autoPlay = false, controls = true }: { item: Pick<MediaItem, "url" | "posterUrl">; className?: string; autoPlay?: boolean; controls?: boolean }) {
  return (
    <video
      src={posterSrc(item)}
      poster={item.posterUrl || undefined}
      className={className}
      controls={controls}
      playsInline
      muted={autoPlay}
      autoPlay={autoPlay}
      loop={autoPlay}
      preload="metadata"
    />
  );
}

/**
 * Any media item, image or video. `alt` is required and reaches the image: this component had no alt prop
 * at all, so every gallery picture that routed through it shipped `alt=""`.
 *
 * `focal` comes off the item by default, which is the whole point of the admin focal picker: a section
 * that hands `Media` an item gets the owner's framing without having to know the field exists. A caller
 * can still override it — a thumbnail rail that wants the centre of every frame, say.
 *
 * The video branch takes the same box as the image branch. That matters for `slot="compare"`: the
 * before/after slider shows any mismatch between its two halves as a jump at the handle.
 */
export function Media({
  item,
  alt,
  slot,
  fill,
  focal,
  fit = "cover",
  className = "",
  autoPlay = false,
  sizes,
  ratio,
}: {
  item: MediaItem;
  alt: string;
  slot?: RatioSlot;
  fill?: boolean;
  focal?: MediaItem["focal"];
  fit?: ImgFit;
  className?: string;
  autoPlay?: boolean;
  sizes?: string;
  ratio?: string | null;
}) {
  const where = focal === undefined ? item.focal : focal;
  if (item.kind === "video") {
    const f = frame({ slot, fill, ratio, focal: where, fit });
    return <Video item={item} className={cx(f.box, className)} autoPlay={autoPlay} />;
  }
  return <Img src={item.url} alt={alt} slot={slot} fill={fill} focal={where} fit={fit} className={className} sizes={sizes} ratio={ratio} />;
}

export function Divider({ ctx, from = "bg", flip = false }: { ctx: RenderCtx; from?: "bg" | "surface" | "surface2" | "primary" | "secondary"; flip?: boolean }) {
  const kind = ctx.def.tokens.divider;
  if (kind === "none") return null;
  const fills: Record<string, string> = {
    bg: "var(--t-bg)",
    surface: "var(--t-surface)",
    surface2: "var(--t-surface-2)",
    primary: "var(--t-primary)",
    secondary: "var(--t-secondary)",
  };
  return (
    <svg aria-hidden viewBox="0 0 1440 80" preserveAspectRatio="none" className={cx("block h-10 w-full sm:h-16", flip && "rotate-180")}>
      <path d={dividerPath(kind)} fill={fills[from]} />
    </svg>
  );
}

export function Badge({ children, tone = "accent", className = "" }: { children: ReactNode; tone?: "accent" | "primary" | "light"; className?: string }) {
  const tones = {
    accent: "bg-accent/15 text-accent-text border-accent/30",
    primary: "bg-primary/10 text-primary-text border-primary/20",
    light: "bg-white/15 text-white border-white/30 backdrop-blur",
  };
  return <span className={cx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold sm:text-sm", tones[tone], className)}>{children}</span>;
}

export function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="flex gap-0.5 text-accent" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={cx("h-4 w-4", i < n ? "fill-current" : "fill-current opacity-25")}>
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </div>
  );
}

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2 .6 2.5.6a2.6 2.6 0 0 0 1.8-1.3c.2-.6.2-1.1.2-1.2l-.5-.2z" />
    </svg>
  );
}

export function PhoneIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function Arrow({ className = "h-5 w-5", dir = "rtl" }: { className?: string; dir?: "rtl" | "ltr" }) {
  return (
    <svg viewBox="0 0 24 24" className={cx(className, dir === "rtl" && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function socialLinks(ctx: RenderCtx): { key: string; url: string; label: string }[] {
  const s = ctx.site.content.socials || {};
  const out: { key: string; url: string; label: string }[] = [];
  const add = (key: string, url: string | undefined, label: string) => {
    if (url && url.trim()) out.push({ key, url: url.trim(), label });
  };
  add("instagram", s.instagram, "Instagram");
  add("tiktok", s.tiktok, "TikTok");
  add("snapchat", s.snapchat, "Snapchat");
  add("facebook", s.facebook, "Facebook");
  add("x", s.x, "X");
  add("youtube", s.youtube, "YouTube");
  return out;
}

export function SocialIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  switch (name) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M16.5 3c.3 2.3 1.7 3.8 4 4v3.2c-1.5 0-2.9-.5-4-1.3v6.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.3a2.4 2.4 0 1 0 1.6 2.2V3h3.1z" />
        </svg>
      );
    case "snapchat":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M12 2.5c3.2 0 5.3 2.4 5.3 5.4v2.3c.4.2 1 .1 1.5-.1.5-.2 1 .1 1 .5 0 .6-1 .9-1.7 1.2-.4.2-.6.4-.5.7.4 1.3 1.8 2.8 3.4 3.2.3.1.4.4.2.7-.4.6-1.5.8-2.5 1-.2.4-.2 1-.5 1.2-.4.2-1.2-.1-2-.1-.9 0-1.6 1.5-4.2 1.5s-3.3-1.5-4.2-1.5c-.8 0-1.6.3-2 .1-.3-.2-.3-.8-.5-1.2-1-.2-2.1-.4-2.5-1-.2-.3-.1-.6.2-.7 1.6-.4 3-1.9 3.4-3.2.1-.3-.1-.5-.5-.7C4.9 11.5 4 11.2 4 10.6c0-.4.5-.7 1-.5.5.2 1.1.3 1.5.1V7.9c0-3 2.3-5.4 5.5-5.4z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.5L4.5 21h-3l7.5-8.6L1.2 3h6.5l4.5 6z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8zM9.8 15.1V8.9l5.7 3.1-5.7 3.1z" />
        </svg>
      );
    default:
      return null;
  }
}
