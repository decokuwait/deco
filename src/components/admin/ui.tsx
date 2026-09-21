import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { Locale, LText } from "@/lib/types";
import { ADMIN_UI, ta, type AdminUiKey } from "@/lib/i18n/admin";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className = "", title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-[96px]", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}

/** CSS-only toggle switch that submits as a checkbox (value "on"). */
export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
        <span className="absolute top-1 start-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" | "lg" } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "formAction"> & {
    formAction?: (formData: FormData) => void | Promise<void>;
  }) {
  const v: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  };
  const s: Record<string, string> = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button {...rest} className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:opacity-50", v[variant], s[size], className)}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "ghost", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; className?: string }) {
  const v: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  };
  return (
    <a href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", v[variant], className)}>
      {children}
    </a>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" | "violet" }) {
  const t: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", t[tone])}>{children}</span>;
}

export function EmptyState({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="font-bold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Two inputs (Arabic + English) for an LText value. Field names: `${name}.ar` and `${name}.en`. */
export function BilingualInput({
  name,
  value,
  label,
  textarea = false,
  required = false,
  placeholderAr,
  placeholderEn,
}: {
  name: string;
  value?: LText | null;
  label?: ReactNode;
  textarea?: boolean;
  required?: boolean;
  placeholderAr?: string;
  placeholderEn?: string;
}) {
  const C = textarea ? Textarea : Input;
  return (
    <div>
      {label && <span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>}
      <div className="grid gap-2 sm:grid-cols-2">
        {/* Each wrapper takes the input's direction so the language chip always sits at the text end. */}
        <div className="relative" dir="rtl">
          <span className="pointer-events-none absolute top-2 end-2 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">AR</span>
          <C name={`${name}.ar`} defaultValue={value?.ar ?? ""} dir="rtl" required={required} placeholder={placeholderAr} className="pe-10" />
        </div>
        <div className="relative" dir="ltr">
          <span className="pointer-events-none absolute top-2 end-2 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">EN</span>
          <C name={`${name}.en`} defaultValue={value?.en ?? ""} dir="ltr" placeholder={placeholderEn} className="pe-10" />
        </div>
      </div>
    </div>
  );
}

/** Reads `${name}.ar` / `${name}.en` from a FormData into an LText. */
/**
 * Longest a single bilingual field may be. Every other admin input is capped by `readStr`; this one was
 * not, so one field could push megabytes into the site's `content` jsonb — a row every tenant page load
 * then reads in full. Generous enough for the longest thing anyone edits here (the privacy policy).
 */
export const MAX_LTEXT = 20000;

export function readLText(fd: FormData, name: string, max = MAX_LTEXT): LText {
  return {
    ar: String(fd.get(`${name}.ar`) ?? "").trim().slice(0, max),
    en: String(fd.get(`${name}.en`) ?? "").trim().slice(0, max),
  };
}

export function readStr(fd: FormData, name: string, max = 2000): string {
  return String(fd.get(name) ?? "")
    .trim()
    .slice(0, max);
}

export function readBool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function readNum(fd: FormData, name: string): number | null {
  const v = String(fd.get(name) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Translates internal error codes (from actions, uploads, delivery skips) into the admin language.
 *
 * Anything that is not a known code is not shown. Codes travel in the URL (`?error=...`), so rendering an
 * unknown value verbatim let anyone put their own sentence inside the owner's own red "error" banner —
 * a ready-made phishing line on a page the owner trusts. Unknown codes fall back to the generic message,
 * and the raw value goes to the server log where an operator can still read it.
 */
export function translateCode(locale: Locale, code: string): string | null {
  const key = `err_${code}` as AdminUiKey;
  if (key in ADMIN_UI) return ta(locale, key);
  if (code in ADMIN_UI) return ta(locale, code as AdminUiKey);
  return null;
}

export function Flash({
  saved,
  error,
  savedText,
  errorText,
  locale = "ar",
  translate,
}: {
  saved?: string;
  /** The raw error *code* from `?error=`, never a message: Flash is what turns a code into text. */
  error?: string;
  savedText: string;
  errorText: string;
  locale?: Locale;
  /** Code -> message for dictionaries other than the admin one (the super panel has its own). */
  translate?: (code: string) => string | null;
}) {
  if (saved)
    return (
      <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
        {savedText}
      </div>
    );
  if (error) {
    const detail = translate ? translate(error) : translateCode(locale, error);
    return (
      <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
        {detail ? `${errorText}: ${detail}` : errorText}
      </div>
    );
  }
  return null;
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("-mx-4 overflow-x-auto sm:mx-0", className)}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}
