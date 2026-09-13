export type Locale = "ar" | "en";
export type LText = { ar: string; en: string };
export const LOCALES: Locale[] = ["ar", "en"];

export type Category = "gypsum" | "aluminum" | "partition" | "ceramic";
export const CATEGORIES: Category[] = ["gypsum", "aluminum", "partition", "ceramic"];

export const CATEGORY_LABELS: Record<Category, LText> = {
  gypsum: { ar: "ديكور جبس بورد", en: "Gypsum Board Decor" },
  aluminum: { ar: "ألمنيوم", en: "Aluminum" },
  partition: { ar: "بارتيشن", en: "Partitions" },
  ceramic: { ar: "سيراميك", en: "Ceramic" },
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as string[]).includes(v);
}

export type ProjectType = "finished" | "before_after" | "progress";
export const PROJECT_TYPES: ProjectType[] = ["finished", "before_after", "progress"];
export function isProjectType(v: unknown): v is ProjectType {
  return typeof v === "string" && (PROJECT_TYPES as string[]).includes(v);
}
export type MediaKind = "image" | "video";
export type MediaRole = "gallery" | "before" | "after" | "step";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  url: string;
  posterUrl?: string | null;
  role: MediaRole;
  caption?: LText | null;
  stepLabel?: LText | null;
  stepDate?: string | null;
  order: number;
}

export interface Project {
  id: string;
  type: ProjectType;
  title: LText;
  description: LText;
  location?: LText | null;
  coverUrl?: string | null;
  published: boolean;
  order: number;
  media: MediaItem[];
}

export interface Service {
  id: string;
  title: LText;
  description: LText;
  icon?: string;
  imageUrl?: string;
}
export interface Testimonial {
  id: string;
  name: LText;
  role?: LText;
  text: LText;
  rating?: number;
}
export interface Faq {
  id: string;
  q: LText;
  a: LText;
}
export interface Stat {
  id: string;
  value: string;
  label: LText;
}
export interface ProcessStep {
  id: string;
  title: LText;
  description: LText;
}

export interface SiteContent {
  brand: { name: LText; tagline: LText; logoUrl?: string; faviconUrl?: string };
  contact: {
    whatsapp: string;
    phone?: string;
    email?: string;
    address: LText;
    hours: LText;
    mapEmbedUrl?: string;
    whatsappMessage: LText;
    /** Contact section heading/subtitle (empty = default label / hidden). */
    title: LText;
    subtitle: LText;
  };
  /** Overrides for the site chrome strings (nav labels, buttons, footer texts). Empty = default dictionary text. */
  ui: Record<string, LText>;
  legal: { privacy: LText; privacyTitle: LText };
  socials: {
    instagram?: string;
    tiktok?: string;
    snapchat?: string;
    facebook?: string;
    x?: string;
    youtube?: string;
  };
  hero: {
    badge?: LText;
    title: LText;
    subtitle: LText;
    imageUrl?: string;
    images?: string[];
    videoUrl?: string;
    primaryCta: LText;
    secondaryCta?: LText;
  };
  about: { title: LText; body: LText; imageUrl?: string; points: LText[] };
  stats: Stat[];
  services: { title: LText; subtitle: LText; items: Service[] };
  process: { title: LText; subtitle: LText; steps: ProcessStep[] };
  projects: {
    title: LText;
    subtitle: LText;
    finished: { enabled: boolean; title: LText; subtitle: LText };
    beforeAfter: { enabled: boolean; title: LText; subtitle: LText };
    progress: { enabled: boolean; title: LText; subtitle: LText };
  };
  testimonials: { title: LText; subtitle: LText; items: Testimonial[] };
  faq: { title: LText; subtitle: LText; items: Faq[] };
  cta: { title: LText; subtitle: LText; buttonText: LText; eyebrow: LText };
  seo: { title: LText; description: LText; ogImageUrl?: string; keywords?: string };
  theme: {
    primary?: string;
    secondary?: string;
    accent?: string;
    bg?: string;
    surface?: string;
    text?: string;
    headingFont?: string;
    bodyFont?: string;
    radius?: string;
    buttonStyle?: string;
    pattern?: string;
  };
  sections: {
    about: boolean;
    services: boolean;
    stats: boolean;
    process: boolean;
    testimonials: boolean;
    faq: boolean;
    cta: boolean;
    /** Custom section order (section keys); empty = template order. */
    order: string[];
  };
  settings: {
    defaultLocale: Locale;
    showLangToggle: boolean;
    floatingWhatsapp: boolean;
    showVisitorId: boolean;
    signalMode: "smart" | "all";
  };
}

export interface SiteRecord {
  id: string;
  slug: string;
  name: string;
  category: Category;
  templateCode: string;
  status: "active" | "paused";
  content: SiteContent;
  createdAt: string;
  updatedAt: string;
}

export interface SiteData {
  id: string;
  slug: string;
  category: Category;
  templateCode: string;
  content: SiteContent;
  projects: Project[];
  preview?: boolean;
}

export type Platform = "meta" | "tiktok" | "snapchat" | "google" | "x";
export const PLATFORMS: Platform[] = ["meta", "tiktok", "snapchat", "google", "x"];
export const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta (Facebook / Instagram)",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google (GA4 / Ads)",
  x: "X (Twitter)",
};
export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as string[]).includes(v);
}

export type SourcePlatform = Platform | "direct" | "other";

export type Stage =
  | "new"
  | "contacted"
  | "called_for_visit"
  | "ordered"
  | "first_payment"
  | "order_complete";
export const STAGES: Stage[] = [
  "new",
  "contacted",
  "called_for_visit",
  "ordered",
  "first_payment",
  "order_complete",
];
export const STAGE_LABELS: Record<Stage, LText> = {
  new: { ar: "زائر جديد", en: "New" },
  contacted: { ar: "تم التواصل", en: "Contacted" },
  called_for_visit: { ar: "تم طلب زيارة", en: "Called for visit" },
  ordered: { ar: "تم الطلب", en: "Ordered" },
  first_payment: { ar: "الدفعة الأولى", en: "First payment complete" },
  order_complete: { ar: "اكتمل الطلب", en: "Order complete" },
};

export type EventKey =
  | "page_view"
  | "whatsapp_click"
  | "call_click"
  | "contacted"
  | "called_for_visit"
  | "ordered"
  | "first_payment"
  | "order_complete";

export interface PixelConfig {
  id: string;
  siteId: string;
  platform: Platform;
  pixelId: string;
  accessToken?: string | null;
  extra: { apiSecret?: string; adsId?: string; adsLabel?: string; consumerKey?: string; consumerSecret?: string; tokenSecret?: string };
  testEventCode?: string | null;
  active: boolean;
  eventMap: Partial<Record<EventKey, string>>;
}

export interface Visitor {
  id: string;
  siteId: string;
  code: string;
  sourcePlatform: SourcePlatform;
  utm: Record<string, string>;
  clickIds: Record<string, string>;
  cookies: Record<string, string>;
  referrer?: string | null;
  landingUrl?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  visits: number;
  stage: Stage;
  stageUpdatedAt?: string | null;
  notes?: string | null;
  name?: string | null;
  phone?: string | null;
  whatsappClicks: number;
}

export interface Delivery {
  platform: Platform;
  ok: boolean;
  status?: number;
  eventName?: string;
  response?: unknown;
  error?: string;
  skipped?: string;
}

export interface VisitorEvent {
  id: string;
  visitorId: string;
  siteId: string;
  eventType: EventKey;
  stage?: Stage | null;
  value?: number | null;
  currency?: string | null;
  eventId: string;
  targets: Platform[];
  deliveries: Delivery[];
  createdBy?: string | null;
  createdAt: string;
}
