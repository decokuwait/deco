"use client";

import { responsiveSrc } from "../img";
import { useCallback, useEffect, useRef, useState } from "react";

/** Draggable before/after comparison. Works with mouse, touch and keyboard. */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  hint,
  className = "",
  aspect = "4/3",
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  hint?: string;
  className?: string;
  aspect?: string;
}) {
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

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    setPos((x / r.width) * 100);
  }, []);

  // touchAction "pan-y", not "none": "none" swallowed every touch, so a visitor who began a scroll on the
  // image could not scroll the page at all. Vertical scrolling stays with the page, horizontal drags come here.
  return (
    <div
      ref={ref}
      dir="ltr"
      className={`relative select-none overflow-hidden rounded-card bg-surface-2 ${className}`}
      style={{ aspectRatio: aspect, touchAction: "pan-y" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img src={after} {...responsiveSrc(after)} alt={afterLabel} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={before} {...responsiveSrc(before)} alt={beforeLabel} loading="lazy" decoding="async" className="absolute inset-0 h-full max-w-none object-cover" style={{ width: frameWidth ?? "100%" }} draggable={false} />
      </div>
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `calc(${pos}% - 1px)` }}>
        <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" />
        <div className="absolute top-1/2 left-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
          </svg>
        </div>
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{beforeLabel}</span>
      <span className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">{afterLabel}</span>
      {hint && <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white">{hint}</span>}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        className="absolute inset-x-0 bottom-0 h-8 w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
