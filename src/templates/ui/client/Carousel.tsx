"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
}: {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  autoplay?: number;
  showDots?: boolean;
  showArrows?: boolean;
  dir?: "rtl" | "ltr";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = children.length;

  function scrollTo(i: number) {
    const el = ref.current;
    if (!el) return;
    const clamped = ((i % count) + count) % count;
    const child = el.children[clamped] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.clientWidth) / 2, behavior: "smooth" });
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
    if (!autoplay || count < 2) return;
    const id = setInterval(() => scrollTo(index + 1), autoplay);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, index, count]);

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
          <button type="button" onClick={prev} aria-label="previous" className="absolute start-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-lg ring-1 ring-line sm:flex">
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button type="button" onClick={next} aria-label="next" className="absolute end-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-lg ring-1 ring-line sm:flex">
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      )}
      {showDots && count > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {children.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`slide ${i + 1}`}
              onClick={() => scrollTo(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
