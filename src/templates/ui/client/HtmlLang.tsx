"use client";

import { useEffect } from "react";

/** Keeps <html lang/dir> in sync with the rendered site language (the root layout defaults to Arabic RTL). */
export function HtmlLang({ locale }: { locale: "ar" | "en" }) {
  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  return null;
}
