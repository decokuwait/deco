"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FOCUS_RING } from "../primitives";
import { usePageVisible, useReducedMotion } from "./motion";

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * One-slide-at-a-time carousel for large quote cards. Native scroll-snap (swipe on mobile), arrows,
 * dots, keyboard support and autoplay that pauses on hover/focus and honours reduced motion.
 */
export function QuoteCarousel({
  children,
  className = "",
  autoplay = 6000,
  dir = "rtl",
  prevLabel = "previous",
  nextLabel = "next",
}: {
  children: ReactNode[];
  className?: string;
  autoplay?: number;
  dir?: "rtl" | "ltr";
  prevLabel?: string;
  nextLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const count = children.length;

  const go = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el || !count) return;
      const next = ((i % count) + count) % count;
      const child = el.children[next] as HTMLElement | undefined;
      if (child) el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
      setIndex(next);
    },
    [count],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let best = 0;
        let bestDist = Infinity;
        Array.from(el.children).forEach((c, i) => {
          const d = Math.abs((c as HTMLElement).offsetLeft - el.scrollLeft);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setIndex(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!autoplay || count < 2 || paused || reduced || !visible) return;
    const id = setTimeout(() => go(index + 1), autoplay);
    return () => clearTimeout(id);
  }, [autoplay, count, paused, index, go, reduced, visible]);

  if (!count) return null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const fwd = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === back) {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={ref}
        dir={dir}
        tabIndex={0}
        onKeyDown={onKey}
        aria-roledescription="carousel"
        className="no-scrollbar snap-x-mandatory flex overflow-x-auto scroll-smooth rounded-card py-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {children.map((c, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-hidden={i !== index} className="snap-item w-full shrink-0 px-1 sm:px-2">
            {c}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={prevLabel}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface text-fg ring-1 ring-line transition hover:bg-primary hover:text-primary-fg ${FOCUS_RING}`}
          >
            <Chevron className={dir === "rtl" ? "" : "rotate-180"} />
          </button>
          {/* 28px hit area around an 8px dot: WCAG 2.2 (2.5.8) wants 24x24, the paint stays small. */}
          <div className="flex items-center">
            {children.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1} / ${count}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className={`group flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-0.5 ${FOCUS_RING}`}
              >
                <span aria-hidden className={`h-2 rounded-full transition-all ${i === index ? "w-7 bg-accent" : "w-2 bg-line group-hover:bg-muted"}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={nextLabel}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface text-fg ring-1 ring-line transition hover:bg-primary hover:text-primary-fg ${FOCUS_RING}`}
          >
            <Chevron className={dir === "rtl" ? "rotate-180" : ""} />
          </button>
        </div>
      )}
    </div>
  );
}
