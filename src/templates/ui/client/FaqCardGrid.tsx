"use client";

import { useState } from "react";

/**
 * Grid of independently toggleable FAQ cards (several can be open at once).
 * Each card shows a numbered marker, the question, and an animated answer reveal.
 */
export function FaqCardGrid({
  items,
  className = "",
  openFirst = true,
}: {
  items: { id: string; q: string; a: string }[];
  className?: string;
  openFirst?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (openFirst && items[0] ? { [items[0].id]: true } : {}));
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  return (
    <div className={`grid items-start gap-4 sm:grid-cols-2 ${className}`}>
      {items.map((it, i) => {
        const isOpen = !!open[it.id];
        return (
          <div
            key={it.id}
            className={`rounded-card border bg-surface transition-all duration-300 ${
              isOpen ? "border-primary/40 shadow-xl shadow-primary/10" : "border-line hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            }`}
          >
            <button type="button" onClick={() => toggle(it.id)} aria-expanded={isOpen} className="flex w-full items-start gap-4 p-5 text-start">
              <span className="mt-0.5 shrink-0 font-heading text-xs font-black tracking-widest text-accent" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-heading text-base font-bold leading-snug sm:text-lg">{it.q}</span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  isOpen ? "rotate-180 bg-primary text-primary-fg" : "bg-primary/10 text-primary"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 ps-[3.25rem] leading-relaxed text-muted">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
