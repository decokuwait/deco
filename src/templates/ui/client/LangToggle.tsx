"use client";

/**
 * Switches the site language. It is a real link (`?lang=en`) so crawlers can reach the other language,
 * and it also stores the choice in a cookie so later pages keep it without the query string.
 */
export function LangToggle({ locale, label, className = "" }: { locale: "ar" | "en"; label: string; className?: string }) {
  const next = locale === "ar" ? "en" : "ar";
  function remember() {
    document.cookie = `dk_lang=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <a href={`?lang=${next}`} onClick={remember} className={className} aria-label={label} hrefLang={next} lang={next} dir={next === "ar" ? "rtl" : "ltr"}>
      {label}
    </a>
  );
}
