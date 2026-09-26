"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FOCUS_RING } from "../primitives";

/**
 * Tab list following the WAI-ARIA tabs pattern.
 *
 * The roles were already here, but nothing else was: each tab is wired to its panel with
 * `aria-controls`/`aria-labelledby`, only the selected tab is in the tab order (roving tabindex), and
 * Arrow/Home/End move between tabs. Announcing a widget as "tab" and then behaving like a row of buttons
 * is worse than using plain buttons, because a screen-reader user is told to expect arrow keys.
 * Arrow direction follows `dir`, so it matches what the visitor sees in Arabic.
 */
export function Tabs({
  tabs,
  className = "",
  listClassName = "",
  tabClassName = "",
  activeClassName = "bg-primary text-primary-fg",
  inactiveClassName = "bg-surface text-muted hover:text-fg ring-1 ring-line",
  dir = "rtl",
  label,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  className?: string;
  listClassName?: string;
  tabClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  dir?: "rtl" | "ltr";
  /** Accessible name for the tab list (e.g. the section heading). */
  label?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const refs = useRef(new Map<string, HTMLButtonElement | null>());
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!cur) return null;

  const tabId = (id: string) => `${base}-${id}-tab`;
  const panelId = (id: string) => `${base}-${id}-panel`;

  const focusTab = (i: number) => {
    const next = tabs[((i % tabs.length) + tabs.length) % tabs.length];
    setActive(next.id);
    refs.current.get(next.id)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) {
      e.preventDefault();
      focusTab(i + 1);
    } else if (e.key === back) {
      e.preventDefault();
      focusTab(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} aria-orientation="horizontal" className={`no-scrollbar mb-6 flex gap-2 overflow-x-auto ${listClassName}`}>
        {tabs.map((t, i) => {
          const selected = t.id === cur.id;
          return (
            <button
              key={t.id}
              id={tabId(t.id)}
              ref={(el) => {
                refs.current.set(t.id, el);
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => setActive(t.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${FOCUS_RING} ${tabClassName} ${selected ? activeClassName : inactiveClassName}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* The panel is focusable so a keyboard visitor can reach its content after the tab strip. It used
          to carry `outline-none`, which left that focus stop with no indicator at all (WCAG 2.4.7). */}
      <div role="tabpanel" id={panelId(cur.id)} aria-labelledby={tabId(cur.id)} tabIndex={0} className={`animate-fade-up ${FOCUS_RING}`} key={cur.id}>
        {cur.content}
      </div>
    </div>
  );
}
