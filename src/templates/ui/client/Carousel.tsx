"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePageVisible, useReducedMotion } from "./motion";

/**
 * Horizontal scroll-snap carousel with arrows and dots. Children are the slides.
 * Uses native scrolling so it feels right on mobile (swipe) and works without JS for the first paint.
 */
export function Carousel({
  children,
  className = "",
  itemClassName = "w-[85%] sm:w-[60%] lg:w-[40%]",
  autoplay = 0,
  showDots = true,
  showArrows = true,
  dir = "rtl",
  dotLabelTemplate,
  prevLabel = "previous",
  nextLabel = "next",
}: {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  autoplay?: number;
  showDots?: boolean;
  showArrows?: boolean;
  dir?: "rtl" | "ltr";
  /**
   * Localised label for a dot, with `{n}` and `{total}` placeholders (e.g. "Go to slide {n} of {total}").
   * A string, not a formatter function: this is a client component, and a server component cannot hand a
   * function across the boundary.
   */
  dotLabelTemplate?: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = children.length;
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  function scrollTo(i: number) {
    const el = ref.current;
    if (!el) return;
    const clamped = ((i % count) + count) % count;
    const child = el.children[clamped] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.clientWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    setIndex(clamped);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      let best = 0;
      let bestDist = Infinity;
      const center = el.scrollLeft + el.clientWidth / 2;
      Array.from(el.children).forEach((c, i) => {
        const h = c as HTMLElement;
        const d = Math.abs(h.offsetLeft + h.clientWidth / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setIndex(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!autoplay || count < 2 || reduced || !visible) return;
    const id = setInterval(() => scrollTo(index + 1), autoplay);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, index, count, reduced, visible]);

  const prev = () => scrollTo(index - 1);
  const next = () => scrollTo(index + 1);

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} dir={dir} className="no-scrollbar snap-x-mandatory flex gap-4 overflow-x-auto scroll-smooth px-[7.5%] sm:px-[20%] lg:px-[30%]">
        {children.map((c, i) => (
          <div key={i} className={`snap-item shrink-0 ${itemClassName}`}>
            {c}
          </div>
        ))}
      </div>
      {showArrows && count > 1 && (
        <>
          <button type="button" onClick={prev} aria-label={prevLabel} className="absolute start-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-lg ring-1 ring-line sm:flex">
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button type="button" onClick={next} aria-label={nextLabel} className="absolute end-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-lg ring-1 ring-line sm:flex">
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      )}
      {showDots && count > 1 && (
        // The dot is 8px of paint, but the control has to be big enough to hit: WCAG 2.2 (2.5.8) asks for
        // 24x24 CSS px, and 8x8 dots spaced 8px apart failed both that and its spacing exception. The
        // button is padded out to 28x28 and the visible dot stays the same size inside it.
        <div className="mt-3 flex justify-center">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={dotLabelTemplate ? dotLabelTemplate.replace("{n}", String(i + 1)).replace("{total}", String(count)) : `${i + 1} / ${count}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => scrollTo(i)}
              className="flex h-7 w-7 shrink-0 items-center justify-center"
            >
              <span aria-hidden className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-line"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
