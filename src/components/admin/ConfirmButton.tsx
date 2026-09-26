"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmDialogLabels } from "./ConfirmDialog";

/** Fallback wording when a caller has no dictionary of its own; the panel language comes from the shell. */
const FALLBACK: Record<"ar" | "en", ConfirmDialogLabels> = {
  ar: { title: "تأكيد", confirm: "تأكيد", cancel: "إلغاء" },
  en: { title: "Confirm", confirm: "Confirm", cancel: "Cancel" },
};

/**
 * Submit button that asks for confirmation first (used for deletes). Can carry a name/value like a normal
 * submit, and the click is replayed through `requestSubmit(button)` so the server action, the button's
 * name/value and `formNoValidate` all behave exactly as a direct click would.
 *
 * The question is asked by an in-product dialog, not `window.confirm`: see ConfirmDialog.
 */
export function ConfirmButton({
  children,
  message,
  className = "",
  formAction,
  variant = "danger",
  name,
  value,
  labels,
  detail,
  requireText,
  requireHint,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  variant?: "danger" | "ghost";
  name?: string;
  value?: string;
  /** Dialog chrome in the caller's own language; omitted falls back to the panel's `lang`. */
  labels?: ConfirmDialogLabels;
  /** The name of the thing being deleted, shown under the question. */
  detail?: string;
  /** Require this exact text to be typed before confirming (site-level destructive actions). */
  requireText?: string;
  requireHint?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState(false);
  // Read once the button is in the document, never during render: the panel's language lives on the
  // shell wrapper and is only a fallback for callers that carry no dictionary of their own.
  const [fallback, setFallback] = useState<ConfirmDialogLabels>(FALLBACK.ar);
  const v = variant === "danger" ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

  useEffect(() => {
    if (labels) return;
    const lang = ref.current?.closest("[lang]")?.getAttribute("lang");
    setFallback(FALLBACK[lang === "en" ? "en" : "ar"]);
  }, [labels]);

  function submit() {
    setAsking(false);
    const button = ref.current;
    const form = button?.form;
    if (!button || !form) return;
    try {
      form.requestSubmit(button);
    } catch {
      // Older Safari has no `submitter` argument, and dropping it would send `op=delete:3` as a plain
      // save. Carry the button's name/value in a hidden field instead.
      if (name) {
        const carry = document.createElement("input");
        carry.type = "hidden";
        carry.name = name;
        carry.value = value ?? "";
        form.appendChild(carry);
      }
      form.requestSubmit();
    }
  }

  return (
    <>
      <button
        ref={ref}
        // Stays a real submit button: `requestSubmit(submitter)` refuses anything else, and that is what
        // replays the click once the dialog says yes — with the formAction and name/value intact.
        type="submit"
        formAction={formAction}
        formNoValidate
        name={name}
        value={value}
        onClick={(e) => {
          e.preventDefault();
          setAsking(true);
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${v} ${className}`}
      >
        {children}
      </button>
      <ConfirmDialog
        open={asking}
        labels={labels ?? fallback}
        message={message}
        detail={detail}
        requireText={requireText}
        requireHint={requireHint}
        onConfirm={submit}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
