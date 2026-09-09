"use client";

import { useEffect, useState, type ReactNode } from "react";

export function MobileMenu({
  links,
  cta,
  label,
  closeLabel,
  className = "",
  buttonClassName = "",
  panelClassName = "",
  linkClassName = "",
}: {
  links: { href: string; label: string }[];
  cta?: ReactNode;
  label: string;
  closeLabel: string;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  linkClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-expanded={open}
        className={buttonClassName || "inline-flex h-11 w-11 items-center justify-center rounded-card border border-line"}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <button type="button" aria-label={closeLabel} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={panelClassName || "absolute inset-y-0 end-0 flex w-[85%] max-w-sm flex-col bg-bg p-6 text-fg shadow-2xl animate-fade-up"}>
            <div className="mb-6 flex items-center justify-between">
              <span className="font-heading text-lg font-bold">{label}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={closeLabel} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className={linkClassName || "rounded-card px-3 py-3 text-lg font-semibold hover:bg-surface-2"}>
                  {l.label}
                </a>
              ))}
            </nav>
            {cta && <div className="mt-auto pt-6">{cta}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
