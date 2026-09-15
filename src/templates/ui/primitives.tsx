import { responsiveSrc } from "./img";
import type { CSSProperties, ReactNode } from "react";
import type { MediaItem } from "@/lib/types";
import type { ButtonStyle, RenderCtx } from "../types";
import { dividerPath } from "../decor/patterns";

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
        <span className={cx("mb-3 inline-block text-xs font-bold uppercase tracking-widest", light ? "text-accent-text" : "text-primary")}>{eyebrow}</span>
      )}
      <h2 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className={cx("mt-3 text-base sm:text-lg", light ? "opacity-85" : "text-muted")}>{subtitle}</p>}
    </div>
  );
}

export function buttonClass(style: ButtonStyle, variant: "primary" | "accent" | "ghost" | "light" = "primary", size: "md" | "lg" = "md") {
  const base = "inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 select-none whitespace-nowrap";
  const sizes = size === "lg" ? "px-7 py-3.5 text-base sm:text-lg" : "px-5 py-2.5 text-sm sm:text-base";
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
        ? "border-2 border-primary text-primary hover:bg-primary hover:text-primary-fg"
        : style === "underline"
          ? "border-primary text-primary hover:text-accent hover:border-accent"
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

export function Img({ src, alt = "", className = "", eager = false, sizes, style }: { src?: string | null; alt?: string; className?: string; eager?: boolean; sizes?: string; style?: CSSProperties }) {
  if (!src) return <div className={cx("bg-surface-2", className)} style={style} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  // Eager images are the LCP candidates (hero, first cards): tell the browser to fetch them first.
  return <img src={src} {...responsiveSrc(src, sizes)} alt={alt} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" className={className} style={style} />;
}

export function Video({ item, className = "", autoPlay = false, controls = true }: { item: Pick<MediaItem, "url" | "posterUrl">; className?: string; autoPlay?: boolean; controls?: boolean }) {
  return (
    <video
      src={item.url}
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

export function Media({ item, className = "", autoPlay = false }: { item: MediaItem; className?: string; autoPlay?: boolean }) {
  if (item.kind === "video") return <Video item={item} className={className} autoPlay={autoPlay} />;
  return <Img src={item.url} alt="" className={className} />;
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
    primary: "bg-primary/10 text-primary border-primary/20",
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

/** Visitor code chip rendered on the site when enabled in settings. */
export function VisitorChip({ ctx, className = "" }: { ctx: RenderCtx; className?: string }) {
  if (!ctx.site.content.settings.showVisitorId || !ctx.visitorCode) return null;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted", className)} dir="ltr">
      <span className="opacity-70">{ctx.ui("visitor_id")}:</span>
      <span className="font-mono text-fg">{ctx.visitorCode}</span>
    </span>
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
