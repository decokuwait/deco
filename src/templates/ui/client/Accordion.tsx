"use client";

import { useId, useState } from "react";

/**
 * FAQ accordion.
 *
 * Each question is a real heading so the list shows up in a screen reader's heading outline (and in the
 * FAQ structured data the section emits), the button owns `aria-controls`/`aria-expanded` pointing at its
 * own panel, and a closed panel is `hidden` rather than merely collapsed to zero height — otherwise
 * assistive technology reads every answer aloud while the page shows none of them.
 */
export function Accordion({
  items,
  className = "",
  itemClassName = "rounded-card border border-line bg-surface",
  openFirst = true,
  headingLevel = 3,
}: {
  items: { id: string; q: string; a: string }[];
  className?: string;
  itemClassName?: string;
  openFirst?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  const [open, setOpen] = useState<string | null>(openFirst && items[0] ? items[0].id : null);
  const base = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {items.map((it) => {
        const isOpen = open === it.id;
        const panelId = `${base}-${it.id}-panel`;
        const buttonId = `${base}-${it.id}-button`;
        return (
          <div key={it.id} className={itemClassName}>
            <Heading className="m-0">
              <button
                type="button"
                id={buttonId}
                onClick={() => setOpen(isOpen ? null : it.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start font-heading text-base font-bold sm:text-lg"
              >
                <span>{it.q}</span>
                <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text transition-transform ${isOpen ? "rotate-45" : ""}`}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
            </Heading>
            {/* `inert` (not `hidden`) keeps the collapse animation while taking the closed answer out of
                the accessibility tree and out of the tab order. */}
            <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <p id={panelId} aria-labelledby={buttonId} inert={!isOpen} aria-hidden={!isOpen} className="px-5 pb-5 leading-relaxed text-muted">
                  {it.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
