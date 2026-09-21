"use client";

import { useEffect, useState } from "react";

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

export interface ContrastLabels {
  /** "Readability" */
  title: string;
  /** "{pair} is hard to read ({ratio}:1). Aim for at least 4.5:1." */
  warning: string;
  ok: string;
  pairText: string;
  pairPrimary: string;
  pairAccent: string;
}

export function ContrastCheck({ labels, fallback }: { labels: ContrastLabels; fallback: Record<string, string> }) {
  const [colors, setColors] = useState<Record<string, string>>(fallback);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form");
    if (!form) return;
    const read = () => {
      const next: Record<string, string> = { ...fallback };
      for (const key of ["primary", "accent", "bg", "text"]) {
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

  const bg = HEX.test(colors.bg ?? "") ? colors.bg : fallback.bg;
  const pairs = [
    { label: labels.pairText, value: ratio(colors.text ?? fallback.text, bg), need: 4.5 },
    { label: labels.pairPrimary, value: ratio(colors.primary ?? fallback.primary, bg), need: 4.5 },
    { label: labels.pairAccent, value: ratio(colors.accent ?? fallback.accent, bg), need: 3 },
  ];
  const bad = pairs.filter((p) => p.value < p.need);

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3" aria-live="polite">
      <span className="mb-2 block text-sm font-bold text-slate-800">{labels.title}</span>
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
