"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Switches the site language by setting the locale cookie and refreshing the server render. */
export function LangToggle({ locale, label, className = "" }: { locale: "ar" | "en"; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  function onClick() {
    document.cookie = `dk_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className={className} aria-label={label} dir={next === "ar" ? "rtl" : "ltr"}>
      {label}
    </button>
  );
}
