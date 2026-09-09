"use client";

import { useState, type ReactNode } from "react";

export function Tabs({
  tabs,
  className = "",
  listClassName = "",
  tabClassName = "",
  activeClassName = "bg-primary text-primary-fg",
  inactiveClassName = "bg-surface text-muted hover:text-fg ring-1 ring-line",
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  className?: string;
  listClassName?: string;
  tabClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!cur) return null;
  return (
    <div className={className}>
      <div role="tablist" className={`no-scrollbar mb-6 flex gap-2 overflow-x-auto ${listClassName}`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === cur.id}
            onClick={() => setActive(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${tabClassName} ${t.id === cur.id ? activeClassName : inactiveClassName}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="animate-fade-up" key={cur.id}>
        {cur.content}
      </div>
    </div>
  );
}
