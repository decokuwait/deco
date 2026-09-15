import type { RenderCtx } from "../../types";
import { Img, cx } from "../../ui/primitives";

/** Logo image or a monogram tile plus the brand name, shared by nav variants. */
export function Brand({ ctx, className = "", light = false, size = "md" }: { ctx: RenderCtx; className?: string; light?: boolean; size?: "sm" | "md" | "lg" }) {
  const b = ctx.site.content.brand;
  const name = ctx.text(b.name);
  const h = size === "lg" ? "h-12 sm:h-14" : size === "sm" ? "h-8 sm:h-9" : "h-10 sm:h-11";
  // min-w-0 lets a long company name wrap (two lines at most) instead of pushing the nav actions off a phone screen.
  return (
    <a href="#top" className={cx("flex min-w-0 items-center gap-3", className)}>
      {b.logoUrl ? (
        <Img src={b.logoUrl} alt={name} className={cx(h, "w-auto shrink-0 object-contain")} eager />
      ) : (
        <span className={cx("flex aspect-square shrink-0 items-center justify-center rounded-card font-heading font-black", h, light ? "bg-white/15 text-white" : "bg-primary text-primary-fg", size === "lg" ? "text-xl" : "text-base")}>
          {name.slice(0, 1)}
        </span>
      )}
      <span className={cx("line-clamp-2 font-heading font-extrabold leading-tight", size === "lg" ? "text-lg sm:text-2xl" : size === "sm" ? "text-sm sm:text-base" : "text-base sm:text-xl")}>{name}</span>
    </a>
  );
}
