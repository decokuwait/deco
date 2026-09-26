/** Kuwait's six governorates, in the order people list them. Used by the request form's area picker. */
export const KUWAIT_AREAS = ["العاصمة", "حولي", "الفروانية", "الأحمدي", "الجهراء", "مبارك الكبير"] as const;

/**
 * Meta description and social title for the two commercial pages.
 *
 * Kept here rather than inline so `/` and `/pricing` cannot disagree about what this product is, and so the
 * one English string that used to describe the home page ("Multi-site platform for Kuwaiti decor
 * businesses") can never come back: the person searching for this types Arabic.
 */
export const SITE_PITCH = {
  title: "مواقع جاهزة لشركات الديكور في الكويت",
  description:
    "موقع احترافي لشركة الجبس بورد أو الألمنيوم أو البارتيشن أو السيراميك، يعرض مشاريعك وصور «قبل وبعد» ويوصل العميل لك على الواتساب مباشرة. اشتراك سنوي واضح يبدأ من ١٥٠ د.ك، ولوحة تحكم تديرها من جوالك.",
} as const;

/** The three steps between "I found this page" and "my site is live", written the way it actually happens. */
export const HOW_IT_WORKS: { title: string; body: string }[] = [
  {
    title: "١ · ترسل طلبك",
    body: "اسمك ورقم واتساب ونوع شغلك. نرد عليك على الواتساب، نسألك عن أعمالك ونتفق على الباقة والقالب المناسب.",
  },
  {
    title: "٢ · نجهّز الموقع",
    body: "ترسل صور مشاريعك وشعارك وبيانات التواصل. نرتّبها في القالب ونعطيك رابط تجربة تشوفه قبل أي دفعة.",
  },
  {
    title: "٣ · ينطلق الموقع",
    body: "بعد موافقتك يُنشر الموقع على نطاقك، ونسلّمك لوحة التحكم لتضيف المشاريع وتعدّل المحتوى بنفسك وقت ما تحب.",
  },
];

/** Answers to the four things every contractor asks in the first WhatsApp message. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "كم ياخذ وقت لين يجهز الموقع؟",
    a: "عادةً من ٣ إلى ٧ أيام عمل بعد ما تصلنا الصور والمعلومات. أطول جزء دائماً هو تجميع صور المشاريع، والباقي عندنا.",
  },
  {
    q: "أقدر أعدّل المحتوى بنفسي؟",
    a: "نعم. لوحة التحكم تشتغل من الجوال: تضيف مشروعاً بصوره، تغيّر النصوص والألوان، وتتابع الزوار. ما تحتاج تتصل فينا لكل تعديل.",
  },
  {
    q: "النطاق باسم الشركة (.com) داخل في السعر؟",
    a: "النطاق الفرعي داخل في كل الباقات. النطاق الخاص متاح من الباقة الاحترافية، ويُسجَّل باسمك أنت لدى مزود النطاق ورسومه السنوية تدفعها له مباشرة — حتى يبقى ملكك لو انتهى اشتراكك معنا.",
  },
  {
    q: "هل تضمنون لي عملاء أو ترتيب في جوجل؟",
    a: "لا. ما نقدر نضمن عدد اتصالات ولا ترتيباً معيناً، وأي أحد يضمن لك هذا يبيع لك كلاماً. اللي نقدمه موقع سريع ومرتب يعرض شغلك بشكل محترم، ويسهّل على اللي شافك أنه يوصلك.",
  },
];
