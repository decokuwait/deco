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
  /**
   * Authorable alt text. Falls back to a generated description at render time.
   * Never render alt="" for a content image: that declares it decorative to a
   * screen reader, which is a WCAG 1.1.1 failure on a portfolio site.
   */
  alt?: LText | null;
  /**
   * Which part of the photo must survive the crop. Every gallery frame is `object-cover`, so the owner
   * had no say in what got cut — and on a decor portfolio the framing is the product. Maps to
   * `object-position` at render time; absent means centre, which is what it has always been.
   */
  focal?: "top" | "center" | "bottom" | null;
  stepLabel?: LText | null;
  stepDate?: string | null;
  order: number;
}

export interface Project {
  id: string;
  type: ProjectType;
  /** URL segment for the project's own page, unique per site. Never null after 0005. */
  slug: string;
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
    /**
     * Structured address parts. `address` above stays as the free-text display
     * line; these feed PostalAddress in the JSON-LD, which matches a business to
     * a place far better than one opaque string.
     */
    addressParts?: { street?: LText; area?: LText; governorate?: LText };
    /** Feeds schema.org `geo`. Google wants 5+ decimal places. */
    geo?: { lat?: string; lng?: string };
    /**
     * Structured opening hours -> openingHoursSpecification. The free-text
     * `hours` field above is unparseable as schema.org data; this is what gets
     * emitted. Kuwaiti week: Friday is the day off, split shifts are common.
     */
    hoursSpec?: { days: string[]; opens: string; closes: string }[];
    /** Google Business Profile link. Emitted in `sameAs` — the strongest entity signal available. */
    googleBusinessUrl?: string;
    /** Review link (https://g.page/r/<id>/review), used by the review-request flow. */
    googleReviewUrl?: string;
    /** Governorates/areas actually served -> schema.org areaServed. */
    areasServed?: LText[];
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
  seo: {
    title: LText;
    description: LText;
    ogImageUrl?: string;
    keywords?: string;
    /** Search Console / Bing ownership tokens, emitted as meta tags. */
    verification?: { google?: string; bing?: string };
    /** schema.org priceRange (max 100 chars), e.g. "KD 15 - KD 40 / م²". */
    priceRange?: string;
  };
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
    signalMode: SignalMode;
    /** Platform that receives the signal in `primary` mode when the visitor's source is unknown. */
    primaryPlatform: Platform | null;
    consentMode: ConsentMode;
    /**
     * This site is a showcase, not a business. Only a demo may carry fabricated material —
     * invented testimonials, stock projects, a placeholder phone number — so provisioning refuses
     * to write any of it to a site without this flag, and a demo is kept out of the index.
     */
    demo?: boolean;
  };
}

/**
 * Where a server-side conversion is sent.
 * `source` only the platform the visitor came from, and NOTHING when that is
 *   unknown — the safe default. The old behaviour fanned out to every connected
 *   platform on unknown traffic, which inflates conversions in every ad account.
 * `primary` falls back to the designated primary platform instead of nothing.
 * `all` always sends everywhere.
 */
export type SignalMode = "source" | "primary" | "all";

/**
 * How the tracking notice behaves. Kuwait has no general data protection law and the CITRA DPPR binds
 * licensed telecom/internet providers only, so the operative obligation is the ad platforms' own
 * business-tool terms, which outside the EEA require *disclosure* rather than opt-in.
 * `off` no notice at all. `notice` a dismissible Arabic notice; pixels load. `explicit` pixels and the
 * server-side click signal wait for an explicit accept.
 */
export type ConsentMode = "off" | "notice" | "explicit";
export const CONSENT_MODES: ConsentMode[] = ["off", "notice", "explicit"];
export const SIGNAL_MODES: SignalMode[] = ["source", "primary", "all"];

export type Plan = "basic" | "pro" | "plus";
export const PLANS: Plan[] = ["basic", "pro", "plus"];
export type BillingCycle = "monthly" | "yearly";
export const BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly"];

/** Billing state carried on every site row. Money is fils (1 KWD = 1000 fils). */
export interface SiteBilling {
  plan: Plan;
  priceFils: number;
  billingCycle: BillingCycle;
  /** ISO date (YYYY-MM-DD). A site past this date is auto-paused by the cron. */
  paidUntil: string | null;
  lastInvoiceRef: string | null;
}

export interface SiteRecord extends SiteBilling {
  id: string;
  slug: string;
  name: string;
  category: Category;
  templateCode: string;
  status: "active" | "paused";
  content: SiteContent;
  createdAt: string;
  updatedAt: string;
  /** Soft delete. Every lookup filters this out; a purge job removes the row later. */
  deletedAt: string | null;
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
  /**
   * A failure the owner must act on, told apart from a transient one. `auth` is an expired or revoked
   * token; `api_version` is the platform retiring the API version we pin. Both fail every event for
   * every tenant at once, so neither may look like a generic red badge.
   */
  alarm?: DeliveryAlarm;
  /**
   * True when the delivery reached an analytics product rather than an ad-conversion endpoint (GA4
   * Measurement Protocol). Google Ads cannot optimise on it, so it must never be reported as a sent
   * ad signal.
   */
  analyticsOnly?: boolean;
}

export type DeliveryAlarm = "auth" | "api_version";

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
