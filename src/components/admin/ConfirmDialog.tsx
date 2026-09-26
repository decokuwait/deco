"use client";

import { useEffect, useRef, useState } from "react";

export interface ConfirmDialogLabels {
  title: string;
  confirm: string;
  cancel: string;
}

/**
 * In-product confirmation, in place of `window.confirm`.
 *
 * `confirm()` draws the browser's own dialog: it leads with the raw hostname, its buttons are in the
 * browser's language (an Arabic panel asking "OK / Cancel" in English), and it cannot say which item is
 * about to disappear. This is the same decision rendered in the product's own language and direction.
 *
 * `requireText` raises the bar for the irreversible ones: the owner has to type the name of the thing
 * being destroyed, so a mis-tap on a phone cannot delete a site.
 */
export function ConfirmDialog({
  open,
  labels,
  message,
  detail,
  requireText,
  requireHint,
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  labels: ConfirmDialogLabels;
  message: string;
  detail?: string;
  /** When set, the confirm button stays disabled until the owner types this exact text. */
  requireText?: string;
  /** Label above the type-to-confirm box; `{name}` is replaced with `requireText`. */
  requireHint?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTyped("");
      // showModal gives the focus trap, the inert background and Esc-to-close for free; a div cannot.
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Esc and the backdrop close the dialog natively; the parent has to learn that it is shut again.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => onCancel();
    el.addEventListener("cancel", onClose);
    return () => el.removeEventListener("cancel", onClose);
  }, [onCancel]);

  const blocked = !!requireText && typed.trim() !== requireText.trim();
  const confirmCls =
    variant === "danger" ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700";

  return (
    <dialog
      ref={ref}
      // The dialog is rendered inside the form it belongs to, so it inherits `dir` and the panel font.
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
      aria-labelledby="dk-confirm-title"
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself, outside its content box) dismisses.
        if (e.target === ref.current) onCancel();
      }}
    >
      <div className="p-5">
        <h2 id="dk-confirm-title" className="text-base font-black">
          {labels.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {detail && (
          <p className="mt-1 truncate text-sm font-bold text-slate-900" dir="auto">
            {detail}
          </p>
        )}
        {requireText && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">{(requireHint || "{name}").replace("{name}", requireText)}</span>
            {/* No `name`: this box exists to slow the owner down, never to be submitted. */}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              dir="auto"
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </label>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            data-dk-confirm="ok"
            disabled={blocked}
            onClick={() => !blocked && onConfirm()}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition disabled:opacity-50 ${confirmCls}`}
          >
            {labels.confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
