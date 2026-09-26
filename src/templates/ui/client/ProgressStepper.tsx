"use client";

import { SIZES, responsiveSrc } from "../img";
import { FOCUS_RING, intrinsic, posterSrc } from "../primitives";
import { useState } from "react";
import type { ProgressSlide } from "./ProgressSlideshow";

/** Horizontal numbered stepper header, big media stage and a thumbnail row. */
export function ProgressStepper({ slides, stepWord, dir = "rtl", className = "" }: { slides: ProgressSlide[]; stepWord: string; dir?: "rtl" | "ltr"; className?: string }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  if (!n) return null;
  const cur = slides[Math.min(i, n - 1)];
  return (
    <div className={className}>
      <ol className="no-scrollbar flex items-start gap-2 overflow-x-auto pb-2" dir={dir}>
        {slides.map((s, k) => {
          const done = k < i;
          const active = k === i;
          return (
            <li key={s.id} className="flex min-w-[96px] flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${k === 0 ? "bg-transparent" : done || active ? "bg-primary" : "bg-line"}`} />
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${stepWord} ${k + 1}: ${s.label}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-heading text-sm font-black transition ${FOCUS_RING} ${
                    active ? "border-primary bg-primary text-primary-fg shadow-lg" : done ? "border-primary bg-primary/15 text-primary-text" : "border-line bg-surface text-muted"
                  }`}
                >
                  {k + 1}
                </button>
                <span className={`h-0.5 flex-1 ${k === n - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-line"}`} />
              </div>
              {/* The caption is not a second control: it duplicated the numbered button above it, giving
                  every step two tab stops and two announcements, and it was only 17px tall. The label is
                  now part of that button's accessible name. */}
              <span aria-hidden className={`mt-2 line-clamp-2 text-[11px] font-bold ${active ? "text-fg" : "text-muted"}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-card bg-black ring-1 ring-line">
        {cur.kind === "video" ? (
          <video key={cur.id} src={posterSrc(cur)} poster={cur.posterUrl || undefined} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <img key={cur.id} src={cur.url} {...responsiveSrc(cur.url, SIZES.half)} {...intrinsic("16/10")} alt={cur.alt} loading="lazy" decoding="async" className="h-full w-full object-cover animate-fade-up" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 text-white">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
            {stepWord} {i + 1}/{n}
          </span>
          {cur.date && <span className="text-xs opacity-90">{cur.date}</span>}
        </div>
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" dir={dir}>
        {slides.map((s, k) => (
          // The thumbnail is the button's whole content, so its alt *is* the button's accessible name —
          // an `alt=""` plus an `aria-label` said the same thing twice and left the picture undescribed
          // anywhere the label is not read out.
          <button key={s.id} type="button" onClick={() => setI(k)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-card ring-2 transition ${FOCUS_RING} ${k === i ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100"}`}>
            <img src={s.kind === "video" ? s.posterUrl || s.url : s.url} {...responsiveSrc(s.kind === "video" ? s.posterUrl || s.url : s.url, SIZES.thumb)} {...intrinsic("3/2")} alt={s.label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            {s.kind === "video" && <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">▶</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
