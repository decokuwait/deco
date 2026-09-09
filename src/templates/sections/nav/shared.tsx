import type { RenderCtx } from "../../types";
import { Img, cx } from "../../ui/primitives";

/** Logo image or a monogram tile plus the brand name, shared by nav variants. */
export function Brand({ ctx, className = "", light = false, size = "md" }: { ctx: RenderCtx; className?: string; light?: boolean; size?: "sm" | "md" | "lg" }) {
  const b = ctx.site.content.brand;
  const name = ctx.text(b.name);
  const h = size === "lg" ? "h-12 sm:h-14" : size === "sm" ? "h-8 sm:h-9" : "h-10 sm:h-11";
  return (
    <a href="#top" className={cx("flex items-center gap-3", className)}>
      {b.logoUrl ? (
        <Img src={b.logoUrl} alt={name} className={cx(h, "w-auto object-contain")} eager />
      ) : (
        <span className={cx("flex aspect-square items-center justify-center rounded-card font-heading font-black", h, light ? "bg-white/15 text-white" : "bg-primary text-primary-fg", size === "lg" ? "text-xl" : "text-base")}>
          {name.slice(0, 1)}
        </span>
      )}
      <span className={cx("font-heading font-extrabold leading-tight", size === "lg" ? "text-xl sm:text-2xl" : size === "sm" ? "text-base" : "text-lg sm:text-xl")}>{name}</span>
    </a>
  );
}
