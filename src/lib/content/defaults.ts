import type { LText, SiteContent } from "@/lib/types";

const e = (): LText => ({ ar: "", en: "" });

/** Structural skeleton of site content. Every field exists so templates never hit undefined. */
export function emptyContent(): SiteContent {
  return {
    brand: { name: e(), tagline: e(), logoUrl: "" },
    contact: {
      whatsapp: "",
      phone: "",
      email: "",
      address: e(),
      hours: e(),
      mapEmbedUrl: "",
      whatsappMessage: { ar: "مرحباً، رقم الزائر: {id}\nأرغب في الاستفسار عن خدماتكم.", en: "Hello, my visitor ID: {id}\nI would like to ask about your services." },
    },
    socials: { instagram: "", tiktok: "", snapchat: "", facebook: "", x: "", youtube: "" },
    hero: { badge: e(), title: e(), subtitle: e(), imageUrl: "", images: [], videoUrl: "", primaryCta: e(), secondaryCta: e() },
    about: { title: e(), body: e(), imageUrl: "", points: [] },
    stats: [],
    services: { title: e(), subtitle: e(), items: [] },
    process: { title: e(), subtitle: e(), steps: [] },
    projects: {
      title: e(),
      subtitle: e(),
      finished: { enabled: true, title: e(), subtitle: e() },
      beforeAfter: { enabled: false, title: e(), subtitle: e() },
      progress: { enabled: false, title: e(), subtitle: e() },
    },
    testimonials: { title: e(), subtitle: e(), items: [] },
    faq: { title: e(), subtitle: e(), items: [] },
    cta: { title: e(), subtitle: e(), buttonText: e() },
    seo: { title: e(), description: e(), ogImageUrl: "", keywords: "" },
    theme: {},
    sections: { about: true, services: true, stats: true, process: true, testimonials: true, faq: true, cta: true },
    settings: { defaultLocale: "ar", showLangToggle: true, floatingWhatsapp: true, showVisitorId: true, signalMode: "smart" },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Recursive merge: objects merge, arrays/primitives replace, undefined is ignored. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return (patch === undefined ? base : (patch as T)) as T;
  if (!isPlainObject(base)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] = isPlainObject(cur) && isPlainObject(v) ? deepMerge(cur, v) : v;
  }
  return out as T;
}

export function normalizeContent(raw: unknown): SiteContent {
  return deepMerge(emptyContent(), raw ?? {});
}

/** Replace the visitor id placeholder in a WhatsApp message and build the wa.me link. */
export function whatsappLink(number: string, message: string, visitorCode: string | null | undefined): string {
  const digits = (number || "").replace(/[^\d]/g, "");
  const text = (message || "").replace(/\{id\}/g, visitorCode || "------");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string | undefined | null): string {
  const p = (phone || "").replace(/[^\d+]/g, "");
  return p ? `tel:${p.startsWith("+") ? p : "+" + p}` : "#";
}
