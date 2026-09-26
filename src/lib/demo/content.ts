import type { Category, LText, MediaItem, Project, SiteContent } from "@/lib/types";
import { emptyContent, deepMerge } from "@/lib/content/defaults";

const U = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
/**
 * Same photo at a smaller width for slots that render small (cards, mosaic tiles).
 * The `\d` used to be written `d`, so the pattern matched nothing and every call was a silent
 * no-op that shipped the 1400px original into a card. Twin of the one in `templates/ui/img.ts`.
 */
const sized = (url: string, w: number) => url.replace(/([?&])w=\d+/, `$1w=${w}`);

/**
 * URL segment for a demo project. The canonical generator used when a real project is
 * created; this local one only has to be stable, unique inside the demo set and valid `[a-z0-9-]`,
 * because these ids are what `/projects/<slug>` serves in the 60 template previews.
 */
function demoSlug(en: string, fallback: string): string {
  const s = en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || fallback;
}

export const IMAGES: Record<Category, string[]> = {
  gypsum: [
    "1600585154340-be6161a56a0c",
    "1600607687939-ce8a6c25118c",
    "1600210492486-724fe5c67fb0",
    "1600573472592-401b489a3cdc",
    "1616486338812-3dadae4b4ace",
    "1616594039964-ae9021a400a0",
    "1618221195710-dd6b41faaea6",
    "1617806118233-18e1de247200",
    "1631679706909-1844bbd07221",
    "1600489000022-c2086d79f9d4",
    "1600566752355-35792bedcfea",
    "1600047509807-ba8f99d2cdde",
    "1513694203232-719a280e022f",
    "1493809842364-78817add7ffb",
  ].map((i) => U(i)),
  aluminum: [
    "1486406146926-c627a92ad1ab",
    "1484154218962-a197022b5858",
    "1600566753190-17f0baa2a6c3",
    "1556228453-efd6c1ff04f6",
    "1502672260266-1c1ef2d93688",
    "1522708323590-d24dbb6b0267",
    "1560448204-e02f11c3d0e2",
    "1583847268964-b28dc8f51f92",
    "1595428774223-ef52624120d2",
    "1620626011761-996317b8d101",
    "1629079447777-1e605162dc8d",
    "1604709177225-055f99402ea3",
    "1555041469-a586c61ea9bc",
    "1567016432779-094069958ea5",
  ].map((i) => U(i)),
  partition: [
    "1524758631624-e2822e304c36",
    "1497366216548-37526070297c",
    "1497366754035-f200968a6e72",
    "1504384308090-c894fdcc538d",
    "1594873604892-b599f847e859",
    "1502005229762-cf1b2da7c5d6",
    "1533090161767-e6ffed986c88",
    "1522708323590-d24dbb6b0267",
    "1486406146926-c627a92ad1ab",
    "1600585154340-be6161a56a0c",
    "1560448204-e02f11c3d0e2",
    "1604709177225-055f99402ea3",
    "1497366811353-6870744d04b2",
    "1524758631624-e2822e304c36",
  ].map((i) => U(i)),
  ceramic: [
    "1615873968403-89e068629265",
    "1545324418-cc1a3fa10c00",
    "1556228453-efd6c1ff04f6",
    "1600566753190-17f0baa2a6c3",
    "1484154218962-a197022b5858",
    "1507089947368-19c1da9775ae",
    "1600585154340-be6161a56a0c",
    "1600607687939-ce8a6c25118c",
    "1616486338812-3dadae4b4ace",
    "1600489000022-c2086d79f9d4",
    "1618221195710-dd6b41faaea6",
    "1631679706909-1844bbd07221",
    "1629079447777-1e605162dc8d",
    "1620626011761-996317b8d101",
  ].map((i) => U(i)),
};

const L = (ar: string, en: string): LText => ({ ar, en });

interface CategorySpec {
  brand: LText;
  tagline: LText;
  heroBadge: LText;
  heroTitle: LText;
  heroSubtitle: LText;
  aboutTitle: LText;
  aboutBody: LText;
  points: LText[];
  services: { title: LText; description: LText; icon: string }[];
  process: { title: LText; description: LText }[];
  testimonials: { name: LText; role: LText; text: LText }[];
  faq: { q: LText; a: LText }[];
  seoKeywords: string;
  finished: { title: LText; description: LText; location: LText }[];
  beforeAfter: { title: LText; description: LText; location: LText }[];
  progress: { title: LText; description: LText; location: LText; steps: LText[] }[];
}

const COMMON_STATS = [
  { value: "15+", label: L("سنة خبرة", "Years of experience") },
  { value: "1200+", label: L("مشروع منجز", "Projects completed") },
  { value: "98%", label: L("عملاء راضون", "Happy clients") },
  { value: "24/7", label: L("دعم ومتابعة", "Support") },
];

const SPECS: Record<Category, CategorySpec> = {
  gypsum: {
    brand: L("ديكورات النخبة", "Elite Decor"),
    tagline: L("جبس بورد وأسقف معلقة بلمسة فنية", "Gypsum board & false ceilings with an artistic touch"),
    heroBadge: L("خبراء الجبس بورد في الكويت", "Kuwait's gypsum board experts"),
    heroTitle: L("أسقف وديكورات جبس بورد تُعيد تعريف الفخامة", "Gypsum ceilings and decor that redefine luxury"),
    heroSubtitle: L(
      "نصمم وننفذ أسقفاً معلقة، إضاءة مخفية، وجدران ديكورية تناسب ذوقك وميزانيتك — من الفكرة حتى التسليم.",
      "We design and build false ceilings, hidden lighting and decorative walls that fit your taste and budget — from idea to handover.",
    ),
    aboutTitle: L("من نحن", "About us"),
    aboutBody: L(
      "فريق كويتي متخصص في تصميم وتنفيذ ديكورات الجبس بورد للمنازل والفلل والمكاتب والمحلات التجارية. نستخدم أجود الخامات ونلتزم بالمواعيد، مع إشراف هندسي كامل على كل مرحلة.",
      "A Kuwaiti team specialised in designing and executing gypsum board decor for homes, villas, offices and shops. We use premium materials, respect deadlines and supervise every stage.",
    ),
    points: [L("تصميم ثلاثي الأبعاد قبل التنفيذ", "3D design before execution"), L("خامات مقاومة للرطوبة والحريق", "Moisture and fire resistant materials"), L("ضمان على التنفيذ", "Workmanship warranty"), L("معاينة مجانية داخل الكويت", "Free site visit across Kuwait")],
    services: [
      { title: L("أسقف معلقة", "False ceilings"), description: L("أسقف جبس بورد بتصاميم عصرية وكلاسيكية مع إضاءة مخفية.", "Modern and classic gypsum ceilings with hidden lighting."), icon: "layers" },
      { title: L("جدران ديكورية", "Decorative walls"), description: L("تكسيات جدارية، أرفف مدمجة، وخلفيات تلفزيون أنيقة.", "Wall cladding, built-in shelves and elegant TV backdrops."), icon: "panel" },
      { title: L("إضاءة مخفية", "Cove lighting"), description: L("شرائط LED وسبوت لايت موزعة باحترافية لإبراز التصميم.", "LED strips and spotlights distributed to highlight the design."), icon: "lamp" },
      { title: L("قواطع جبس", "Gypsum partitions"), description: L("تقسيم المساحات بقواطع خفيفة وعازلة للصوت.", "Divide spaces with light, sound-insulating partitions."), icon: "grid" },
      { title: L("ديكورات كلاسيكية", "Classic mouldings"), description: L("كرانيش وزخارف جبس تناسب المجالس والصالات.", "Cornices and gypsum ornaments for majlis and living rooms."), icon: "crown" },
      { title: L("صيانة وترميم", "Repair & maintenance"), description: L("إصلاح التشققات وإعادة الدهان والتجديد.", "Crack repair, repainting and renovation."), icon: "wrench" },
    ],
    process: [
      { title: L("معاينة مجانية", "Free site visit"), description: L("نزور الموقع ونستمع لأفكارك ونأخذ القياسات.", "We visit, listen to your ideas and take measurements.") },
      { title: L("تصميم وعرض سعر", "Design & quote"), description: L("تصميم ثلاثي الأبعاد مع عرض سعر تفصيلي وواضح.", "3D design with a clear, itemised quote.") },
      { title: L("التنفيذ", "Execution"), description: L("فريق محترف ينفذ بدقة وفي الوقت المحدد.", "A professional crew executes precisely and on time.") },
      { title: L("التسليم والضمان", "Handover & warranty"), description: L("تسليم نظيف مع ضمان على العمل.", "Clean handover backed by a warranty.") },
    ],
    testimonials: [
      { name: L("أبو محمد", "Abu Mohammed"), role: L("فيلا في الجهراء", "Villa in Jahra"), text: L("شغل نظيف والتزام بالموعد، والسقف طلع أحلى من التصميم.", "Clean work, on schedule, and the ceiling came out better than the design.") },
      { name: L("أم عبدالله", "Umm Abdullah"), role: L("شقة في السالمية", "Apartment in Salmiya"), text: L("تعامل راقٍ وأسعار مناسبة، أنصح فيهم.", "Professional service and fair prices. Highly recommended.") },
      { name: L("شركة الأفق", "Horizon Co."), role: L("مكاتب في الشرق", "Offices in Sharq"), text: L("نفذوا أسقف المكاتب كاملة خلال أسبوعين بجودة عالية.", "They finished all our office ceilings in two weeks with excellent quality.") },
    ],
    faq: [
      { q: L("كم يستغرق تنفيذ سقف جبس بورد لغرفة؟", "How long does a room ceiling take?"), a: L("عادة من يومين إلى أربعة أيام حسب التصميم.", "Usually two to four days depending on the design.") },
      { q: L("هل المعاينة مجانية؟", "Is the site visit free?"), a: L("نعم، المعاينة وأخذ القياسات مجانية داخل الكويت.", "Yes, visits and measurements are free across Kuwait.") },
      { q: L("هل تقدمون تصميماً قبل التنفيذ؟", "Do you provide a design before execution?"), a: L("نعم، نقدم تصميماً ثلاثي الأبعاد لاعتماده قبل البدء.", "Yes, a 3D design is provided for approval before starting.") },
      { q: L("هل يوجد ضمان؟", "Is there a warranty?"), a: L("نعم، ضمان على التنفيذ ضد التشققات وعيوب التركيب.", "Yes, workmanship warranty against cracks and installation defects.") },
    ],
    seoKeywords: "جبس بورد الكويت, أسقف معلقة, ديكور جبس, gypsum board Kuwait",
    finished: [
      { title: L("سقف مجلس فاخر", "Luxury majlis ceiling"), description: L("سقف معلق بطبقتين مع إضاءة LED مخفية وكرانيش ذهبية.", "Two-tier false ceiling with hidden LED lighting and gold cornices."), location: L("الجهراء", "Jahra") },
      { title: L("صالة معيشة عصرية", "Modern living room"), description: L("تصميم مستطيلات متداخلة بإضاءة دافئة.", "Nested rectangles design with warm lighting."), location: L("السالمية", "Salmiya") },
      { title: L("غرفة نوم رئيسية", "Master bedroom"), description: L("سقف دائري مع خلفية سرير جبسية مضيئة.", "Round ceiling with an illuminated gypsum headboard wall."), location: L("حولي", "Hawalli") },
      { title: L("مكاتب إدارية", "Executive offices"), description: L("أسقف خطية مع فتحات إضاءة مدمجة.", "Linear ceilings with recessed lighting slots."), location: L("الشرق", "Sharq") },
      { title: L("مطعم", "Restaurant"), description: L("أسقف موجية جريئة تعكس هوية المطعم.", "Bold wave ceilings reflecting the brand identity."), location: L("الكويت", "Kuwait City") },
      { title: L("خلفية تلفزيون", "TV feature wall"), description: L("جدار جبس مع أرفف مدمجة وإضاءة خلفية.", "Gypsum wall with built-in shelves and backlighting."), location: L("الفروانية", "Farwaniya") },
    ],
    beforeAfter: [
      { title: L("تجديد صالة", "Living room makeover"), description: L("من سقف عادي إلى سقف معلق بإضاءة مخفية.", "From a plain ceiling to a false ceiling with hidden lighting."), location: L("مبارك الكبير", "Mubarak Al-Kabeer") },
      { title: L("تجديد مجلس", "Majlis renovation"), description: L("إضافة كرانيش وأعمدة جبسية كلاسيكية.", "Added classic cornices and gypsum columns."), location: L("الأحمدي", "Ahmadi") },
      { title: L("غرفة أطفال", "Kids' room"), description: L("سقف سحابي مرح مع إضاءة ملونة.", "Playful cloud ceiling with coloured lighting."), location: L("الجابرية", "Jabriya") },
    ],
    progress: [
      {
        title: L("فيلا كاملة — مراحل التنفيذ", "Full villa — step by step"),
        description: L("تابع مراحل تنفيذ أسقف فيلا كاملة خلال 10 أيام.", "Follow the execution of a full villa's ceilings over 10 days."),
        location: L("صباح الأحمد", "Sabah Al-Ahmad"),
        steps: [L("اليوم 1: القياس والتخطيط", "Day 1: Measuring & planning"), L("اليوم 2: تركيب الهيكل المعدني", "Day 2: Metal framing"), L("اليوم 4: تثبيت الألواح", "Day 4: Board fixing"), L("اليوم 6: المعجون والتنعيم", "Day 6: Filling & sanding"), L("اليوم 8: الإضاءة", "Day 8: Lighting"), L("اليوم 10: التسليم", "Day 10: Handover")],
      },
      {
        title: L("مكتب — أسبوع واحد", "Office — one week"),
        description: L("تنفيذ أسقف مكتب إداري خلال أسبوع.", "An executive office ceiling delivered in one week."),
        location: L("الشرق", "Sharq"),
        steps: [L("المرحلة 1: التجهيز", "Step 1: Preparation"), L("المرحلة 2: الهيكل", "Step 2: Framing"), L("المرحلة 3: الألواح", "Step 3: Boards"), L("المرحلة 4: التشطيب", "Step 4: Finishing")],
      },
    ],
  },
  aluminum: {
    brand: L("الخليج للألمنيوم", "Gulf Aluminum"),
    tagline: L("أبواب ونوافذ ومطابخ ألمنيوم بجودة أوروبية", "Aluminum doors, windows and kitchens with European quality"),
    heroBadge: L("تصنيع وتركيب داخل الكويت", "Manufactured and installed in Kuwait"),
    heroTitle: L("ألمنيوم يجمع بين المتانة والأناقة", "Aluminum that combines strength and elegance"),
    heroSubtitle: L(
      "نوافذ وأبواب عازلة للحرارة والصوت، مطابخ ألمنيوم، واجهات زجاجية وشترات — تصنيع محلي وتركيب احترافي.",
      "Thermal and acoustic windows and doors, aluminum kitchens, glass facades and shutters — locally made, professionally installed.",
    ),
    aboutTitle: L("عن الشركة", "About the company"),
    aboutBody: L(
      "مصنع ومعرض متخصص في أعمال الألمنيوم والزجاج منذ أكثر من خمسة عشر عاماً. نستورد قطاعات أوروبية وخليجية معتمدة ونصنعها بمقاسات دقيقة لتناسب مشروعك.",
      "A factory and showroom specialised in aluminum and glass works for more than fifteen years. We import certified European and Gulf profiles and fabricate them to precise measurements for your project.",
    ),
    points: [L("قطاعات معتمدة وعازلة", "Certified insulated profiles"), L("زجاج مزدوج ومقسّى", "Double and tempered glass"), L("ألوان وتشطيبات متعددة", "Multiple colours and finishes"), L("ضمان وصيانة", "Warranty and maintenance")],
    services: [
      { title: L("نوافذ وأبواب", "Windows & doors"), description: L("جرارة، مفصلية، وقلاب مع عزل حراري وصوتي.", "Sliding, casement and tilt-turn with thermal and acoustic insulation."), icon: "window" },
      { title: L("مطابخ ألمنيوم", "Aluminum kitchens"), description: L("مطابخ مقاومة للرطوبة بتصاميم عصرية وألوان خشبية.", "Moisture-proof kitchens in modern designs and wood finishes."), icon: "kitchen" },
      { title: L("واجهات زجاجية", "Glass facades"), description: L("واجهات كرتن وول وسبايدر للمباني والمحلات.", "Curtain wall and spider facades for buildings and shops."), icon: "building" },
      { title: L("شترات ومظلات", "Shutters & canopies"), description: L("شتر كهربائي، مظلات سيارات وبرجولات ألمنيوم.", "Electric shutters, car shades and aluminum pergolas."), icon: "sun" },
      { title: L("درابزين وحماية", "Railings & guards"), description: L("درابزين سلالم وبلكونات ألمنيوم وزجاج.", "Aluminum and glass stair and balcony railings."), icon: "shield" },
      { title: L("أبواب مداخل", "Entrance doors"), description: L("أبواب رئيسية فخمة بتصاميم مخصصة.", "Premium main doors in custom designs."), icon: "door" },
    ],
    process: [
      { title: L("قياس بالموقع", "On-site measurement"), description: L("قياس دقيق مجاني ومناقشة الخيارات.", "Free precise measurement and options discussion.") },
      { title: L("اختيار القطاع واللون", "Profile & colour"), description: L("عينات حقيقية للقطاعات والزجاج والألوان.", "Real samples of profiles, glass and colours.") },
      { title: L("التصنيع", "Fabrication"), description: L("تصنيع في مصنعنا بمعدات حديثة.", "Fabricated in our factory with modern machinery.") },
      { title: L("التركيب", "Installation"), description: L("تركيب سريع ونظيف مع اختبار العزل.", "Fast, clean installation with insulation testing.") },
    ],
    testimonials: [
      { name: L("م. خالد", "Eng. Khaled"), role: L("مقاول", "Contractor"), text: L("نتعامل معهم في كل مشاريعنا، دقة في المقاسات والمواعيد.", "We use them on all our projects; precise sizes and on-time delivery.") },
      { name: L("أم سعود", "Umm Saud"), role: L("فيلا في الرقة", "Villa in Riqqa"), text: L("النوافذ عزلت الصوت والحر بشكل ممتاز.", "The windows block noise and heat perfectly.") },
      { name: L("مطعم لافندر", "Lavender Restaurant"), role: L("واجهة زجاجية", "Glass facade"), text: L("الواجهة غيرت شكل المطعم بالكامل.", "The facade completely transformed the restaurant.") },
    ],
    faq: [
      { q: L("ما الفرق بين القطاع العادي والعازل؟", "What is the difference between regular and thermal-break profiles?"), a: L("القطاع العازل يحتوي على فاصل حراري يقلل انتقال الحرارة ويوفر في التكييف.", "Thermal-break profiles include an insulating barrier that reduces heat transfer and saves on cooling.") },
      { q: L("كم مدة التصنيع والتركيب؟", "How long do fabrication and installation take?"), a: L("من 7 إلى 14 يوماً حسب حجم المشروع.", "Between 7 and 14 days depending on project size.") },
      { q: L("هل تقدمون مطابخ بلون الخشب؟", "Do you offer wood-look kitchens?"), a: L("نعم، ألوان خشبية متعددة بطلاء إلكتروستاتيك.", "Yes, several wood colours with electrostatic coating.") },
      { q: L("هل يوجد ضمان؟", "Is there a warranty?"), a: L("ضمان على القطاعات والتركيب والإكسسوارات.", "Warranty on profiles, installation and accessories.") },
    ],
    seoKeywords: "ألمنيوم الكويت, نوافذ ألمنيوم, مطابخ ألمنيوم, aluminum Kuwait",
    finished: [
      { title: L("واجهة زجاجية لمبنى تجاري", "Commercial glass facade"), description: L("كرتن وول بزجاج عاكس مزدوج.", "Curtain wall with double reflective glass."), location: L("الكويت", "Kuwait City") },
      { title: L("مطبخ ألمنيوم خشبي", "Wood-finish aluminum kitchen"), description: L("مطبخ بلون خشب الجوز مع رخام صناعي.", "Walnut-finish kitchen with engineered marble."), location: L("الفردوس", "Firdous") },
      { title: L("نوافذ فيلا كاملة", "Full villa windows"), description: L("60 نافذة عازلة بلون رمادي مطفي.", "60 insulated windows in matte grey."), location: L("الوفرة", "Wafra") },
      { title: L("باب مدخل رئيسي", "Main entrance door"), description: L("باب دوّار بارتفاع 3 أمتار.", "A 3-metre pivot door."), location: L("الزهراء", "Zahra") },
      { title: L("درابزين زجاجي", "Glass railing"), description: L("درابزين بلكونات بزجاج مقسى 12 مم.", "Balcony railings with 12 mm tempered glass."), location: L("سلوى", "Salwa") },
      { title: L("مظلة سيارات", "Car canopy"), description: L("مظلة ألمنيوم وبولي كربونيت لسيارتين.", "Aluminum and polycarbonate canopy for two cars."), location: L("العدان", "Adan") },
    ],
    beforeAfter: [
      { title: L("استبدال نوافذ خشبية قديمة", "Replacing old wooden windows"), description: L("نوافذ عازلة حديثة بدل الخشب المتهالك.", "Modern insulated windows instead of worn wood."), location: L("القادسية", "Qadsiya") },
      { title: L("تجديد واجهة محل", "Shopfront renovation"), description: L("واجهة زجاجية كاملة مع باب أوتوماتيك.", "Full glass frontage with an automatic door."), location: L("حولي", "Hawalli") },
      { title: L("مطبخ خشبي إلى ألمنيوم", "Wood to aluminum kitchen"), description: L("مطبخ جديد مقاوم للرطوبة.", "A new moisture-resistant kitchen."), location: L("خيطان", "Khaitan") },
    ],
    progress: [
      {
        title: L("واجهة مبنى — مراحل التركيب", "Building facade — installation stages"),
        description: L("تركيب واجهة كرتن وول خلال 3 أسابيع.", "Curtain wall installation over 3 weeks."),
        location: L("شرق", "Sharq"),
        steps: [L("الأسبوع 1: الهيكل", "Week 1: Structure"), L("الأسبوع 2: القطاعات", "Week 2: Profiles"), L("الأسبوع 2: الزجاج", "Week 2: Glazing"), L("الأسبوع 3: السيليكون والتنظيف", "Week 3: Sealing & cleaning"), L("التسليم", "Handover")],
      },
      {
        title: L("مطبخ — من القياس للتركيب", "Kitchen — measure to install"),
        description: L("تصنيع وتركيب مطبخ خلال 10 أيام.", "Kitchen fabricated and installed in 10 days."),
        location: L("الجابرية", "Jabriya"),
        steps: [L("القياس", "Measuring"), L("التصنيع", "Fabrication"), L("التركيب", "Installation"), L("التسليم", "Handover")],
      },
    ],
  },
  partition: {
    brand: L("سبيس ديفايد", "SpaceDivide"),
    tagline: L("قواطع مكاتب وزجاج وحلول تقسيم المساحات", "Office partitions, glass walls and space division solutions"),
    heroBadge: L("حلول ذكية للمكاتب والمنازل", "Smart solutions for offices and homes"),
    heroTitle: L("قواطع تمنح مساحتك شكلاً جديداً", "Partitions that give your space a new shape"),
    heroSubtitle: L(
      "بارتيشن زجاجي، خشبي، ألمنيوم وجبس — عازل للصوت وسهل التركيب، بتصاميم تناسب المكاتب والعيادات والمنازل.",
      "Glass, wood, aluminum and gypsum partitions — sound insulating, quick to install, designed for offices, clinics and homes.",
    ),
    aboutTitle: L("من نحن", "Who we are"),
    aboutBody: L(
      "متخصصون في تصميم وتركيب القواطع والبارتيشن بجميع أنواعها في الكويت. نساعد الشركات على استغلال مساحاتها بذكاء مع الحفاظ على الخصوصية والإضاءة الطبيعية.",
      "Specialists in designing and installing all kinds of partitions in Kuwait. We help companies use their space smartly while keeping privacy and natural light.",
    ),
    points: [L("عزل صوتي عالي", "High acoustic insulation"), L("تركيب بدون فوضى", "Mess-free installation"), L("زجاج مقسى وأفلام خصوصية", "Tempered glass and privacy films"), L("قابلة للفك وإعادة التركيب", "Demountable and reusable")],
    services: [
      { title: L("قواطع زجاجية", "Glass partitions"), description: L("زجاج مقسى بإطار ألمنيوم أو بدون إطار مع أبواب.", "Tempered glass with aluminum or frameless systems and doors."), icon: "glass" },
      { title: L("قواطع مكاتب", "Office partitions"), description: L("أنظمة مكاتب مفتوحة وكبائن عمل.", "Open-plan systems and workstations."), icon: "office" },
      { title: L("جدران متحركة", "Movable walls"), description: L("جدران قابلة للطي لقاعات الاجتماعات والمطاعم.", "Folding walls for meeting rooms and restaurants."), icon: "move" },
      { title: L("ألواح صوتية", "Acoustic panels"), description: L("ألواح امتصاص الصوت بألوان وخامات متنوعة.", "Sound absorbing panels in many colours and materials."), icon: "sound" },
      { title: L("قواطع جبس", "Gypsum partitions"), description: L("جدران جبس بورد عازلة ومقاومة للرطوبة.", "Insulated, moisture-resistant gypsum walls."), icon: "wall" },
      { title: L("أفلام وتزيين الزجاج", "Glass films & branding"), description: L("أفلام فروستد وطباعة هوية الشركة على الزجاج.", "Frosted films and company branding on glass."), icon: "sticker" },
    ],
    process: [
      { title: L("زيارة ومسح المكان", "Site survey"), description: L("نقيس المساحة ونفهم احتياج الفريق.", "We measure the space and understand your team's needs.") },
      { title: L("مخطط وعرض سعر", "Layout & quote"), description: L("مخطط توزيع مع عرض سعر تفصيلي.", "A layout plan with an itemised quote.") },
      { title: L("التصنيع والتركيب", "Fabrication & install"), description: L("تركيب سريع خارج أوقات الدوام إن لزم.", "Fast installation, after hours if needed.") },
      { title: L("التسليم", "Handover"), description: L("تسليم نظيف وتدريب على الاستخدام.", "Clean handover with usage guidance.") },
    ],
    testimonials: [
      { name: L("شركة نور للاستشارات", "Noor Consulting"), role: L("مكاتب", "Offices"), text: L("قسموا مكتبنا المفتوح خلال يومين بدون تعطيل العمل.", "They divided our open office in two days without disrupting work.") },
      { name: L("عيادة الشفاء", "Al Shifa Clinic"), role: L("عيادة", "Clinic"), text: L("قواطع زجاجية أنيقة ومعزولة للصوت.", "Elegant, sound-insulated glass partitions.") },
      { name: L("أبو فهد", "Abu Fahad"), role: L("منزل", "Home"), text: L("فصلوا الصالة عن المجلس بجدار متحرك رائع.", "They separated the living room from the majlis with a great movable wall.") },
    ],
    faq: [
      { q: L("هل يمكن فك القواطع ونقلها؟", "Can the partitions be removed and relocated?"), a: L("نعم، أنظمة القواطع لدينا قابلة للفك وإعادة التركيب.", "Yes, our systems are demountable and reusable.") },
      { q: L("ما مستوى العزل الصوتي؟", "What is the acoustic rating?"), a: L("حتى 45 ديسيبل حسب النظام والزجاج.", "Up to 45 dB depending on the system and glass.") },
      { q: L("هل التركيب يعطل الدوام؟", "Does installation disrupt work?"), a: L("يمكننا التركيب مساءً أو في العطلة.", "We can install evenings or on weekends.") },
      { q: L("هل تطبعون شعار الشركة على الزجاج؟", "Can you print our logo on the glass?"), a: L("نعم، أفلام مطبوعة وفروستد بالتصميم الذي تريده.", "Yes, printed and frosted films in any design.") },
    ],
    seoKeywords: "بارتيشن الكويت, قواطع زجاجية, قواطع مكاتب, office partitions Kuwait",
    finished: [
      { title: L("مكاتب شركة تقنية", "Tech company offices"), description: L("قواطع زجاجية بإطار أسود مع غرف اجتماعات.", "Black-framed glass partitions with meeting rooms."), location: L("الكويت", "Kuwait City") },
      { title: L("عيادة أسنان", "Dental clinic"), description: L("قواطع فروستد للخصوصية مع أبواب جرارة.", "Frosted partitions for privacy with sliding doors."), location: L("السالمية", "Salmiya") },
      { title: L("قاعة اجتماعات متحركة", "Movable meeting hall"), description: L("جدار قابل للطي يقسم القاعة لثلاث غرف.", "A folding wall that divides the hall into three rooms."), location: L("الشويخ", "Shuwaikh") },
      { title: L("مساحة عمل مشتركة", "Co-working space"), description: L("كبائن عمل وألواح صوتية ملونة.", "Workstations and colourful acoustic panels."), location: L("حولي", "Hawalli") },
      { title: L("فصل مجلس عن صالة", "Majlis divider"), description: L("قاطع خشبي مشغول بنقوش خليجية.", "A carved wooden divider with Gulf motifs."), location: L("الرميثية", "Rumaithiya") },
      { title: L("مكتب استقبال", "Reception office"), description: L("زجاج منحني مع إضاءة مدمجة.", "Curved glass with integrated lighting."), location: L("الفحيحيل", "Fahaheel") },
    ],
    beforeAfter: [
      { title: L("مكتب مفتوح إلى غرف", "Open office to rooms"), description: L("تقسيم مساحة 200 م² إلى 6 مكاتب.", "A 200 m² space divided into 6 offices."), location: L("الشرق", "Sharq") },
      { title: L("تجديد عيادة", "Clinic renovation"), description: L("قواطع جبس وزجاج مع عزل صوتي.", "Gypsum and glass partitions with acoustic insulation."), location: L("الجابرية", "Jabriya") },
      { title: L("محل تجاري", "Retail shop"), description: L("غرفة قياس وقسم للمخزن.", "Fitting room and storage area."), location: L("الفروانية", "Farwaniya") },
    ],
    progress: [
      {
        title: L("مكاتب شركة — 5 أيام", "Company offices — 5 days"),
        description: L("تركيب قواطع زجاجية لطابق كامل خلال خمسة أيام.", "Glass partitions for a whole floor in five days."),
        location: L("الكويت", "Kuwait City"),
        steps: [L("اليوم 1: التخطيط", "Day 1: Layout"), L("اليوم 2: الإطارات", "Day 2: Frames"), L("اليوم 3: الزجاج", "Day 3: Glazing"), L("اليوم 4: الأبواب", "Day 4: Doors"), L("اليوم 5: التسليم", "Day 5: Handover")],
      },
      {
        title: L("جدار متحرك لقاعة", "Movable wall for a hall"),
        description: L("مراحل تركيب جدار قابل للطي.", "Installation stages of a folding wall."),
        location: L("المنقف", "Mangaf"),
        steps: [L("المسار العلوي", "Top track"), L("الألواح", "Panels"), L("الضبط والاختبار", "Adjustment & testing"), L("التسليم", "Handover")],
      },
    ],
  },
  ceramic: {
    brand: L("بيت السيراميك", "Ceramic House"),
    tagline: L("سيراميك وبورسلان وتركيب باحترافية", "Ceramic, porcelain and professional installation"),
    heroBadge: L("أفخم التشكيلات الإيطالية والإسبانية", "Finest Italian and Spanish collections"),
    heroTitle: L("أرضيات وجدران تليق بذوقك", "Floors and walls worthy of your taste"),
    heroSubtitle: L(
      "توريد وتركيب السيراميك والبورسلان والرخام لجميع المساحات — حمامات، مطابخ، صالات وواجهات — بأيدي فنيين محترفين.",
      "Supply and installation of ceramic, porcelain and marble for every space — bathrooms, kitchens, living rooms and facades — by professional installers.",
    ),
    aboutTitle: L("من نحن", "About us"),
    aboutBody: L(
      "معرض ومركز تركيب متخصص في السيراميك والبورسلان في الكويت. نوفر تشكيلات واسعة بأحجام كبيرة وتصاميم رخامية وخشبية، مع فريق تركيب يضمن التسوية والفواصل المثالية.",
      "A showroom and installation centre specialised in ceramic and porcelain in Kuwait. We stock wide collections in large formats, marble and wood looks, with an installation team that guarantees perfect levelling and grouting.",
    ),
    points: [L("بورسلان بأحجام كبيرة حتى 120×240", "Large formats up to 120×240"), L("تركيب بنظام التسوية الحديث", "Modern levelling system installation"), L("مواد لاصقة ومونة عالية الجودة", "High quality adhesives and grout"), L("ضمان على التركيب", "Installation warranty")],
    services: [
      { title: L("أرضيات بورسلان", "Porcelain floors"), description: L("بورسلان لامع ومطفي بتصاميم رخامية.", "Polished and matte porcelain in marble designs."), icon: "floor" },
      { title: L("حمامات", "Bathrooms"), description: L("تركيب سيراميك الحمامات مع العزل والميول.", "Bathroom tiling with waterproofing and slopes."), icon: "bath" },
      { title: L("مطابخ", "Kitchens"), description: L("جدران وأرضيات مطابخ مقاومة للبقع.", "Stain-resistant kitchen walls and floors."), icon: "kitchen" },
      { title: L("واجهات خارجية", "Exterior facades"), description: L("حجر وسيراميك مقاوم للحرارة للواجهات.", "Heat-resistant stone and ceramic for facades."), icon: "building" },
      { title: L("رخام وجرانيت", "Marble & granite"), description: L("توريد وتركيب الرخام الطبيعي.", "Supply and installation of natural marble."), icon: "gem" },
      { title: L("صيانة وتلميع", "Repair & polishing"), description: L("استبدال البلاط التالف وتلميع الأرضيات.", "Damaged tile replacement and floor polishing."), icon: "sparkle" },
    ],
    process: [
      { title: L("اختيار من المعرض", "Choose at the showroom"), description: L("عينات حقيقية ومساعدة في التنسيق.", "Real samples and help with coordination.") },
      { title: L("قياس وحساب الكميات", "Measure & quantities"), description: L("قياس دقيق لتقليل الهدر.", "Precise measurement to reduce waste.") },
      { title: L("التوريد والتركيب", "Supply & install"), description: L("فريق تركيب محترف بأدوات تسوية حديثة.", "Professional crew with modern levelling tools.") },
      { title: L("التنظيف والتسليم", "Clean & handover"), description: L("تنظيف الفواصل وتسليم جاهز للاستخدام.", "Grout cleaning and ready-to-use handover.") },
    ],
    testimonials: [
      { name: L("أبو يوسف", "Abu Yousef"), role: L("فيلا في الصباحية", "Villa in Sabahiya"), text: L("أرضية البورسلان طلعت مثل الرخام الطبيعي بالضبط.", "The porcelain floor looks exactly like natural marble.") },
      { name: L("أم لولوة", "Umm Lulwa"), role: L("حمامات", "Bathrooms"), text: L("تركيب متقن وفواصل نظيفة جداً.", "Meticulous installation and very clean grout lines.") },
      { name: L("مقاولات الديرة", "Al Deera Contracting"), role: L("مشروع سكني", "Residential project"), text: L("وردوا وركبوا 40 شقة في الوقت المحدد.", "They supplied and tiled 40 apartments on schedule.") },
    ],
    faq: [
      { q: L("ما الفرق بين السيراميك والبورسلان؟", "What is the difference between ceramic and porcelain?"), a: L("البورسلان أكثر صلابة وأقل امتصاصاً للماء ويناسب الأرضيات.", "Porcelain is harder and absorbs less water, ideal for floors.") },
      { q: L("هل تقدمون التركيب فقط؟", "Do you offer installation only?"), a: L("نعم، نركب البلاط الموجود لديك أيضاً.", "Yes, we also install tiles you already have.") },
      { q: L("كم يستغرق تركيب حمام؟", "How long does a bathroom take?"), a: L("من 3 إلى 5 أيام مع العزل.", "Three to five days including waterproofing.") },
      { q: L("هل يوجد ضمان على التركيب؟", "Is installation guaranteed?"), a: L("نعم، ضمان ضد التفريغ والتشقق.", "Yes, against hollowness and cracking.") },
    ],
    seoKeywords: "سيراميك الكويت, بورسلان, تركيب سيراميك, ceramic tiles Kuwait",
    finished: [
      { title: L("حمام رئيسي رخامي", "Marble-look master bath"), description: L("بورسلان 120×60 بتصميم كالاكاتا.", "120×60 porcelain in Calacatta design."), location: L("الصباحية", "Sabahiya") },
      { title: L("صالة فيلا", "Villa living room"), description: L("أرضية بورسلان لامع بأحجام كبيرة.", "Large-format polished porcelain floor."), location: L("مشرف", "Mishref") },
      { title: L("مطبخ عصري", "Modern kitchen"), description: L("جدران سيراميك سابواي وأرضية خشبية.", "Subway-tile walls with wood-look floor."), location: L("بيان", "Bayan") },
      { title: L("واجهة فيلا", "Villa facade"), description: L("حجر طبيعي وبورسلان خارجي.", "Natural stone with exterior porcelain."), location: L("أبو فطيرة", "Abu Fatira") },
      { title: L("مسبح", "Swimming pool"), description: L("موزاييك زجاجي أزرق مع درجات.", "Blue glass mosaic with steps."), location: L("الخيران", "Khiran") },
      { title: L("مدخل عمارة", "Building lobby"), description: L("رخام طبيعي مع تطعيم نحاسي.", "Natural marble with brass inlays."), location: L("الكويت", "Kuwait City") },
    ],
    beforeAfter: [
      { title: L("تجديد حمام قديم", "Old bathroom renovation"), description: L("من بلاط قديم إلى بورسلان فاخر.", "From old tiles to luxury porcelain."), location: L("حولي", "Hawalli") },
      { title: L("أرضية صالة", "Living room floor"), description: L("استبدال الموكيت ببورسلان رخامي.", "Carpet replaced with marble-look porcelain."), location: L("السالمية", "Salmiya") },
      { title: L("مطبخ", "Kitchen"), description: L("جدران وأرضية جديدة بالكامل.", "Completely new walls and floor."), location: L("الفروانية", "Farwaniya") },
    ],
    progress: [
      {
        title: L("فيلا كاملة — 3 أسابيع", "Full villa — 3 weeks"),
        description: L("تركيب 600 م² من البورسلان خلال ثلاثة أسابيع.", "600 m² of porcelain installed in three weeks."),
        location: L("صباح السالم", "Sabah Al-Salem"),
        steps: [L("الأسبوع 1: التجهيز والعزل", "Week 1: Prep & waterproofing"), L("الأسبوع 1: الأرضيات", "Week 1: Floors"), L("الأسبوع 2: الجدران", "Week 2: Walls"), L("الأسبوع 3: الفواصل", "Week 3: Grouting"), L("التنظيف والتسليم", "Cleaning & handover")],
      },
      {
        title: L("حمام — 5 أيام", "Bathroom — 5 days"),
        description: L("مراحل تجديد حمام يوماً بيوم.", "A bathroom renovation day by day."),
        location: L("الجابرية", "Jabriya"),
        steps: [L("اليوم 1: الإزالة", "Day 1: Demolition"), L("اليوم 2: العزل", "Day 2: Waterproofing"), L("اليوم 3: الأرضية", "Day 3: Floor"), L("اليوم 4: الجدران", "Day 4: Walls"), L("اليوم 5: التسليم", "Day 5: Handover")],
      },
    ],
  },
};

export function demoContent(category: Category): SiteContent {
  const s = SPECS[category];
  const img = IMAGES[category];
  // `settings` is loosened to a partial: the demo only has an opinion about a few of those flags, and
  // the rest have to keep coming from `emptyContent()` as fields are added to the union.
  const partial: Omit<Partial<SiteContent>, "settings"> & { settings: Partial<SiteContent["settings"]> } = {
    brand: { name: s.brand, tagline: s.tagline, logoUrl: "" },
    contact: {
      // Placeholder contact details are the one thing that must never survive onto a live site: a wrong
      // number or an `info@example.com` mailto is a broken promise to whoever clicks it. The number is
      // overwritten with the operator's at provision time and is here only so the previews have a link
      // to render; the email has no such override, so the demo carries none at all.
      whatsapp: "96550000000",
      phone: "96550000000",
      email: "",
      address: L("الكويت — الشويخ الصناعية، قطعة 3", "Kuwait — Shuwaikh Industrial, Block 3"),
      hours: L("السبت - الخميس: 9 صباحاً - 9 مساءً", "Sat - Thu: 9 AM - 9 PM"),
      mapEmbedUrl: "",
      whatsappMessage: { ar: "مرحباً، رقم الزائر: {id}\nأرغب في الاستفسار عن خدماتكم.", en: "Hello, my visitor ID: {id}\nI would like to ask about your services." },
      title: L("تواصل معنا", "Contact us"),
      subtitle: L("زيارة مجانية للمعاينة وعرض سعر خلال 24 ساعة", "Free site visit and a quote within 24 hours"),
    },
    socials: { instagram: "https://instagram.com/", tiktok: "https://tiktok.com/", snapchat: "https://snapchat.com/", facebook: "", x: "", youtube: "" },
    hero: {
      badge: s.heroBadge,
      title: s.heroTitle,
      subtitle: s.heroSubtitle,
      imageUrl: img[0],
      images: [sized(img[1], 900), sized(img[2], 900), sized(img[3], 900)],
      videoUrl: "",
      primaryCta: L("تواصل واتساب", "WhatsApp us"),
      secondaryCta: L("شاهد أعمالنا", "See our work"),
    },
    about: { title: s.aboutTitle, body: s.aboutBody, imageUrl: img[4], points: s.points },
    stats: COMMON_STATS.map((st, i) => ({ id: `stat-${i}`, ...st })),
    services: {
      title: L("خدماتنا", "Our services"),
      subtitle: L("كل ما تحتاجه في مكان واحد", "Everything you need in one place"),
      items: s.services.map((sv, i) => ({ id: `svc-${i}`, title: sv.title, description: sv.description, icon: sv.icon, imageUrl: sized(img[(i + 5) % img.length], 800) })),
    },
    process: { title: L("كيف نعمل", "How we work"), subtitle: L("أربع خطوات بسيطة", "Four simple steps"), steps: s.process.map((p, i) => ({ id: `step-${i}`, ...p })) },
    projects: {
      title: L("أعمالنا", "Our work"),
      subtitle: L("نماذج من مشاريعنا المنفذة", "A selection of completed projects"),
      finished: { enabled: true, title: L("مشاريع منجزة", "Finished projects"), subtitle: L("صور وفيديو من مشاريع سلمناها", "Photos and video from delivered projects") },
      beforeAfter: { enabled: true, title: L("قبل وبعد", "Before & after"), subtitle: L("اسحب لترى الفرق", "Drag to see the difference") },
      progress: { enabled: true, title: L("مراحل التنفيذ", "Work in progress"), subtitle: L("تابع المشروع خطوة بخطوة", "Follow the project step by step") },
    },
    testimonials: { title: L("آراء عملائنا", "What clients say"), subtitle: L("ثقة عملائنا هي أساس نجاحنا", "Our clients' trust is our success"), items: s.testimonials.map((t, i) => ({ id: `t-${i}`, ...t, rating: 5 })) },
    faq: { title: L("الأسئلة الشائعة", "Frequently asked questions"), subtitle: L("إجابات على أكثر ما يسأله عملاؤنا", "Answers to what clients ask most"), items: s.faq.map((f, i) => ({ id: `faq-${i}`, ...f })) },
    cta: { title: L("جاهز لتبدأ مشروعك؟", "Ready to start your project?"), subtitle: L("تواصل معنا الآن واحصل على معاينة مجانية وعرض سعر خلال 24 ساعة.", "Contact us now for a free site visit and a quote within 24 hours."), buttonText: L("تواصل واتساب", "WhatsApp us"), eyebrow: L("اطلب عرض سعر", "Get a quote") },
    seo: { title: s.brand, description: s.tagline, ogImageUrl: img[0], keywords: s.seoKeywords },
    theme: {},
    sections: { about: true, services: true, stats: true, process: true, testimonials: true, faq: true, cta: true, order: [] },
    // `demo: true` is what makes the fabricated parts of this content legal to store: provisioning
    // refuses to write invented testimonials to a site without it. Showcase sites are also noindexed.
    settings: { defaultLocale: "ar", showLangToggle: true, floatingWhatsapp: true, signalMode: "source", demo: true },
  };
  return deepMerge(emptyContent(), partial);
}

function media(kind: "image" | "video", url: string, role: MediaItem["role"], order: number, extra: Partial<MediaItem> = {}): MediaItem {
  return { id: `m-${role}-${order}-${Math.abs(hash(url + order))}`, kind, url, role, order, ...extra };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Showcase projects for one trade.
 *
 * Every media item is an image. There used to be a video here, hotlinked from a third-party test-asset
 * host (`test-videos.co.uk`, Big Buck Bunny) — a customer portfolio that played someone else's cartoon,
 * with nothing to fall back to the day that host 404s or rate-limits. The demo makes its point with
 * stills, and the video path stays covered by the render tests with a local fixture instead.
 */
export function demoProjects(category: Category): Project[] {
  const s = SPECS[category];
  const img = IMAGES[category];
  const out: Project[] = [];
  s.finished.forEach((p, i) => {
    const base = (i * 3) % img.length;
    const m: MediaItem[] = [
      media("image", img[base], "gallery", 0),
      media("image", img[(base + 1) % img.length], "gallery", 1),
      media("image", img[(base + 2) % img.length], "gallery", 2),
    ];
    out.push({ id: `fin-${i}`, slug: demoSlug(p.title.en, `finished-${i + 1}`), type: "finished", title: p.title, description: p.description, location: p.location, coverUrl: sized(img[base], 1000), published: true, order: i, media: m });
  });
  s.beforeAfter.forEach((p, i) => {
    const before = img[(i * 2 + 7) % img.length];
    const after = img[(i * 2 + 1) % img.length];
    out.push({
      id: `ba-${i}`,
      slug: demoSlug(p.title.en, `before-after-${i + 1}`),
      type: "before_after",
      title: p.title,
      description: p.description,
      location: p.location,
      coverUrl: after,
      published: true,
      order: i,
      media: [media("image", before, "before", 0), media("image", after, "after", 1)],
    });
  });
  s.progress.forEach((p, i) => {
    const m: MediaItem[] = p.steps.map((label, j) => {
      const day = new Date(Date.UTC(2025, 0, 6 + j * 2));
      return media("image", img[(i * 4 + j + 3) % img.length], "step", j, {
        stepLabel: label,
        stepDate: day.toISOString().slice(0, 10),
      });
    });
    out.push({ id: `prog-${i}`, slug: demoSlug(p.title.en, `progress-${i + 1}`), type: "progress", title: p.title, description: p.description, location: p.location, coverUrl: m[0].url, published: true, order: i, media: m });
  });
  // Two projects in one trade can share an English title; the slug is what the URL is keyed on, so a
  // collision would make one of them unreachable in the preview.
  const seen = new Set<string>();
  for (const p of out) {
    let slug = p.slug;
    for (let n = 2; seen.has(slug); n++) slug = `${p.slug}-${n}`;
    p.slug = slug;
    seen.add(slug);
  }
  return out;
}

export function demoSiteName(category: Category): LText {
  return SPECS[category].brand;
}
