"use client";

import { useEffect, useRef, useState } from "react";
import { responsiveSrc } from "../img";
import { FOCUS_RING, cx, intrinsic } from "../primitives";
import { usePageVisible, useReducedMotion } from "./motion";

/** What the owner asked for: three seconds a picture. */
const SLIDE_MS = 3000;

/**
 * How long a pointer has to stay down, and how far it may travel, before the press counts as a *hold*.
 *
 * A scroll that begins on the photograph starts with a pointerdown too, so pausing on the down event
 * alone would read every flick down the page as "hold this slide". A hold is therefore a press that
 * stays put: it commits after HOLD_MS, and any travel past SLOP_PX — or a `pointercancel`, which is the
 * browser telling us it has taken the gesture for scrolling — hands the gesture back to the page.
 */
const HOLD_MS = 120;
const SLOP_PX = 10;

/**
 * Everything that has to be true before the pictures may change on their own. Exported so the rules can
 * be asserted without a browser: this is the whole of the WCAG 2.2.2 story in one function.
 */
export function shouldRotate(s: { ready: boolean; stopped: boolean; held: boolean; hovered: boolean; focused: boolean; reduced: boolean; visible: boolean }): boolean {
  if (!s.ready) return false; // slide 0 has not loaded yet, so there is nothing to cross-fade to
  if (s.reduced) return false; // prefers-reduced-motion: the first picture, and it stays
  if (!s.visible) return false; // a background tab does not need an animation
  return !s.stopped && !s.held && !s.hovered && !s.focused;
}

/**
 * The hero photograph when the owner added more than one: a three-second cross-fade through all of them.
 *
 * Three things shape this component.
 *
 * **It must not cost the LCP.** The hero image is the largest paint on every template, so slide 0 is the
 * only one in the server-rendered markup — eager, `fetchPriority="high"`, exactly the markup a
 * single-image hero ships. The rest are mounted only after slide 0 has loaded (`loading="lazy"` would
 * not have held them back: a lazy image that is inside the viewport, even at `opacity: 0`, is fetched
 * immediately). The box is sized by the caller's ratio class, so nothing moves as slides change.
 *
 * **Scrolling belongs to the page.** `touch-action` is left at its default `auto` and nothing here calls
 * `preventDefault` or `setPointerCapture` — unlike `BeforeAfterSlider`, which drags horizontally and has
 * to claim the gesture with `touch-action: pan-y`. A hold pauses; it never swallows a scroll.
 *
 * **It can be stopped.** Movement that starts on its own and runs longer than five seconds needs a
 * pause control (WCAG 2.2.2), so there is a real pause button and a dot per slide, both keyboard
 * reachable with the site's focus ring. Reduced motion, a backgrounded tab, hover, focus and a held
 * finger each stop it as well.
 */
export function HeroRotator({
  images,
  alts,
  sizes,
  ratio,
  imgClassName = "",
  controlsClass = "top-3 end-3",
  galleryLabel,
  slideLabel,
  pauseLabel,
  playLabel,
}: {
  images: string[];
  /** One per image and never "": these photographs are the content of the page (WCAG 1.1.1). */
  alts: string[];
  sizes?: string;
  ratio?: string | null;
  /** The classes the caller would have put on its single `<Img>` (`h-full w-full object-cover`, …). */
  imgClassName?: string;
  /** Where the control cluster sits inside the frame, as logical offsets. */
  controlsClass?: string;
  galleryLabel: string;
  slideLabel: string;
  pauseLabel: string;
  playLabel: string;
}) {
  const [index, setIndex] = useState(0);
  /** Set once slide 0 has loaded: only then are the other slides worth fetching, and the controls real. */
  const [ready, setReady] = useState(false);
  /** A finger or mouse button held on the picture. */
  const [held, setHeld] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** The visitor pressed pause, or picked a slide. Sticky until they press play again. */
  const [stopped, setStopped] = useState(false);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const first = useRef<HTMLImageElement>(null);
  const hold = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);

  useEffect(() => {
    const el = first.current;
    if (!el || el.complete) {
      setReady(true);
      return;
    }
    const done = () => setReady(true);
    el.addEventListener("load", done, { once: true });
    el.addEventListener("error", done, { once: true });
    return () => {
      el.removeEventListener("load", done);
      el.removeEventListener("error", done);
    };
  }, []);

  const running = shouldRotate({ ready, stopped, held, hovered, focused, reduced, visible });

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setIndex((v) => (v + 1) % images.length), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [running, index, images.length]);

  // A pending hold must not outlive the component (or a pointer that never reports an up event).
  useEffect(() => {
    return () => {
      if (hold.current) window.clearTimeout(hold.current.timer);
    };
  }, []);

  function endHold() {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
    setHeld(false);
  }

  return (
    <div
      // Says how many pictures this hero is rotating: a single-image hero never renders this element at
      // all, which is what the render tests assert.
      data-hero-rotator={images.length}
      className="absolute inset-0 select-none"
      // A long press on a photograph opens iOS's save/share callout, which would fight the hold.
      style={{ WebkitTouchCallout: "none" }}
      onPointerDown={(e) => {
        if (hold.current) return; // a second finger is a pinch, not a hold
        const timer = window.setTimeout(() => setHeld(true), HOLD_MS);
        hold.current = { id: e.pointerId, x: e.clientX, y: e.clientY, timer };
      }}
      onPointerMove={(e) => {
        const h = hold.current;
        if (!h || h.id !== e.pointerId) return;
        if (Math.abs(e.clientX - h.x) > SLOP_PX || Math.abs(e.clientY - h.y) > SLOP_PX) endHold();
      }}
      onPointerUp={endHold}
      // The browser fires this the moment it starts panning the page with this pointer.
      onPointerCancel={endHold}
      onPointerEnter={(e) => e.pointerType !== "touch" && setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        endHold();
      }}
      // React's focus events bubble, so these two are `:focus-within` for the whole frame.
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {images.map((src, i) =>
        i === 0 || ready ? (
          <img
            key={src}
            ref={i === 0 ? first : undefined}
            src={src}
            {...responsiveSrc(src, sizes)}
            {...intrinsic(ratio ?? null)}
            alt={alts[i] ?? alts[0]}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            decoding="async"
            draggable={false}
            className={cx("absolute inset-0 transition-opacity", reduced ? "duration-0" : "duration-700", i === index ? "opacity-100" : "opacity-0", imgClassName)}
          />
        ) : null,
      )}
      {ready && (
        // z-20 lifts the controls over the gradient and pattern layers the heroes paint on top of their
        // picture — those are siblings of this frame, so a z-index inside it is the only way past them.
        // It stays well under the nav's z-50.
        <div role="group" aria-label={galleryLabel} className={cx("absolute z-20 flex items-center gap-0.5 rounded-full bg-black/50 p-1 backdrop-blur-sm", controlsClass)}>
          <button
            type="button"
            onClick={() => setStopped((v) => !v)}
            aria-pressed={stopped}
            aria-label={stopped ? playLabel : pauseLabel}
            className={cx("flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20", FOCUS_RING)}
          >
            {stopped ? (
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 rtl:-scale-x-100" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              </svg>
            )}
          </button>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              // Picking a slide is a deliberate choice; rotating away from it two seconds later is not.
              onClick={() => {
                setIndex(i);
                setStopped(true);
              }}
              aria-label={`${slideLabel} ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={cx("flex h-9 w-7 items-center justify-center rounded-full", FOCUS_RING)}
            >
              <span aria-hidden className={cx("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-1.5 bg-white/55")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
