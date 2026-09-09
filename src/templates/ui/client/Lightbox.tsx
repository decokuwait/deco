"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface LightboxItem {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  caption?: string;
}

/**
 * Gallery viewer. Wrap a thumbnail grid: pass the same items and the child renders the grid; each
 * thumbnail should call `open(index)` through the render function.
 */
export function Gallery({
  items,
  closeLabel,
  children,
}: {
  items: LightboxItem[];
  closeLabel: string;
  children: (open: (i: number) => void) => ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const n = items.length;

  useEffect(() => {
    if (index === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") setIndex((v) => (v === null ? v : (v + 1) % n));
      if (e.key === "ArrowLeft") setIndex((v) => (v === null ? v : (v - 1 + n) % n));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, n]);

  const cur = index === null ? null : items[index];
  return (
    <>
      {children((i) => setIndex(i))}
      {cur && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-3 sm:p-8" dir="ltr" onClick={() => setIndex(null)}>
          <button type="button" aria-label={closeLabel} onClick={() => setIndex(null)} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {n > 1 && (
            <>
              <button type="button" aria-label="previous" onClick={(e) => { e.stopPropagation(); setIndex((v) => (v === null ? v : (v - 1 + n) % n)); }} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <button type="button" aria-label="next" onClick={(e) => { e.stopPropagation(); setIndex((v) => (v === null ? v : (v + 1) % n)); }} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </>
          )}
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {cur.kind === "video" ? (
              <video src={cur.url} poster={cur.posterUrl || undefined} controls autoPlay playsInline className="max-h-[80vh] w-auto max-w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.url} alt={cur.caption || ""} className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain" />
            )}
            {cur.caption && <figcaption className="mt-3 text-center text-sm text-white/80">{cur.caption}</figcaption>}
            <div className="mt-2 text-center text-xs text-white/60">
              {index! + 1} / {n}
            </div>
          </figure>
        </div>
      )}
    </>
  );
}

export function PlayBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
        <svg viewBox="0 0 24 24" className="ms-1 h-6 w-6" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}
