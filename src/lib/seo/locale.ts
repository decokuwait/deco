import { headers } from "next/headers";
import { isLocale } from "@/lib/i18n/site";
import type { Locale, SiteContent } from "@/lib/types";

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z]/;

/**
 * Is this string actually written in English?
 *
 * `lt()` falls back to the other language when a field is empty, so an `en` slot that was never filled
 * renders Arabic — and the page then declared `<html lang="en" dir="ltr">`, canonicalised itself and was
 * submitted in the sitemap with `hreflang="en"`. Emptiness is not the only failure: operators also paste
 * the Arabic copy into the English box. Both are caught by requiring Latin letters and no Arabic script.
 */
export function isEnglishText(v: string | null | undefined): boolean {
  const s = (v || "").trim();
  return s.length > 1 && LATIN.test(s) && !ARABIC.test(s);
}

/**
 * Whether the English variant of a site may be published (indexed, annotated with hreflang, submitted).
 *
 * The bar is deliberately "the pages a searcher would land on are readable in English", not "some field
 * somewhere has Latin characters in it": hero, about, every service and the SEO pair. One tenant with a
 * half-translated site poisons a whole hreflang cluster, and Google discards a cluster it cannot make
 * self-consistent.
 */
export function englishIsPublished(content: SiteContent): boolean {
  if (!content.settings.showLangToggle) return false;
  if (content.settings.defaultLocale === "en") return true;
  if (!isEnglishText(content.hero.title.en)) return false;
  if (!isEnglishText(content.about.body.en)) return false;
  if (content.sections.services && content.services.items.length) {
    if (!content.services.items.every((s) => isEnglishText(s.title.en))) return false;
  }
  if (!isEnglishText(content.seo.title.en) && !isEnglishText(content.seo.description.en)) return false;
  return true;
}

/** The languages this site is published in, default first. One entry means: emit no hreflang at all. */
export function publishedLocales(content: SiteContent): Locale[] {
  const def = content.settings.defaultLocale;
  const other: Locale = def === "ar" ? "en" : "ar";
  if (other === "en") return englishIsPublished(content) ? [def, other] : [def];
  // An English-default site is the rare case; Arabic is this product's first language and always written.
  return content.settings.showLangToggle ? [def, other] : [def];
}

/**
 * Language of the current URL — from `?lang=` (forwarded by the proxy as `x-dk-lang`) and nothing else.
 *
 * Deliberately does NOT read `dk_lang`. A visitor carrying that cookie made the bare `/` render English
 * while its own metadata declared `?lang=en` as the canonical: the document at a URL pointed at a
 * different URL as the original of itself, and the bytes at `/` differed per visitor. A cookie may drive
 * a redirect; it must never change the content or the canonical at a given URL.
 */
export async function urlLocale(fallback: Locale = "ar"): Promise<Locale> {
  const h = await headers();
  const fromQuery = h.get("x-dk-lang");
  return isLocale(fromQuery) ? fromQuery : fallback;
}

/** Canonical URL of a page in a language: the default language lives on the bare URL. */
export function langPath(path: string, locale: Locale, defaultLocale: Locale): string {
  return locale === defaultLocale ? path : `${path}${path.includes("?") ? "&" : "?"}lang=${locale}`;
}
