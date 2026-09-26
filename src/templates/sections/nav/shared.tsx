import type { ReactNode } from "react";
import type { RenderCtx } from "../../types";
import { Img, PhoneIcon, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone, sectionHref } from "../shared/helpers";
import { AR_LEADING } from "../../leading";

/**
 * The target the "Home" link scrolls to.
 *
 * `id="top"` used to sit on the sticky `<header>` itself, and a sticky element never leaves the viewport:
 * the browser considered the target already in view, so clicking Home scrolled nowhere — and opening
 * `/#top` directly was worse, because the browser chased a target that moved down with every scroll step
 * and landed 8586px into the page. A zero-height span rendered *before* the bar is a fixed target at y=0
 * that never moves, so the same `/#top` href now means "the very top of the document" for a click, for a
 * cold load and for the back/forward buttons, with no JavaScript involved.
 *
 * It must stay outside the sticky element. Every nav renders it as its first child.
 */
export function TopAnchor() {
  return <span id="top" aria-hidden className="block h-0" />;
}

/**
 * Logo image or a monogram tile plus the brand name, shared by nav variants.
 *
 * `href={null}` renders the lockup as plain content instead of a link — the drawer header uses it, where a
 * link to the top of the page under a menu that covers the page is a dead control.
 */
export function Brand({
  ctx,
  className = "",
  light = false,
  size = "md",
  href = "/#top",
}: {
  ctx: RenderCtx;
  className?: string;
  light?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const b = ctx.site.content.brand;
  const name = ctx.text(b.name);
  const h = size === "lg" ? "h-12 sm:h-14" : size === "sm" ? "h-8 sm:h-9" : "h-10 sm:h-11";
  // min-w-0 lets a long company name wrap (two lines at most) instead of pushing the nav actions off a phone screen.
  const inner = (
    <>
      {b.logoUrl ? (
        <Img src={b.logoUrl} alt={name} ratio={null} className={cx(h, "w-auto shrink-0 object-contain")} eager />
      ) : (
        <span className={cx("flex aspect-square shrink-0 items-center justify-center rounded-card font-heading font-black", h, light ? "bg-white/15 text-white" : "bg-primary text-primary-fg", size === "lg" ? "text-xl" : "text-base")}>
          {Array.from(name)[0] ?? ""}
        </span>
      )}
      <span className={cx("line-clamp-2 font-heading font-extrabold leading-tight", AR_LEADING, size === "lg" ? "text-lg sm:text-2xl" : size === "sm" ? "text-sm sm:text-base" : "text-base sm:text-xl")}>{name}</span>
    </>
  );
  const cls = cx("flex min-w-0 items-center gap-3", className);
  return href ? (
    <a href={sectionHref(ctx, href)} className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * The lockup at the top of the open menu: the brand, and the line the owner wrote to describe the company.
 *
 * The tagline is the one piece of copy a visitor reads before deciding whether to tap WhatsApp, and the
 * drawer is the only place on a phone where there is room for it above the fold.
 */
export function NavDrawerBrand({ ctx, size = "md", children }: { ctx: RenderCtx; size?: "sm" | "md" | "lg"; children?: ReactNode }) {
  const tagline = ctx.text(ctx.site.content.brand.tagline);
  return (
    <div className="min-w-0">
      <Brand ctx={ctx} href={null} size={size} />
      {tagline && <span className={cx("mt-2 block text-xs text-muted", AR_LEADING)}>{tagline}</span>}
      {children}
    </div>
  );
}

/**
 * The call to action at the foot of the mobile menu.
 *
 * WhatsApp is the only conversion this product has — the prefilled message carries the visitor id — and in
 * the drawer it used to be the same 40px-tall `md` button as in the bar, which is under the comfortable tap
 * target, and `NavCentered` passed none at all. It is a large button here, with the phone number as a
 * second, quieter way through for the visitors who would rather call, and the free-visit line underneath
 * because that is the offer that makes a Kuwaiti homeowner tap.
 */
export function NavDrawerCta({ ctx, extra }: { ctx: RenderCtx; extra?: ReactNode }) {
  const c = ctx.site.content;
  // `underline` is a text link with no box: fine for a section CTA, not for the one button the whole menu
  // is built around. Every other button style is a real target and keeps the template's own character.
  const style = ctx.def.tokens.buttonStyle === "underline" ? "solid" : ctx.def.tokens.buttonStyle;
  return (
    <div className="flex flex-col gap-2.5">
      {extra}
      <WhatsAppLink href={ctx.whatsappHref} className={cx(buttonClass(style, "primary", "lg"), "w-full shadow-lg")}>
        <WhatsAppIcon />
        {ctx.ui("whatsapp")}
      </WhatsAppLink>
      {c.contact.phone && (
        <WhatsAppLink href={ctx.telHref} kind="call_click" className={cx("inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-card border border-line bg-bg px-4 text-sm font-bold text-fg transition hover:border-primary/40 hover:bg-surface-2", AR_LEADING)}>
          <PhoneIcon className="h-4 w-4" />
          <span dir="ltr">{formatPhone(c.contact.phone)}</span>
        </WhatsAppLink>
      )}
      <span className={cx("text-center text-xs text-muted", AR_LEADING)}>{ctx.ui("free_visit")}</span>
    </div>
  );
}
