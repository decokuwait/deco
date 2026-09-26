"use client";

import { SIZES, responsiveSrc } from "../img";
import { cx, intrinsic } from "../primitives";
import { RATIO, RATIO_ATTR, focalClass } from "../ratios";
import type { MediaItem } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Draggable before/after comparison. Works with mouse, touch and keyboard.
 *
 * The frame used to be pinned to `dir="ltr"`, which mirrored the story for the people the site is written
 * for: "قبل" sat top-left and "بعد" top-right, with the before photo on the left, so an Arabic reader
 * scanning right to left met the finished room first and the ruined one second — the narrative running
 * backwards on the most persuasive widget in the product. It now mirrors properly: `pos` is measured from
 * the *inline* start, the before layer is clipped from there, and the labels follow with `start`/`end`.
 *
 * The frame is always `RATIO.compare`, with one focal point shared by both halves, and neither is a prop.
 * The handle wipes one photograph across the other in the same box: if the halves were cropped to
 * different shapes, or from different parts of the frame, the wipe would slide the room sideways as it
 * went — the one place in the engine where a ratio is a correctness bug and not a matter of taste.
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  beforeAlt,
  afterAlt,
  hint,
  focal,
  className = "",
  dir = "rtl",
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  /** Describes the photograph, not the chip on top of it — the two pictures are the content here. */
  beforeAlt: string;
  afterAlt: string;
  hint?: string;
  /** One focal point for both halves — see above. */
  focal?: MediaItem["focal"];
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  const rtl = dir === "rtl";
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  /**
   * Width of the frame, in state rather than read from the ref during render.
   *
   * The "before" image is inside a container clipped to `pos%`, so it needs the *full* frame width to
   * line up with the "after" image behind it. Reading `ref.current?.clientWidth` while rendering returned
   * null on the first pass, the image fell back to `width: 100%` of the clip — half the frame — and every
   * comparison shipped horizontally squashed until the visitor happened to drag it. A ResizeObserver also
   * keeps it correct through rotation and window resizing, which the old code never handled at all.
   */
  const [frameWidth, setFrameWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFrameWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const update = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const from = rtl ? r.right - clientX : clientX - r.left;
      const x = Math.min(Math.max(from, 0), r.width);
      setPos((x / r.width) * 100);
    },
    [rtl],
  );

  // touchAction "pan-y", not "none": "none" swallowed every touch, so a visitor who began a scroll on the
  // image could not scroll the page at all. Vertical scrolling stays with the page, horizontal drags come here.
  return (
    <div
      ref={ref}
      dir={dir}
      className={cx("relative w-full select-none overflow-hidden rounded-card bg-surface-2", RATIO.compare, className)}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img src={after} {...responsiveSrc(after, SIZES.half)} {...intrinsic(RATIO_ATTR.compare)} alt={afterAlt} loading="lazy" decoding="async" className={cx("absolute inset-0 h-full w-full object-cover", focalClass(focal))} draggable={false} />
      {/* `inset-0` plus an explicit width over-constrains an absolutely positioned box, and CSS resolves
          that by dropping the *end* offset — so in RTL the clip and the image inside it anchor to the
          right edge, which is exactly the inline start there. No physical offsets needed. */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={before} {...responsiveSrc(before, SIZES.half)} {...intrinsic(RATIO_ATTR.compare)} alt={beforeAlt} loading="lazy" decoding="async" className={cx("absolute inset-0 h-full max-w-none object-cover", focalClass(focal))} style={{ width: frameWidth ?? "100%" }} draggable={false} />
      </div>
      {/* The keyboard affordance was an `opacity-0` range input: a visitor could tab into it and see
          nothing at all move or light up (WCAG 2.4.7). It now sits before the handle so that focusing it
          rings the divider it drives, and shows itself on focus. */}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        className="peer absolute inset-x-0 bottom-0 h-8 w-full cursor-ew-resize opacity-0 focus-visible:opacity-100"
      />
      <div className="pointer-events-none absolute inset-y-0 peer-focus-visible:[&>*]:ring-4 peer-focus-visible:[&>*]:ring-accent" style={{ insetInlineStart: `calc(${pos}% - 1px)` }}>
        <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" />
        <div className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
          </svg>
        </div>
      </div>
      <span className="absolute top-3 start-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{beforeLabel}</span>
      <span className="absolute top-3 end-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{afterLabel}</span>
      {hint && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white">{hint}</span>}
    </div>
  );
}
