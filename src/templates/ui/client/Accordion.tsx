"use client";

import { useState } from "react";

export function Accordion({
  items,
  className = "",
  itemClassName = "rounded-card border border-line bg-surface",
  openFirst = true,
}: {
  items: { id: string; q: string; a: string }[];
  className?: string;
  itemClassName?: string;
  openFirst?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(openFirst && items[0] ? items[0].id : null);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className={itemClassName}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : it.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start font-heading text-base font-bold sm:text-lg"
            >
              <span>{it.q}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform ${isOpen ? "rotate-45" : ""}`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-muted leading-relaxed">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
