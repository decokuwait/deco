import type { RenderCtx } from "../../types";
import { Badge, Btn, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { projectsAnchor } from "../shared/helpers";

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
        <Btn ctx={ctx} href={projectsAnchor(ctx)} variant={light ? "light" : "ghost"} size={size}>
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

export function mainImage(ctx: RenderCtx): string {
  const h = ctx.site.content.hero;
  return h.imageUrl || (h.images || []).find((u) => u && u.trim()) || ctx.site.content.about.imageUrl || "";
}
