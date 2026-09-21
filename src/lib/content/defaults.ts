import type { LText, SiteContent } from "@/lib/types";

const e = (): LText => ({ ar: "", en: "" });

/** Default privacy policy shown at /privacy until the owner edits it (ad platforms require a policy URL). */
export const DEFAULT_PRIVACY: LText = {
  ar: "نحترم خصوصيتك. عند زيارة موقعنا يتم تعيين رقم زائر عشوائي لتحسين خدمتنا ومتابعة طلبك، وقد نستخدم أدوات تحليل وإعلانات (مثل ميتا وتيك توك وسناب شات وجوجل وإكس) لقياس أداء حملاتنا. لا نبيع بياناتك لأي طرف ثالث. عند التواصل معنا عبر واتساب نستخدم رقمك ورسائلك فقط لخدمتك. يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا.",
  en: "We respect your privacy. When you visit our site a random visitor number is assigned to improve our service and follow up on your request, and we may use analytics and advertising tools (such as Meta, TikTok, Snapchat, Google and X) to measure our campaigns. We never sell your data to third parties. When you contact us on WhatsApp we use your number and messages only to serve you. You can ask us to delete your data at any time.",
};

/** Structural skeleton of site content. Every field exists so templates never hit undefined. */
export function emptyContent(): SiteContent {
  return {
    brand: { name: e(), tagline: e(), logoUrl: "", faviconUrl: "" },
    contact: {
      whatsapp: "",
      phone: "",
      email: "",
      address: e(),
      hours: e(),
      mapEmbedUrl: "",
      whatsappMessage: { ar: "مرحباً، رقم الزائر: {id}\nأرغب في الاستفسار عن خدماتكم.", en: "Hello, my visitor ID: {id}\nI would like to ask about your services." },
      title: e(),
      subtitle: e(),
    },
    ui: {},
    legal: { privacy: { ...DEFAULT_PRIVACY }, privacyTitle: { ar: "سياسة الخصوصية", en: "Privacy policy" } },
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
    cta: { title: e(), subtitle: e(), buttonText: e(), eyebrow: e() },
    seo: { title: e(), description: e(), ogImageUrl: "", keywords: "" },
    theme: {},
    sections: { about: true, services: true, stats: true, process: true, testimonials: true, faq: true, cta: true, order: [] },
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

/**
 * Site content with every field present.
 *
 * `raw` is whatever is in the `content` jsonb column, and that column is not always written by this
 * code — the schema can be applied by hand and rows can be imported. A scalar or an array there used to
 * come straight back out of `deepMerge` (a non-object patch replaces the base), and every template then
 * crashed on `content.settings.defaultLocale`, taking the whole tenant site to a 500. Anything that is
 * not a plain object is treated as no content at all.
 */
export function normalizeContent(raw: unknown): SiteContent {
  return deepMerge(emptyContent(), isPlainObject(raw) ? raw : {});
}

export function whatsappDigits(number: string | null | undefined): string {
  return (number || "").replace(/[^\d]/g, "");
}

/**
 * Digits of a phone number in international form, without the `+`.
 *
 * Kuwaiti numbers are written three ways: `50000000`, `96550000000` and `0096550000000`. The `00` is the
 * international access prefix, so it has to become `+` rather than stay in front of the country code —
 * `tel:+0096550000000` is not a number any phone can dial.
 */
export function internationalDigits(number: string | null | undefined): string {
  let d = whatsappDigits(number);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = `965${d}`;
  return d;
}

/** WhatsApp's own cap on a prefilled message, so a long template cannot produce a link wa.me rejects. */
export const MAX_WHATSAPP_MESSAGE = 900;

/** Replace the visitor id placeholder in a WhatsApp message and build the wa.me link. Without a number the link points to the contact section. */
export function whatsappLink(number: string, message: string, visitorCode: string | null | undefined): string {
  const digits = internationalDigits(number);
  if (!digits) return "#contact";
  const text = (message || "").replace(/\{id\}/g, visitorCode || "------").slice(0, MAX_WHATSAPP_MESSAGE);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string | undefined | null): string {
  const digits = internationalDigits(phone);
  return digits ? `tel:+${digits}` : "#contact";
}
