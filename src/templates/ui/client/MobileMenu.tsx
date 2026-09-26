"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "./focus-trap";
import { FOCUS_RING, chromeButtonClass, cx } from "../primitives";
import { AR_LEADING } from "../../leading";

/**
 * The shape the open menu takes. One per nav bar, because the drawer is the bar's own full-screen state:
 * a boxed bar should not open a pill sheet, and the ultra-slim bar should not open a bordered drawer.
 * All six share the dialog semantics, the focus trap and the motion below — only the geometry changes.
 */
export type MobileMenuVariant = "drawer" | "framed" | "sheet" | "curtain" | "quiet" | "glass";

/** The closed-state mark. Three identical lines said nothing about the template behind them. */
export type MobileMenuMark = "bars" | "grid" | "pill" | "stack" | "thin" | "dot" | "ring";

const PANEL: Record<MobileMenuVariant, string> = {
  // Side sheet off the end edge, the full height of the screen. The classic and split bars.
  drawer: "absolute inset-y-0 end-0 w-[88%] max-w-[22rem] border-s-2 border-s-accent shadow-2xl",
  // The boxed bar frames itself in a bordered card with an accent base line; so does its menu.
  framed: "absolute inset-3 rounded-card border border-line border-b-4 border-b-accent shadow-2xl",
  // The pill bar floats away from the page edge, and its menu drops as a floating rounded sheet.
  sheet: "absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] max-h-[calc(100dvh-1.5rem)] origin-top rounded-[1.75rem] border border-line shadow-2xl",
  // The centred bar is symmetrical, so its menu is a full-width curtain that drops from the top.
  curtain: "absolute inset-x-0 top-0 max-h-[100dvh] origin-top rounded-b-card border-b-2 border-b-accent shadow-2xl",
  // The minimal bar owns nothing but type; its menu is the whole screen and nothing else.
  quiet: "absolute inset-0",
  // The transparent bar is glass over the hero, and stays glass when it opens.
  glass: "absolute inset-0 backdrop-blur-xl",
};

/** Where each panel starts before it animates in (and where it goes when it leaves). */
const CLOSED: Record<MobileMenuVariant, string> = {
  drawer: "opacity-0 ltr:translate-x-full rtl:-translate-x-full",
  framed: "opacity-0 scale-95",
  sheet: "opacity-0 -translate-y-4 scale-95",
  curtain: "opacity-0 -translate-y-full",
  quiet: "opacity-0",
  glass: "opacity-0 scale-[1.03]",
};

/** Surface of the panel: a wash and the template's own pattern, never a flat white rectangle. */
const SURFACE: Record<MobileMenuVariant, string> = {
  drawer: "bg-bg bg-gradient-to-b from-surface via-bg to-surface",
  framed: "bg-bg bg-gradient-to-b from-surface via-bg to-surface",
  sheet: "bg-bg bg-gradient-to-b from-surface to-bg",
  curtain: "bg-bg bg-gradient-to-b from-surface to-bg",
  quiet: "bg-bg",
  glass: "bg-bg/85",
};

/** Every row is at least 48px tall — a link list is the one place a phone visitor taps without looking. */
const ROW: Record<MobileMenuVariant, string> = {
  drawer: "min-h-14 justify-between gap-3 border-b border-line/70 py-3.5 text-xl",
  framed: "min-h-14 justify-between gap-3 border-b border-line/70 py-3.5 text-xl",
  sheet: "min-h-12 justify-between gap-3 rounded-full px-4 py-3 text-base hover:bg-surface-2",
  curtain: "min-h-14 justify-center border-b border-line/70 py-3.5 text-lg",
  quiet: "min-h-12 justify-start py-2 text-2xl",
  glass: "min-h-14 justify-between gap-3 border-b border-fg/10 py-3.5 text-xl",
};

const LIST: Record<MobileMenuVariant, string> = {
  drawer: "flex-1",
  framed: "flex-1",
  sheet: "",
  curtain: "",
  quiet: "flex-1 justify-center gap-1",
  glass: "flex-1 justify-center",
};

/** A numeral beside each link reads as a printed index; a chevron reads as a control. Neither suits both. */
const INDEXED: MobileMenuVariant[] = ["drawer", "framed"];
const CHEVRON: MobileMenuVariant[] = ["sheet", "glass"];
const PATTERNED: MobileMenuVariant[] = ["drawer", "framed", "sheet", "curtain", "glass"];
/** Panels anchored to the top or bottom edge have to clear the notch and the home indicator themselves. */
const SAFE_TOP: MobileMenuVariant[] = ["drawer", "curtain", "quiet", "glass"];

/** Closed-state marks, drawn per nav so a visitor can tell two templates apart before opening anything. */
function MenuMark({ mark }: { mark: MobileMenuMark }) {
  const common = "h-6 w-6";
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" } as const;
  switch (mark) {
    case "grid":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" aria-hidden>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" className="fill-accent-text" />
          <rect x="4" y="13" width="7" height="7" rx="1" className="fill-accent-text" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      );
    case "pill":
      return (
        <svg viewBox="0 0 24 24" className={common} {...stroke} aria-hidden>
          <path d="M5 8.5h14M5 15.5h14" />
          <circle cx="12" cy="12" r="1.4" className="fill-accent-text stroke-none" />
        </svg>
      );
    case "stack":
      return (
        <svg viewBox="0 0 24 24" className={common} {...stroke} aria-hidden>
          <path d="M7 7h10" className="stroke-accent-text" />
          <path d="M4 12h16M8 17h8" />
        </svg>
      );
    case "thin":
      return (
        <svg viewBox="0 0 24 24" className={common} {...stroke} strokeWidth={1.6} aria-hidden>
          <path d="M4 9h16M4 15h16" />
        </svg>
      );
    case "dot":
      return (
        <svg viewBox="0 0 24 24" className={cx(common, "rtl:-scale-x-100")} {...stroke} aria-hidden>
          <path d="M4 8h16M4 16h16" />
          <circle cx="18.5" cy="12" r="2" className="fill-accent-text stroke-none" />
        </svg>
      );
    case "ring":
      return (
        <svg viewBox="0 0 24 24" className={cx(common, "rtl:-scale-x-100")} {...stroke} aria-hidden>
          <circle cx="12" cy="12" r="9" strokeWidth={1.4} className="stroke-accent-text" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={cx(common, "rtl:-scale-x-100")} {...stroke} aria-hidden>
          <path d="M4 7h16M4 17h16" />
          <path d="M4 12h9" className="stroke-accent-text" />
        </svg>
      );
  }
}

/**
 * The site menu on a phone: trigger, overlay and drawer.
 *
 * It is portalled to the template root — see `show()` — and it keeps the dialog semantics, the focus trap
 * and the scroll lock that a menu covering the page needs. Everything visual is chosen by `variant` and
 * `mark` from the tables above, so each nav bar opens into something that looks like itself.
 */
export function MobileMenu({
  links,
  cta,
  label,
  closeLabel,
  header,
  variant = "drawer",
  mark = "bars",
  className = "",
  buttonClassName = "",
}: {
  links: { href: string; label: string }[];
  cta?: ReactNode;
  label: string;
  closeLabel: string;
  /** Brand lockup (or utility block) shown at the top of the open panel. Not a link: tapping it inside a menu that covers the page has nowhere to go. */
  header?: ReactNode;
  variant?: MobileMenuVariant;
  mark?: MobileMenuMark;
  className?: string;
  buttonClassName?: string;
}) {
  /**
   * Four phases, not one boolean, so the panel can animate *out*. `enter` is the first painted frame with
   * the closed transform still applied; a frame later `open` flips it and the transition runs. On close
   * the panel goes back to the closed transform and is unmounted when the transition has finished, which
   * is also why focus returns to the trigger at the start of `exit` rather than on unmount.
   */
  const [phase, setPhase] = useState<"closed" | "enter" | "open" | "exit">("closed");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const mounted = phase !== "closed";
  const open = phase === "enter" || phase === "open";
  useFocusTrap(panel, open && !!container);

  useEffect(() => {
    if (phase === "enter") {
      const raf = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(raf);
    }
    if (phase === "exit") {
      const t = setTimeout(() => setPhase("closed"), 260);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhase((p) => (p === "closed" ? p : "exit"));
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted]);

  /**
   * Most nav bars carry `backdrop-blur`, and an element with a backdrop-filter becomes the containing block
   * for its fixed-position descendants. Rendered in place, this overlay was therefore measured against the
   * header instead of the viewport: it covered the bar alone, so the panel painted its background across a
   * strip 64px tall and the links below it fell onto the page with nothing behind them. The drawer is moved
   * to the template root, which is outside that containing block but still carries the --t-* design tokens
   * the panel is coloured from (document.body has none of them).
   */
  function show() {
    setContainer((trigger.current?.closest(".tpl") as HTMLElement | null) ?? document.body);
    setPhase("enter");
  }
  function hide() {
    setPhase((p) => (p === "closed" ? p : "exit"));
  }

  const shown = phase === "open";
  /**
   * The last utilities win for the short viewports — an iPhone SE in portrait, and any phone in landscape —
   * where six 56px rows plus the brand and the CTA do not fit and the list would start scrolled. 48px is
   * still above the comfortable tap minimum.
   */
  const rowBase = cx(
    "group relative flex items-center font-heading font-bold transition-colors hover:text-primary-text active:opacity-70",
    "[@media(max-height:660px)]:min-h-12 [@media(max-height:660px)]:py-2.5 [@media(max-height:660px)]:text-lg",
    AR_LEADING,
    FOCUS_RING,
  );
  const drawer = (
    <div
      ref={panel}
      id={dialogId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      inert={phase === "exit"}
      className={cx("fixed inset-0 z-[100]", phase === "exit" && "pointer-events-none")}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={hide}
        className={cx("absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none", shown ? "opacity-100" : "opacity-0")}
      />
      <div
        className={cx(
          "flex flex-col overflow-hidden text-fg transition duration-300 ease-out motion-reduce:transition-none",
          PANEL[variant],
          SURFACE[variant],
          shown ? "translate-x-0 translate-y-0 scale-100 opacity-100" : CLOSED[variant],
        )}
      >
        {PATTERNED.includes(variant) && <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-50" />}
        <div
          className={cx(
            "relative flex min-h-0 flex-1 flex-col px-5",
            SAFE_TOP.includes(variant) ? "pt-[max(1rem,env(safe-area-inset-top))]" : "pt-5",
            !cta && (SAFE_TOP.includes(variant) ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "pb-5"),
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 pb-4">
            <div className="min-w-0">
              {header}
              <span id={titleId} className={cx(header ? "sr-only" : "font-heading text-lg font-bold", AR_LEADING)}>
                {label}
              </span>
            </div>
            <button type="button" onClick={hide} aria-label={closeLabel} className={chromeButtonClass({ round: true, icon: true, slim: true })}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <nav className={cx("flex flex-col overflow-y-auto overscroll-contain py-1", LIST[variant])}>
            {links.map((l, i) => (
              <a key={l.href} href={l.href} onClick={hide} className={cx(rowBase, ROW[variant])}>
                <span className="min-w-0">{l.label}</span>
                {INDEXED.includes(variant) && (
                  <span dir="ltr" className="shrink-0 font-body text-xs font-bold tabular-nums text-accent-text opacity-70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                {CHEVRON.includes(variant) && (
                  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:opacity-80 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </a>
            ))}
          </nav>
        </div>
        {cta && (
          <div
            className={cx(
              "relative shrink-0 border-t border-line/70 bg-surface/70 px-5 pt-4",
              SAFE_TOP.includes(variant) ? "pb-[max(1.25rem,env(safe-area-inset-bottom))]" : "pb-5",
            )}
          >
            {cta}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={className}>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? dialogId : undefined}
        className={buttonClassName || chromeButtonClass({ icon: true })}
      >
        <MenuMark mark={mark} />
      </button>
      {mounted && container && createPortal(drawer, container)}
    </div>
  );
}
