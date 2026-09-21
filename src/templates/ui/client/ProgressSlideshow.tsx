"use client";

import { responsiveSrc } from "../img";
import { useEffect, useState } from "react";
import { usePageVisible, useReducedMotion } from "./motion";

export interface ProgressSlide {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  label: string;
  date?: string | null;
}

/**
 * Step-by-step (day/hour/stage) slideshow for in-progress projects with a step rail, arrows,
 * keyboard support and optional autoplay. Videos pause autoplay while shown.
 */
export function ProgressSlideshow({
  slides,
  stepWord,
  ofWord,
  className = "",
  autoplay = 4000,
  dir = "rtl",
  prevLabel = "Previous",
  nextLabel = "Next",
}: {
  slides: ProgressSlide[];
  stepWord: string;
  ofWord: string;
  className?: string;
  autoplay?: number;
  dir?: "rtl" | "ltr";
  prevLabel?: string;
  nextLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const n = slides.length;
  const cur = slides[i];

  useEffect(() => {
    if (!autoplay || n < 2 || paused || reduced || !visible || cur?.kind === "video") return;
    const id = setTimeout(() => setI((v) => (v + 1) % n), autoplay);
    return () => clearTimeout(id);
  }, [i, n, autoplay, paused, reduced, visible, cur]);

  if (!n) return null;
  const go = (d: number) => setI((v) => ((v + d) % n + n) % n);

  return (
    <div className={`overflow-hidden rounded-card bg-surface ring-1 ring-line ${className}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative aspect-[4/3] bg-black sm:aspect-[16/10]" tabIndex={0} onKeyDown={(e) => (e.key === "ArrowLeft" ? go(dir === "rtl" ? 1 : -1) : e.key === "ArrowRight" ? go(dir === "rtl" ? -1 : 1) : null)}>
        {cur.kind === "video" ? (
          <video key={cur.id} src={cur.url} poster={cur.posterUrl || undefined} controls playsInline className="h-full w-full object-contain" preload="metadata" />
        ) : (
          <img key={cur.id} src={cur.url} {...responsiveSrc(cur.url)} alt={cur.label} loading="lazy" decoding="async" className="h-full w-full object-cover animate-fade-up" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12 text-white">
          <div className="text-xs opacity-80">
            {stepWord} {i + 1} {ofWord} {n}
            {cur.date ? ` · ${cur.date}` : ""}
          </div>
          <div className="font-heading text-lg font-bold sm:text-xl">{cur.label}</div>
        </div>
        <button type="button" onClick={() => go(-1)} aria-label={prevLabel} className="absolute start-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow">
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" onClick={() => go(1)} aria-label={nextLabel} className="absolute end-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow">
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto p-3">
        {slides.map((s, k) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setI(k)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${k === i ? "border-primary bg-primary text-primary-fg" : "border-line bg-bg text-muted hover:text-fg"}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[10px]">{k + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-1 w-full bg-line">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${((i + 1) / n) * 100}%` }} />
      </div>
    </div>
  );
}
