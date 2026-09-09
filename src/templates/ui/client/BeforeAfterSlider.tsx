"use client";

import { useCallback, useRef, useState } from "react";

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

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    setPos((x / r.width) * 100);
  }, []);

  return (
    <div
      ref={ref}
      dir="ltr"
      className={`relative select-none overflow-hidden rounded-card bg-surface-2 ${className}`}
      style={{ aspectRatio: aspect, touchAction: "none" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={beforeLabel} className="absolute inset-0 h-full max-w-none object-cover" style={{ width: ref.current?.clientWidth || "100%" }} draggable={false} />
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
