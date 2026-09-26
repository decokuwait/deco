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
  not_found_title: { ar: "الصفحة غير موجودة", en: "Page not found" },
  not_found_text: { ar: "الرابط الذي فتحته غير متوفر. عُد إلى الصفحة الرئيسية أو تواصل معنا مباشرة.", en: "The link you opened is not available. Go back to the home page or contact us directly." },
  back_home: { ar: "العودة للرئيسية", en: "Back to home" },
  menu: { ar: "القائمة", en: "Menu" },
  get_quote: { ar: "اطلب عرض سعر", en: "Get a quote" },
  free_visit: { ar: "زيارة مجانية للمعاينة", en: "Free site visit" },
  kuwait: { ar: "الكويت", en: "Kuwait" },
  location: { ar: "الموقع", en: "Location" },
  day: { ar: "اليوم", en: "Day" },
  of: { ar: "من", en: "of" },
  prev_slide: { ar: "السابق", en: "Previous" },
  next_slide: { ar: "التالي", en: "Next" },
  go_to_slide: { ar: "اذهب إلى الشريحة", en: "Go to slide" },
  // The hero rotator's own control: auto-rotating content needs a way to stop it (WCAG 2.2.2).
  pause_slideshow: { ar: "إيقاف تبديل الصور", en: "Pause the slideshow" },
  play_slideshow: { ar: "تشغيل تبديل الصور", en: "Play the slideshow" },
  privacy_policy: { ar: "سياسة الخصوصية", en: "Privacy policy" },
  skip_to_content: { ar: "تخطَّ إلى المحتوى", en: "Skip to content" },
  photo: { ar: "صورة من أعمالنا", en: "Photo of our work" },
  // For /projects and /services, the pages that give each project and service its own URL.
  all_projects: { ar: "كل الأعمال", en: "All projects" },
  view_project: { ar: "شاهد المشروع", en: "View project" },
  photo_gallery: { ar: "معرض الصور", en: "Photo gallery" },
  related_projects: { ar: "أعمال مشابهة", en: "Related work" },
  related_services: { ar: "خدمات ذات صلة", en: "Related services" },
  no_projects_title: { ar: "لم نضف أعمالنا بعد", en: "Our work is not online yet" },
  no_projects_text: { ar: "ننفّذ مشاريع كل أسبوع وسنضيف صورها هنا قريباً. تواصل معنا الآن لنعرض عليك أعمالنا مباشرة.", en: "We deliver projects every week and the photos are going up here shortly. Message us now and we will show you our work directly." },
  ask_about: { ar: "استفساري عن", en: "I am asking about" },
  prev_page: { ar: "الصفحة السابقة", en: "Previous page" },
  next_page: { ar: "الصفحة التالية", en: "Next page" },
  // Tracking notice. Kuwait has no general data protection law and the CITRA rules bind
  // licensed telecom providers only; this exists for the ad platforms' own business-tool terms, which
  // outside the EEA ask for disclosure. Kept to one line so it does not fight the page for attention.
  consent_text: { ar: "نستخدم ملفات تعريف الارتباط وأدوات قياس من منصات الإعلان لتحسين خدمتنا ومتابعة طلبك.", en: "We use cookies and ad-platform measurement tools to improve our service and follow up on your request." },
  consent_accept: { ar: "موافق", en: "Accept" },
  consent_decline: { ar: "بدون تتبّع", en: "No tracking" },
  consent_dismiss: { ar: "حسناً", en: "Got it" },
  consent_more: { ar: "سياسة الخصوصية", en: "Privacy policy" },
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
