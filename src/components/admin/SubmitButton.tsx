"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  formAction,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const v: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  };
  return (
    <button type="submit" formAction={formAction} disabled={pending} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${v[variant]} ${className}`}>
      {pending ? pendingText || "..." : children}
    </button>
  );
}
