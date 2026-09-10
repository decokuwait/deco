import type { Locale, LText } from "@/lib/types";

export const SITE_UI = {
  nav_home: { ar: "الرئيسية", en: "Home" },
  nav_about: { ar: "من نحن", en: "About" },
  nav_services: { ar: "خدماتنا", en: "Services" },
  nav_projects: { ar: "أعمالنا", en: "Projects" },
  nav_contact: { ar: "تواصل معنا", en: "Contact" },
  nav_faq: { ar: "الأسئلة الشائعة", en: "FAQ" },
  whatsapp: { ar: "تواصل واتساب", en: "WhatsApp us" },
  call_now: { ar: "اتصل الآن", en: "Call now" },
  view_projects: { ar: "شاهد أعمالنا", en: "View our work" },
  before: { ar: "قبل", en: "Before" },
  after: { ar: "بعد", en: "After" },
  step: { ar: "مرحلة", en: "Step" },
  progress_hint: { ar: "اسحب لمشاهدة مراحل العمل", en: "Swipe to see the progress" },
  drag_hint: { ar: "اسحب للمقارنة", en: "Drag to compare" },
  view_all: { ar: "عرض الكل", en: "View all" },
  our_location: { ar: "موقعنا", en: "Our location" },
  working_hours: { ar: "ساعات العمل", en: "Working hours" },
  phone: { ar: "الهاتف", en: "Phone" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  follow_us: { ar: "تابعنا", en: "Follow us" },
  rights: { ar: "جميع الحقوق محفوظة", en: "All rights reserved" },
  visitor_id: { ar: "رقم الزائر", en: "Visitor ID" },
  lang_switch: { ar: "English", en: "العربية" },
  quick_links: { ar: "روابط سريعة", en: "Quick links" },
  years_exp: { ar: "سنوات خبرة", en: "Years of experience" },
  read_more: { ar: "اقرأ المزيد", en: "Read more" },
  finished_projects: { ar: "مشاريع منجزة", en: "Finished projects" },
  before_after: { ar: "قبل وبعد", en: "Before & after" },
  in_progress: { ar: "مراحل التنفيذ", en: "Work in progress" },
  play_video: { ar: "تشغيل الفيديو", en: "Play video" },
  close: { ar: "إغلاق", en: "Close" },
  back_to_top: { ar: "العودة للأعلى", en: "Back to top" },
  menu: { ar: "القائمة", en: "Menu" },
  get_quote: { ar: "اطلب عرض سعر", en: "Get a quote" },
  free_visit: { ar: "زيارة مجانية للمعاينة", en: "Free site visit" },
  kuwait: { ar: "الكويت", en: "Kuwait" },
  location: { ar: "الموقع", en: "Location" },
  day: { ar: "اليوم", en: "Day" },
  of: { ar: "من", en: "of" },
  privacy_policy: { ar: "سياسة الخصوصية", en: "Privacy policy" },
} satisfies Record<string, LText>;

export type SiteUiKey = keyof typeof SITE_UI;

export function t(locale: Locale, key: SiteUiKey): string {
  return SITE_UI[key][locale];
}

/** Pick a localized string from an LText with fallback to the other locale. */
export function lt(locale: Locale, text: LText | null | undefined, fallback = ""): string {
  if (!text) return fallback;
  const v = text[locale];
  if (v && v.trim()) return v;
  const other = locale === "ar" ? text.en : text.ar;
  return other && other.trim() ? other : fallback;
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(v: unknown): v is Locale {
  return v === "ar" || v === "en";
}
