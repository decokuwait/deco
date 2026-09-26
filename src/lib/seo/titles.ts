import { lt } from "@/lib/i18n/site";
import type { Category, Locale, LText, SiteContent } from "@/lib/types";

/**
 * Per-trade search intent, in both languages.
 *
 * A brand-new tenant's `<title>` used to be the company name alone — no service, no city. Nobody in
 * Kuwait searches a decor company by name before they have heard of it; they search the trade and the
 * place. These defaults carry both until the owner writes their own, and they are never used to
 * overwrite a title the owner did write.
 */
export const CATEGORY_SEO: Record<Category, { service: LText; blurb: LText }> = {
  gypsum: {
    service: { ar: "ديكور جبس بورد", en: "Gypsum Board Decor" },
    blurb: {
      ar: "تصميم وتنفيذ ديكورات جبس بورد للأسقف والجدران للمنازل والمكاتب في جميع مناطق الكويت. معاينة مجانية وتنفيذ بأيدي فنيين متخصصين.",
      en: "Gypsum board ceilings and wall designs for homes and offices across Kuwait. Free site visit and installation by specialist fitters.",
    },
  },
  aluminum: {
    service: { ar: "أعمال ألمنيوم", en: "Aluminum Works" },
    blurb: {
      ar: "تفصيل وتركيب أبواب وشبابيك ومظلات ألمنيوم وكلادينج للمنازل والمحلات في الكويت. قياس مجاني وضمان على التركيب.",
      en: "Aluminum doors, windows, shades and cladding made to measure for homes and shops in Kuwait. Free measuring and an installation warranty.",
    },
  },
  partition: {
    service: { ar: "بارتيشن مكاتب", en: "Office Partitions" },
    blurb: {
      ar: "تنفيذ بارتيشن مكاتب وزجاج ومقاطع ألمنيوم وعوازل صوت للشركات في الكويت. تصميم حسب المساحة وتركيب سريع.",
      en: "Office, glass and acoustic partitions fitted for companies in Kuwait. Designed to your floor plan and installed fast.",
    },
  },
  ceramic: {
    service: { ar: "تركيب سيراميك وبورسلان", en: "Ceramic & Porcelain Tiling" },
    blurb: {
      ar: "توريد وتركيب سيراميك وبورسلان ورخام للأرضيات والحمامات والمطابخ في الكويت. تشطيب نظيف ومواد أصلية.",
      en: "Supply and fitting of ceramic, porcelain and marble for floors, bathrooms and kitchens in Kuwait. Clean finish, genuine materials.",
    },
  },
};

const IN_KUWAIT: LText = { ar: "في الكويت", en: "in Kuwait" };

/**
 * Title for a tenant home page: the owner's own SEO title wins, otherwise brand + trade + geography.
 * Kept short enough that Google does not truncate it (roughly 60 characters).
 */
export function tenantTitle(locale: Locale, content: SiteContent, category: Category, fallbackName: string): string {
  const own = lt(locale, content.seo.title).trim();
  if (own) return own;
  const brand = lt(locale, content.brand.name).trim() || fallbackName;
  const service = lt(locale, CATEGORY_SEO[category].service);
  return `${brand} | ${service} ${lt(locale, IN_KUWAIT)}`.slice(0, 70);
}

/** Description for a tenant home page: the owner's, then their tagline, then the trade default. */
export function tenantDescription(locale: Locale, content: SiteContent, category: Category): string {
  const own = lt(locale, content.seo.description).trim();
  if (own) return own;
  const tagline = lt(locale, content.brand.tagline).trim();
  const blurb = lt(locale, CATEGORY_SEO[category].blurb);
  return (tagline ? `${tagline} — ${blurb}` : blurb).slice(0, 300);
}
