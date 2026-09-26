import type { RenderCtx } from "../../types";
import { Badge, Btn, Img, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { HeroRotator } from "../../ui/client/HeroRotator";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { RATIO_ATTR, type RatioSlot } from "../../ui/ratios";
import { heroAlt, nthAlt, projectsAnchor, sectionHref } from "../shared/helpers";

/** Primary WhatsApp CTA + optional secondary "see our work" button, shared by every hero variant. */
export function HeroCtas({ ctx, light = false, className = "", size = "lg" }: { ctx: RenderCtx; light?: boolean; className?: string; size?: "md" | "lg" }) {
  const h = ctx.site.content.hero;
  return (
    <div className={cx("flex flex-wrap items-center gap-3", className)}>
      <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, light ? "accent" : "primary", size)}>
        <WhatsAppIcon />
        {ctx.text(h.primaryCta) || ctx.ui("whatsapp")}
      </WhatsAppLink>
      {ctx.text(h.secondaryCta) && (
        <Btn ctx={ctx} href={sectionHref(ctx, projectsAnchor(ctx))} variant={light ? "light" : "ghost"} size={size}>
          {ctx.text(h.secondaryCta)}
        </Btn>
      )}
    </div>
  );
}

export function HeroBadge({ ctx, light = false }: { ctx: RenderCtx; light?: boolean }) {
  const b = ctx.text(ctx.site.content.hero.badge);
  if (!b) return null;
  return <Badge tone={light ? "light" : "accent"}>{b}</Badge>;
}

/** Up to `n` hero images: hero.images first, then the main image as a fallback. Never empty when any image exists. */
export function heroImages(ctx: RenderCtx, n = 3): string[] {
  const h = ctx.site.content.hero;
  const list = (h.images || []).filter((u) => u && u.trim());
  const out = [...list];
  if (h.imageUrl && !out.includes(h.imageUrl)) out.push(h.imageUrl);
  while (out.length && out.length < n) out.push(out[out.length % list.length] ?? h.imageUrl ?? "");
  return out.slice(0, n);
}

/**
 * The hero's pictures in the order they should be shown, main image first and duplicates removed.
 *
 * Not `heroImages`: that one pads a collage out to a fixed number of cells by repeating pictures, which
 * is right for a mosaic and wrong for a rotator — it would cross-fade an image into itself. The main
 * image leads so that the LCP candidate stays the file a single-image hero has always rendered.
 */
export function heroSlides(ctx: RenderCtx, max = 5): string[] {
  const h = ctx.site.content;
  const out: string[] = [];
  const add = (u: string | undefined | null) => {
    const s = (u || "").trim();
    if (s && !out.includes(s)) out.push(s);
  };
  add(h.hero.imageUrl);
  for (const u of h.hero.images || []) add(u);
  // Same last resort as `mainImage`: a hero with no picture of its own borrows the about photograph.
  if (!out.length) add(h.about.imageUrl);
  return out.slice(0, max);
}

export function mainImage(ctx: RenderCtx): string {
  return heroSlides(ctx, 1)[0] ?? "";
}

/**
 * The hero photograph, for every variant that shows one picture at a time.
 *
 * Single image: the plain eager `<Img>` those heroes have always rendered — no client component, no
 * timers, no controls. Several: a rotator that cross-fades every three seconds and can be held, paused
 * and stepped through (`HeroRotator`). Heroes used to read `hero.imageUrl` alone, so the pictures an
 * owner added under `hero.images` never appeared at all; every one of them goes through here now.
 *
 * The caller keeps its own frame: this fills it, so the frame must be positioned (`relative` or
 * `absolute`) and carry `RATIO[slot]` — that is what reserves the box and keeps the layout still.
 */
export function HeroPicture({
  ctx,
  slot,
  sizes,
  className = "",
  controlsClass,
  max = 5,
}: {
  ctx: RenderCtx;
  slot: RatioSlot;
  sizes?: string;
  /** Classes for the picture itself, as if it were the caller's own `<Img>`. */
  className?: string;
  controlsClass?: string;
  max?: number;
}) {
  const imgs = heroSlides(ctx, max);
  const alt = heroAlt(ctx);
  const ratio = RATIO_ATTR[slot];
  if (imgs.length < 2) return <Img src={imgs[0]} alt={alt} sizes={sizes} ratio={ratio} className={className} eager />;
  return (
    <HeroRotator
      images={imgs}
      alts={imgs.map((_, i) => nthAlt(ctx, alt, i, imgs.length))}
      sizes={sizes}
      ratio={ratio}
      // `img-ph object-center` is what `Img` puts on a cover picture: the tonal frame that shows while a
      // file is in flight (or never arrives) and the default crop position. The rotator builds its own
      // `<img>` — it needs a per-slide opacity and a ref — so it has to carry them itself.
      imgClassName={cx("img-ph object-center", className)}
      controlsClass={controlsClass}
      galleryLabel={ctx.ui("photo_gallery")}
      slideLabel={ctx.ui("go_to_slide")}
      pauseLabel={ctx.ui("pause_slideshow")}
      playLabel={ctx.ui("play_slideshow")}
    />
  );
}
