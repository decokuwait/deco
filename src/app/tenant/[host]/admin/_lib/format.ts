import type { Locale } from "@/lib/types";

const TZ = "Asia/Kuwait";

export function fmtDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(d);
}

export function fmtDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: TZ }).format(d);
}

export function fmtMoney(v: number | null | undefined, currency = "KWD"): string {
  if (v == null) return "";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 3 })} ${currency}`;
}

/** Compact one-line preview of an API response / error for delivery logs. */
export function shortJson(v: unknown, max = 160): string {
  if (v == null) return "";
  let s: string;
  if (typeof v === "string") s = v;
  else {
    try {
      s = JSON.stringify(v);
    } catch {
      s = String(v);
    }
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
