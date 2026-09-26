import type { Category, LText } from "@/lib/types";

/**
 * Starter copy for a real customer's brand-new site.
 *
 * Why this file exists: the old starter content copied its headline, tagline, CTA block and meta
 * description straight out of the category demo, byte for byte. Ten gypsum contractors on the same root
 * domain therefore shipped ten pages with the same `<h1>` and the same `<meta name="description">`. That
 * is Google's "scaled content abuse" pattern almost to the letter — many near-identical sites on one
 * domain — and switching the demo toggle off did nothing about it, because the starter path had the
 * same defect.
 *
 * The fix is compositional, not random: every string is built from a per-trade vocabulary and a
 * sentence shape, and every choice is keyed on the site's own slug, so the copy is
 *   - stable: the same site regenerates the same words (a re-provision is not a rewrite),
 *   - different per tenant: the slug is unique by construction, and the business name is woven into
 *     the headline, the SEO title and the meta description, which are the three strings duplication
 *     actually costs us.
 * It is starter copy, not finished copy — the admin is expected to rewrite it, which is why the site
 * is provisioned paused.
 */

const L = (ar: string, en: string): LText => ({ ar, en });

/** Words for one trade. Slots are noun phrases so they can be dropped into any sentence shape. */
interface Trade {
  /** Definite trade noun: "الجبس بورد". */
  craft: LText;
  /** The activity: "أعمال الجبس بورد". */
  work: LText;
  /** Concrete things the contractor delivers. */
  deliverables: LText[];
  keywords: string;
}

const TRADES: Record<Category, Trade> = {
  gypsum: {
    craft: L("الجبس بورد", "gypsum board"),
    work: L("أعمال الجبس بورد", "gypsum board work"),
    deliverables: [
      L("أسقف معلقة وإضاءة مخفية", "false ceilings and cove lighting"),
      L("جدران ديكورية وخلفيات تلفزيون", "decorative walls and TV backdrops"),
      L("كرانيش وزخارف جبس", "cornices and gypsum mouldings"),
      L("قواطع جبس عازلة للصوت", "sound-insulating gypsum partitions"),
      L("ديكورات أسقف للمجالس والصالات", "ceiling designs for majlis and living rooms"),
    ],
    keywords: "جبس بورد الكويت, أسقف معلقة, ديكور جبس, gypsum board Kuwait",
  },
  aluminum: {
    craft: L("الألمنيوم", "aluminum"),
    work: L("أعمال الألمنيوم", "aluminum work"),
    deliverables: [
      L("نوافذ وأبواب ألمنيوم", "aluminum windows and doors"),
      L("مطابخ ألمنيوم بالقياس", "made-to-measure aluminum kitchens"),
      L("مظلات وسواتر", "carport shades and privacy screens"),
      L("واجهات كلادينج وزجاج", "cladding and glass façades"),
      L("غرف زجاجية وسكاي لايت", "glass rooms and skylights"),
    ],
    keywords: "ألمنيوم الكويت, نوافذ ألمنيوم, مطابخ ألمنيوم, aluminum Kuwait",
  },
  partition: {
    craft: L("البارتيشن", "partitions"),
    work: L("أعمال تقسيم المساحات", "space-division work"),
    deliverables: [
      L("قواطع زجاجية للمكاتب", "glass office partitions"),
      L("قواطع عازلة للصوت", "acoustic partitions"),
      L("أبواب منزلقة وحواجز متحركة", "sliding doors and movable walls"),
      L("قواطع ألمنيوم وزجاج مزدوج", "aluminum and double-glazed partitions"),
      L("تقسيم محلات ومعارض", "shop and showroom fit-outs"),
    ],
    keywords: "بارتيشن الكويت, قواطع زجاجية, قواطع مكاتب, office partitions Kuwait",
  },
  ceramic: {
    craft: L("السيراميك والبورسلان", "ceramic and porcelain"),
    work: L("أعمال التركيب والتشطيب", "tiling and finishing work"),
    deliverables: [
      L("أرضيات سيراميك وبورسلان", "ceramic and porcelain floors"),
      L("تشطيب حمامات ومطابخ", "bathroom and kitchen finishes"),
      L("بورسلان كبير المقاس", "large-format porcelain"),
      L("تكسية سلالم وواجهات", "stair and façade cladding"),
      L("أرضيات خارجية ومسابح", "outdoor and pool tiling"),
    ],
    keywords: "سيراميك الكويت, بورسلان, تركيب سيراميك, ceramic tiles Kuwait",
  },
};

/** Who the work is for. Shared across trades: every one of them serves the same Kuwaiti segments. */
const AUDIENCES: LText[] = [
  L("للبيوت والفلل", "for homes and villas"),
  L("للمكاتب والشركات", "for offices and companies"),
  L("للمحلات والمعارض", "for shops and showrooms"),
  L("للمشاريع السكنية والتجارية", "for residential and commercial projects"),
];

/** What the business promises. Deliberately checkable claims — nothing invented about the customer. */
const PROMISES: LText[] = [
  L("معاينة وقياس مجاني", "a free site visit and measurement"),
  L("عرض سعر واضح قبل البدء", "a clear quote before any work starts"),
  L("تسليم في الموعد المتفق", "handover on the agreed date"),
  L("ضمان على التنفيذ", "a workmanship warranty"),
  L("فريق فني مقيم في الكويت", "a crew based in Kuwait"),
  L("متابعة بعد التسليم", "follow-up after handover"),
];

interface Slots {
  name: string;
  craft: LText;
  work: LText;
  /** `d(0)` is this site's headline deliverable, `d(1)` the next one, and so on. */
  d: (n: number) => LText;
  a: (n: number) => LText;
  p: (n: number) => LText;
}
type Variant = (s: Slots) => LText;

// Every headline carries the business name: it is the one string on the page that is unique to this
// customer by definition, so weaving it in is what makes two sites in one trade genuinely different.
const HERO_TITLES: Variant[] = [
  (s) => L(`${s.name} — ${s.d(0).ar} في الكويت`, `${s.name} — ${s.d(0).en} in Kuwait`),
  (s) => L(`${s.d(0).ar} من ${s.name}`, `${s.d(0).en} by ${s.name}`),
  (s) => L(`${s.name}: ${s.work.ar} من الفكرة حتى التسليم`, `${s.name}: ${s.work.en} from first idea to handover`),
  (s) => L(`${s.d(0).ar} تليق بمساحتك — ${s.name}`, `${s.d(0).en} your space deserves — ${s.name}`),
  (s) => L(`${s.name} · ${s.craft.ar} بمعايير هندسية وتسليم في الموعد`, `${s.name} · ${s.craft.en} built to spec and handed over on time`),
  (s) => L(`${s.name} ${s.a(0).ar} — ${s.d(0).ar} بأيدٍ محترفة`, `${s.name} ${s.a(0).en} — ${s.d(0).en}, professionally installed`),
];

const TAGLINES: Variant[] = [
  (s) => L(`${s.d(1).ar} ${s.a(0).ar} في الكويت`, `${s.d(1).en} ${s.a(0).en} in Kuwait`),
  (s) => L(`${s.d(1).ar} — ${s.p(0).ar}`, `${s.d(1).en} — ${s.p(0).en}`),
  (s) => L(`${s.work.ar} ${s.a(0).ar} مع ${s.p(0).ar}`, `${s.work.en} ${s.a(0).en}, with ${s.p(0).en}`),
  (s) => L(`${s.d(1).ar} و${s.d(2).ar}`, `${s.d(1).en} and ${s.d(2).en}`),
  (s) => L(`متخصصون في ${s.craft.ar} ${s.a(0).ar}`, `Specialists in ${s.craft.en} ${s.a(0).en}`),
  (s) => L(`${s.d(1).ar} بخامات مختارة و${s.p(0).ar}`, `${s.d(1).en} in selected materials, with ${s.p(0).en}`),
];

const HERO_BADGES: Variant[] = [
  (s) => L(`${s.craft.ar} — الكويت`, `${s.craft.en} — Kuwait`),
  (s) => L(`${s.p(0).ar} داخل الكويت`, `${s.p(0).en}, anywhere in Kuwait`),
  (s) => L(`${s.work.ar} ${s.a(1).ar}`, `${s.work.en} ${s.a(1).en}`),
  (s) => L(`${s.d(2).ar} و${s.d(3).ar}`, `${s.d(2).en} and ${s.d(3).en}`),
  (s) => L(`${s.d(1).ar} ${s.a(1).ar}`, `${s.d(1).en} ${s.a(1).en}`),
];

const HERO_SUBTITLES: Variant[] = [
  (s) => L(`ننفذ ${s.d(0).ar} و${s.d(2).ar} ${s.a(0).ar}، مع ${s.p(0).ar} و${s.p(1).ar}.`, `We deliver ${s.d(0).en} and ${s.d(2).en} ${s.a(0).en}, with ${s.p(0).en} and ${s.p(1).en}.`),
  (s) => L(`${s.work.ar} من القياس حتى التسليم: ${s.d(0).ar}، ${s.d(1).ar}، و${s.p(1).ar}.`, `${s.work.en} from measurement to handover: ${s.d(0).en}, ${s.d(1).en}, and ${s.p(1).en}.`),
  (s) => L(`اطلب ${s.p(0).ar} وسنزورك في موقعك داخل الكويت لنتفق على التفاصيل قبل أي التزام.`, `Ask for ${s.p(0).en} and we will come to your site anywhere in Kuwait to agree the details before you commit.`),
  (s) => L(`${s.d(0).ar} ${s.a(0).ar}، بخامات مختارة وتنفيذ نظيف و${s.p(1).ar}.`, `${s.d(0).en} ${s.a(0).en}, in selected materials, cleanly installed, with ${s.p(1).en}.`),
  (s) => L(`نعمل ${s.a(0).ar} ${s.a(1).ar} في كل محافظات الكويت، و${s.p(0).ar} قبل البدء.`, `We work ${s.a(0).en} and ${s.a(1).en} across every governorate of Kuwait, with ${s.p(0).en} before we start.`),
];

const PRIMARY_CTAS: Variant[] = [
  () => L("تواصل واتساب", "WhatsApp us"),
  () => L("اطلب معاينة مجانية", "Book a free site visit"),
  () => L("احصل على عرض سعر", "Get a quote"),
  () => L("راسلنا على واتساب", "Message us on WhatsApp"),
];

const SECONDARY_CTAS: Variant[] = [
  () => L("شاهد أعمالنا", "See our work"),
  () => L("تصفح المشاريع", "Browse projects"),
  () => L("اطلع على الخدمات", "View our services"),
  () => L("تعرّف علينا", "About us"),
];

const CTA_EYEBROWS: Variant[] = [
  () => L("اطلب عرض سعر", "Get a quote"),
  () => L("ابدأ مشروعك", "Start your project"),
  () => L("خطوتك التالية", "Your next step"),
  () => L("تواصل معنا", "Talk to us"),
];

const CTA_TITLES: Variant[] = [
  (s) => L(`جاهز لـ${s.d(3).ar}؟`, `Ready for ${s.d(3).en}?`),
  (s) => L(`لنبدأ ${s.work.ar} في مساحتك`, `Let's start ${s.work.en} in your space`),
  (s) => L(`${s.name} على بُعد رسالة واحدة`, `${s.name} is one message away`),
  (s) => L(`احجز ${s.p(0).ar}`, `Book ${s.p(0).en}`),
  (s) => L(`تحتاج ${s.d(3).ar}؟ نحن جاهزون`, `Need ${s.d(3).en}? We're ready`),
];

const CTA_SUBTITLES: Variant[] = [
  (s) => L(`راسلنا على واتساب ونرتب ${s.p(0).ar} في الوقت الذي يناسبك.`, `Message us on WhatsApp and we'll arrange ${s.p(0).en} whenever suits you.`),
  (s) => L(`أرسل لنا مقاس المساحة أو صورة، ونرد عليك ${s.p(1).ar}.`, `Send us the measurements or a photo and you'll get ${s.p(1).en} back.`),
  (s) => L(`تواصل معنا اليوم: ${s.p(0).ar}، و${s.p(2).ar}.`, `Get in touch today: ${s.p(0).en}, and ${s.p(2).en}.`),
  (s) => L(`اسأل عن ${s.d(1).ar} — نرد على واتساب خلال ساعات العمل.`, `Ask about ${s.d(1).en} — we answer on WhatsApp during working hours.`),
];

const CTA_BUTTONS: Variant[] = [...PRIMARY_CTAS];

const CONTACT_TITLES: Variant[] = [
  () => L("تواصل معنا", "Contact us"),
  () => L("كلمنا", "Get in touch"),
  () => L("نحن في خدمتك", "We're here to help"),
  () => L("اطلب معاينة", "Request a visit"),
];

const CONTACT_SUBTITLES: Variant[] = [
  (s) => L(`${s.p(0).ar} داخل الكويت.`, `${s.p(0).en}, anywhere in Kuwait.`),
  () => L("اكتب لنا على واتساب وسنعاود التواصل معك.", "Write to us on WhatsApp and we'll get back to you."),
  (s) => L(`${s.p(1).ar} بعد المعاينة.`, `${s.p(1).en} after the site visit.`),
  (s) => L(`نستقبل طلبات ${s.work.ar} من كل محافظات الكويت.`, `We take ${s.work.en} enquiries from every governorate of Kuwait.`),
];

const ABOUT_TITLES: Variant[] = [
  () => L("من نحن", "About us"),
  (s) => L(`عن ${s.name}`, `About ${s.name}`),
  () => L("لماذا نحن", "Why us"),
  () => L("قصتنا", "Our story"),
];

const SERVICES_TITLES: Variant[] = [
  () => L("خدماتنا", "Our services"),
  () => L("ما نقدمه", "What we do"),
  (s) => L(`${s.work.ar}`, `${s.work.en}`),
  () => L("مجالات عملنا", "Where we work"),
];

const SERVICES_SUBTITLES: Variant[] = [
  () => L("كل ما تحتاجه في مكان واحد", "Everything you need in one place"),
  (s) => L(`من ${s.d(0).ar} إلى ${s.d(2).ar}`, `From ${s.d(0).en} to ${s.d(2).en}`),
  () => L("اختر الخدمة واسألنا عن التفاصيل", "Pick a service and ask us about it"),
  (s) => L(`${s.work.ar} ${s.a(0).ar} ${s.a(1).ar}`, `${s.work.en} ${s.a(0).en} and ${s.a(1).en}`),
];

const PROCESS_TITLES: Variant[] = [
  () => L("كيف نعمل", "How we work"),
  () => L("خطوات العمل", "Our steps"),
  () => L("من الفكرة للتسليم", "From idea to handover"),
  () => L("طريقتنا", "Our method"),
];

const PROCESS_SUBTITLES: Variant[] = [
  () => L("خطوات واضحة من أول اتصال", "Clear steps from the first call"),
  (s) => L(`تبدأ بـ${s.p(0).ar}`, `It starts with ${s.p(0).en}`),
  () => L("تعرف ما يحدث في كل مرحلة", "Know what happens at every stage"),
  (s) => L(`وتنتهي بـ${s.p(1).ar}`, `And ends with ${s.p(1).en}`),
];

const PROJECTS_TITLES: Variant[] = [
  () => L("أعمالنا", "Our work"),
  () => L("مشاريعنا", "Our projects"),
  () => L("معرض الأعمال", "Portfolio"),
  () => L("نماذج من التنفيذ", "Selected work"),
];

const PROJECTS_SUBTITLES: Variant[] = [
  () => L("أضف صور مشاريعك هنا ليراها عملاؤك", "Add photos of your own projects here"),
  (s) => L(`صور من ${s.work.ar} التي سلمناها`, `Photos from the ${s.work.en} we've handed over`),
  () => L("أحدث ما نفذناه", "Our most recent work"),
  (s) => L(`${s.d(0).ar} على أرض الواقع`, `${s.d(0).en}, as built`),
];

const TESTIMONIALS_TITLES: Variant[] = [
  () => L("آراء عملائنا", "What clients say"),
  () => L("ماذا قالوا عنا", "In our clients' words"),
  () => L("تجارب العملاء", "Client experiences"),
  () => L("شهادات", "Testimonials"),
];

const FAQ_TITLES: Variant[] = [
  () => L("الأسئلة الشائعة", "Frequently asked questions"),
  () => L("أسئلة يسألها عملاؤنا", "Questions clients ask"),
  () => L("تسأل ونجيب", "You ask, we answer"),
];

const FAQ_SUBTITLES: Variant[] = [
  () => L("أضف الأسئلة التي يسألك عنها عملاؤك فعلاً", "Add the questions your own clients actually ask"),
  (s) => L(`كل ما يخص ${s.work.ar}`, `Everything about ${s.work.en}`),
  () => L("إجابات قصيرة ومباشرة", "Short, direct answers"),
];

const SEO_DESCRIPTIONS: Variant[] = [
  (s) => L(`${s.name} — ${s.d(0).ar} ${s.a(0).ar} في الكويت. ${s.p(0).ar} وتنفيذ ${s.p(2).ar}. تواصل معنا على واتساب.`, `${s.name} — ${s.d(0).en} ${s.a(0).en} in Kuwait. ${s.p(0).en} and ${s.p(2).en}. Message us on WhatsApp.`),
  (s) => L(`${s.work.ar} في الكويت مع ${s.name}: ${s.d(0).ar}، ${s.d(1).ar}، ${s.p(1).ar}.`, `${s.work.en} in Kuwait with ${s.name}: ${s.d(0).en}, ${s.d(1).en}, ${s.p(1).en}.`),
  (s) => L(`${s.name} متخصصون في ${s.craft.ar} ${s.a(0).ar}. ${s.d(0).ar} و${s.d(2).ar}، مع ${s.p(0).ar}.`, `${s.name} specialises in ${s.craft.en} ${s.a(0).en}: ${s.d(0).en} and ${s.d(2).en}, with ${s.p(0).en}.`),
  (s) => L(`تبحث عن ${s.d(0).ar} في الكويت؟ ${s.name} ينفذ ${s.work.ar} ${s.a(0).ar} مع ${s.p(1).ar}.`, `Looking for ${s.d(0).en} in Kuwait? ${s.name} delivers ${s.work.en} ${s.a(0).en} with ${s.p(1).en}.`),
];

/**
 * FNV-1a over the slug. Any stable hash would do; what matters is that it does not depend on runtime
 * state, so re-provisioning a slug reproduces its copy exactly and a test can assert on it.
 */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function choose<T>(list: T[], slug: string, field: string): T {
  return list[hash32(`${slug}#${field}`) % list.length];
}

/** Google truncates around 160 characters; cut on a word so the description never ends mid-word. */
export function clampDescription(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[،,\-–—\s]+$/, "")}…`;
}

export interface StarterCopy {
  tagline: LText;
  heroBadge: LText;
  heroTitle: LText;
  heroSubtitle: LText;
  primaryCta: LText;
  secondaryCta: LText;
  aboutTitle: LText;
  servicesTitle: LText;
  servicesSubtitle: LText;
  processTitle: LText;
  processSubtitle: LText;
  projectsTitle: LText;
  projectsSubtitle: LText;
  testimonialsTitle: LText;
  faqTitle: LText;
  faqSubtitle: LText;
  contactTitle: LText;
  contactSubtitle: LText;
  cta: { eyebrow: LText; title: LText; subtitle: LText; buttonText: LText };
  seoDescription: LText;
  keywords: string;
}

/**
 * Deterministic starter copy for one site. `slug` is the entropy (it is unique per site by database
 * constraint) and `name` is what makes the headline and the meta description the customer's own.
 */
export function starterCopy(category: Category, name: string, slug: string): StarterCopy {
  const trade = TRADES[category];
  const rotate = (list: LText[], field: string) => {
    const base = hash32(`${slug}#${field}`) % list.length;
    // Offsets let one site use several different words without repeating itself: `d(0)` in the
    // headline and `d(1)` in the tagline are always different phrases.
    return (n: number) => list[(base + n) % list.length];
  };
  const s: Slots = {
    name: name.trim() || "",
    craft: trade.craft,
    work: trade.work,
    d: rotate(trade.deliverables, "deliverable"),
    a: rotate(AUDIENCES, "audience"),
    p: rotate(PROMISES, "promise"),
  };
  const v = (list: Variant[], field: string) => choose(list, slug, field)(s);
  const desc = v(SEO_DESCRIPTIONS, "seoDescription");
  return {
    tagline: v(TAGLINES, "tagline"),
    heroBadge: v(HERO_BADGES, "heroBadge"),
    heroTitle: v(HERO_TITLES, "heroTitle"),
    heroSubtitle: v(HERO_SUBTITLES, "heroSubtitle"),
    primaryCta: v(PRIMARY_CTAS, "primaryCta"),
    secondaryCta: v(SECONDARY_CTAS, "secondaryCta"),
    aboutTitle: v(ABOUT_TITLES, "aboutTitle"),
    servicesTitle: v(SERVICES_TITLES, "servicesTitle"),
    servicesSubtitle: v(SERVICES_SUBTITLES, "servicesSubtitle"),
    processTitle: v(PROCESS_TITLES, "processTitle"),
    processSubtitle: v(PROCESS_SUBTITLES, "processSubtitle"),
    projectsTitle: v(PROJECTS_TITLES, "projectsTitle"),
    projectsSubtitle: v(PROJECTS_SUBTITLES, "projectsSubtitle"),
    testimonialsTitle: v(TESTIMONIALS_TITLES, "testimonialsTitle"),
    faqTitle: v(FAQ_TITLES, "faqTitle"),
    faqSubtitle: v(FAQ_SUBTITLES, "faqSubtitle"),
    contactTitle: v(CONTACT_TITLES, "contactTitle"),
    contactSubtitle: v(CONTACT_SUBTITLES, "contactSubtitle"),
    cta: {
      eyebrow: v(CTA_EYEBROWS, "ctaEyebrow"),
      title: v(CTA_TITLES, "ctaTitle"),
      subtitle: v(CTA_SUBTITLES, "ctaSubtitle"),
      buttonText: v(CTA_BUTTONS, "ctaButton"),
    },
    seoDescription: { ar: clampDescription(desc.ar), en: clampDescription(desc.en) },
    keywords: `${name.trim() ? `${name.trim()}, ` : ""}${trade.keywords}`,
  };
}
