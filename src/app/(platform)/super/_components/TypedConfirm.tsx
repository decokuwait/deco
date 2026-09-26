"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A destructive action that has to be typed out, not clicked through.
 *
 * `window.confirm` was the only guard on site deletion, and a confirm dialog is muscle memory: it is
 * dismissed by the same reflex that clicked the button, and Playwright — and every operator by the tenth
 * time — accepts it without reading. Typing the site's own subdomain cannot be done by accident.
 *
 * The disabled button is a courtesy, not the check. The typed value is posted as `confirm` and the Server
 * Action compares it again, because a disabled attribute is one devtools edit away from gone.
 */
export function TypedConfirm({
  expected,
  hint,
  placeholderLabel,
  children,
  pendingText,
  tone = "danger",
}: {
  /** The exact string the operator must type — the site's subdomain, which is on screen right above. */
  expected: string;
  hint: string;
  /** Label for the input, e.g. "Type". The expected value is shown next to it in a code span. */
  placeholderLabel: string;
  children: string;
  pendingText: string;
  /** `neutral` for a reversible action that still deserves deliberation, such as restoring a site. */
  tone?: "danger" | "neutral";
}) {
  const [typed, setTyped] = useState("");
  const id = useId();
  const { pending } = useFormStatus();
  const matches = typed.trim() === expected;
  const danger = tone === "danger";
  return (
    <div className="grid gap-3">
      <label htmlFor={id} className="block text-sm text-slate-700">
        {hint}{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-900" dir="ltr">
          {expected}
        </code>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          aria-label={`${placeholderLabel} ${expected}`}
          className={`block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 sm:max-w-xs ${
            danger ? "focus:border-red-500 focus:ring-red-500/30" : "focus:border-emerald-500 focus:ring-emerald-500/30"
          }`}
        />
        <button
          type="submit"
          disabled={!matches || pending}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {pending ? pendingText : children}
        </button>
      </div>
    </div>
  );
}
