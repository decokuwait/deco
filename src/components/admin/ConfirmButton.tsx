"use client";

import type { ReactNode } from "react";

/** Submit button that asks for confirmation first (used for deletes). Can carry a name/value like a normal submit. */
export function ConfirmButton({
  children,
  message,
  className = "",
  formAction,
  variant = "danger",
  name,
  value,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  variant?: "danger" | "ghost";
  name?: string;
  value?: string;
}) {
  const v = variant === "danger" ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";
  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate
      name={name}
      value={value}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${v} ${className}`}
    >
      {children}
    </button>
  );
}
