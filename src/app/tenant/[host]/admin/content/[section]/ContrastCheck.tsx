"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live readability check for the theme editor.
 *
 * The engine already pushes derived colours until they read, but a background and a text colour the owner
 * picks by hand can still end up at 1:1 — the site then publishes as an unreadable page with nothing
 * saying so. This watches the colour inputs in the same form and reports the pairs a visitor would
 * struggle with, using the WCAG contrast formula the renderer uses.
 */
function luminance(hex: string): number {
  const parts = hex.slice(1).match(/.{2}/g);
  if (!parts) return 0;
  const [r, g, b] = parts.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Every colour the check reads. `surface` is here because most of the page sits on it, not on `bg`. */
const KEYS = ["primary", "accent", "bg", "surface", "text"] as const;

export interface ContrastLabels {
  /** "Readability" */
  title: string;
  /** "{pair} is hard to read ({ratio}:1). Aim for at least {need}:1." */
  warning: string;
  ok: string;
  fgText: string;
  fgPrimary: string;
  fgAccent: string;
  onBg: string;
  onSurface: string;
}

export function ContrastCheck({ labels, fallback }: { labels: ContrastLabels; fallback: Record<string, string> }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [colors, setColors] = useState<Record<string, string>>(fallback);

  useEffect(() => {
    // `document.querySelector("form")` returned the FIRST form in the document — the logout form in the
    // admin header — so the colour inputs were never found and the listeners were bound to the wrong
    // element. This check has therefore never once reported a real pair. Scope it to its own form.
    const form = anchor.current?.closest("form");
    if (!form) return;
    const read = () => {
      const next: Record<string, string> = { ...fallback };
      for (const key of KEYS) {
        const input = form.querySelector<HTMLInputElement>(`input[type="color"][name="${key}"]`);
        const custom = form.querySelector<HTMLInputElement>(`input[type="checkbox"][name="${key}_custom"]`);
        if (input && custom?.checked && HEX.test(input.value)) next[key] = input.value.toLowerCase();
      }
      setColors(next);
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
    // `fallback` is a plain object rebuilt on each server render; its values are what matter.
  }, [fallback]);

  const pick = (key: string) => (HEX.test(colors[key] ?? "") ? colors[key] : fallback[key]);
  const bg = pick("bg");
  // Every card, FAQ panel and testimonial sits on `surface`, so a readable pair against `bg` alone says
  // nothing about most of the page.
  const surface = pick("surface") || bg;
  const foregrounds = [
    { label: labels.fgText, color: pick("text"), need: 4.5 },
    { label: labels.fgPrimary, color: pick("primary"), need: 4.5 },
    { label: labels.fgAccent, color: pick("accent"), need: 3 },
  ];
  const bases = [
    { label: labels.onBg, color: bg },
    { label: labels.onSurface, color: surface },
  ];
  const pairs = foregrounds.flatMap((fg) =>
    bases
      // A surface identical to the background is the same pair twice; report it once.
      .filter((base, i) => i === 0 || base.color !== bg)
      .map((base) => ({ label: `${fg.label} — ${base.label}`, value: ratio(fg.color, base.color), need: fg.need })),
  );
  const bad = pairs.filter((p) => p.value < p.need);

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3" aria-live="polite">
      <span ref={anchor} className="mb-2 block text-sm font-bold text-slate-800">
        {labels.title}
      </span>
      {bad.length === 0 ? (
        <span className="text-xs font-bold text-emerald-700">{labels.ok}</span>
      ) : (
        <ul className="grid gap-1.5">
          {bad.map((p) => (
            <li key={p.label} className="flex items-start gap-2 text-xs font-bold text-amber-800">
              <span aria-hidden>⚠</span>
              <span>{labels.warning.replace("{pair}", p.label).replace("{ratio}", p.value.toFixed(1)).replace("{need}", String(p.need))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
