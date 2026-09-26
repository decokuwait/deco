import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { APP_NAME } from "@/lib/config";
import { TEMPLATES, templatesFor } from "@/templates/registry";
import { cycleLabel, formatFils, planCatalog, setupFeeFils, yearlySavingFils } from "@/lib/billing";
import { submitLeadAction } from "../actions";
import { KUWAIT_AREAS } from "../_lib/copy";

/**
 * The public, commercial face of the platform: the chrome, the price table, the proof and the request form,
 * shared by `/` and `/pricing` so the two pages cannot drift apart on price or on what is promised.
 *
 * Everything here is Arabic. The tenant sites are bilingual because their visitors are; this is a sales page
 * aimed at one person — a decor contractor in Kuwait — and writing it in two languages would make it read
 * like a brochure translated from somewhere else, which is the opposite of what wins this customer.
 */

export function MarketingHeader({ active }: { active?: "home" | "pricing" }) {
  const link = (href: string, label: string, key: "home" | "pricing") => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 transition sm:px-3 ${active === key ? "bg-white/15 text-white" : "text-white/75 hover:text-white"}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="min-w-0 shrink truncate text-lg font-black tracking-tight sm:text-xl">
          {APP_NAME}
        </Link>
        {/* The row is brand + four controls, which does not fit a 390px phone: the CTA — the one
            conversion action on the page — was pushed 35px off the inline start edge. The two secondary
            links step aside on a phone (both are in the footer, and "home" is what the brand already is),
            and the CTA can never shrink or wrap. */}
        <nav className="flex min-w-0 items-center gap-0.5 text-sm font-bold sm:gap-1">
          <span className="hidden sm:contents">{link("/", "الرئيسية", "home")}</span>
          {link("/pricing", "الأسعار", "pricing")}
          <Link href="/templates" className="hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-white/75 transition hover:text-white min-[420px]:inline-block sm:px-3">
            القوالب
          </Link>
          <a href="#request" className="ms-1 shrink-0 whitespace-nowrap rounded-full bg-amber-400 px-3 py-2 text-black transition hover:bg-amber-300 sm:px-4">
            اطلب موقعك
          </a>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#070d19]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {APP_NAME} — مواقع جاهزة لشركات الديكور في الكويت. {TEMPLATES.length} قالباً في أربعة أقسام.
        </p>
        <nav className="flex flex-wrap gap-4 font-bold">
          <Link href="/pricing" className="hover:text-white">
            الأسعار والشروط
          </Link>
          <Link href="/templates" className="hover:text-white">
            معرض القوالب
          </Link>
          <Link href="/super" className="hover:text-white">
            دخول المشرف
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ prices */

/**
 * The three tiers, priced from `src/lib/billing.ts` — never from a number typed into this component.
 * Annual is shown first and monthly beside it, because annual is what the business actually wants to sell:
 * it matches how a Kuwaiti SMB already thinks about a website, and it removes eleven collection messages
 * a year for a founder who is one person.
 */
export function PlanCards() {
  const plans = planCatalog();
  const setup = setupFeeFils();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((p) => {
        const saving = yearlySavingFils(p.plan);
        return (
          <section
            key={p.plan}
            className={`relative flex flex-col rounded-3xl border p-6 ${p.recommended ? "border-amber-300/60 bg-amber-400/10" : "border-white/10 bg-white/5"}`}
          >
            {p.recommended && (
              <span className="absolute -top-3 start-6 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black text-black">الأكثر طلباً</span>
            )}
            <h3 className="text-2xl font-black">{p.name.ar}</h3>
            <p className="mt-1 text-sm text-white/65">{p.pitch.ar}</p>
            <p className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl font-black">{formatFils(p.price.yearly, "ar")}</span>
              <span className="text-sm text-white/60">/ سنة</span>
            </p>
            <p className="mt-1 text-sm text-white/60">
              أو {formatFils(p.price.monthly, "ar")} شهرياً
              {saving > 0 && <span className="ms-1 text-emerald-300">— توفّر {formatFils(saving, "ar")} بالدفع السنوي</span>}
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-white/80">
              {p.features.map((f) => (
                <li key={f.en} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 text-emerald-300">
                    ✓
                  </span>
                  <span>{f.ar}</span>
                </li>
              ))}
            </ul>
            <a
              href="#request"
              className={`mt-6 rounded-full px-5 py-3 text-center font-bold transition ${p.recommended ? "bg-amber-400 text-black hover:bg-amber-300" : "border border-white/25 hover:bg-white/10"}`}
            >
              اطلب الباقة {p.name.ar}
            </a>
          </section>
        );
      })}
      <p className="text-sm leading-relaxed text-white/60 lg:col-span-3">
        الأسعار بالدينار الكويتي وتشمل الاستضافة والنطاق الفرعي. رسوم التجهيز {formatFils(setup, "ar")} تُدفع مرة واحدة عند
        البدء، <b className="text-white/80">وتُسقط بالكامل مع الاشتراك السنوي</b>. النطاق الخاص (.com) يُشترى باسم العميل ورسومه
        السنوية على مزود النطاق مباشرة. الدفع عن طريق كي نت أو البطاقات أو نقداً — ولا نقبل الشيكات.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ proof */

/**
 * The actual selling point: working sites the customer can open on his phone right now.
 *
 * This section leads, and the conversion-API machinery does not get a headline anywhere on this page. That
 * engine is a small part of the codebase, its deep-funnel promise does not survive contact with Meta's
 * 7-day click window when a fit-out job takes six weeks, and a sales page that opens with an acronym loses
 * the person it is written for.
 */
export function ProofSection() {
  const picks = CATEGORIES.map((cat) => ({ cat, tpl: templatesFor(cat)[3] ?? templatesFor(cat)[0] })).filter((x) => x.tpl);
  return (
    <section className="mx-auto max-w-6xl px-5 py-16" id="work">
      <h2 className="text-3xl font-black sm:text-4xl">شوف الشغل قبل لا تسأل عن السعر</h2>
      <p className="mt-3 max-w-2xl text-white/70">
        كل قالب في الأسفل موقع حقيقي يعمل الآن — افتحه من جوالك، جرّب زر الواتساب، وشوف كيف يظهر معرض المشاريع
        وقسم «قبل وبعد» ومراحل التنفيذ. القوالب ملك للمنصة، وصورك ومحتواك ملك لك.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map(({ cat, tpl }) => (
          <a
            key={cat}
            href={`/template/${tpl.code}`}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-amber-300/50"
          >
            {/* A static build-time thumbnail in /public: next/image would add a loader round trip for a fixed asset. */}
            <img
              src={`/templates/${tpl.code}.jpg`}
              alt={`قالب ${tpl.name.ar} — ${CATEGORY_LABELS[cat].ar}`}
              width={1200}
              height={900}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover object-top transition group-hover:scale-[1.02]"
            />
            <div className="p-4">
              <h3 className="font-black">{CATEGORY_LABELS[cat].ar}</h3>
              <p className="mt-1 text-sm text-white/60">
                {templatesFor(cat).length} قالباً · معاينة القالب {tpl.code} ↗
              </p>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/templates" className="rounded-full border border-white/25 px-5 py-3 font-bold transition hover:bg-white/10">
          استعرض {TEMPLATES.length} قالباً
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ terms */

/**
 * The plain terms, on the sales page and not buried behind a link.
 *
 * Nothing here promises an outcome. The moment the pitch guarantees leads, a ranking or ad performance, the
 * founder owns the blame for the first quiet month — in a trade where a quiet month is normal and has
 * nothing to do with the website. There is no numeric uptime figure either: this is one person on Vercel,
 * and an SLA nobody can honour is worse than no SLA.
 */
export function TermsSection() {
  const terms: [string, string][] = [
    [
      "ما يشمله الاشتراك",
      "بناء الموقع على أحد القوالب، استضافته، النطاق الفرعي، لوحة تحكم لإدارة المحتوى والصور، والتحديثات الأمنية والتقنية للمنصة. عدد المشاريع والمزايا يحددها مستوى الباقة أعلاه.",
    ],
    [
      "الملكية",
      "صورك ونصوصك وشعارك ومعلومات شركتك ملكك أنت، قبل الاشتراك وبعده. القوالب والبرمجة ولوحة التحكم ملك للمنصة وتُرخَّص لك طوال مدة الاشتراك.",
    ],
    [
      "استمرارية الخدمة",
      "نبذل جهداً معقولاً تجارياً لإبقاء الموقع متاحاً ولإصلاح أي انقطاع بأسرع ما يمكن. لا نلتزم بنسبة توافر رقمية: المنصة تعمل على بنية طرف ثالث (Vercel و Supabase و Cloudflare) ويشغّلها فريق صغير، ونفضّل ألا نَعِد برقم لا نتحكم فيه.",
    ],
    [
      "لا ضمانات تسويقية",
      "لا نضمن عدد زوار أو اتصالات أو طلبات، ولا ترتيباً معيناً في جوجل، ولا نتيجة محددة لأي حملة إعلانية. هذه أمور تحددها السوق والمنافسة وميزانيتك وجودة عملك. ما نضمنه هو موقع يعمل، سريع، ومحتوى تتحكم فيه أنت.",
    ],
    [
      "الدفع والتجديد",
      "الاشتراك يُدفع مقدماً (سنوياً أو شهرياً). يُرسل تذكير قبل انتهاء المدة بأسبوعين وأسبوع وفي يوم الانتهاء. عند تأخر السداد يتحول الموقع تلقائياً إلى صفحة «قريباً» ويُستثنى من محركات البحث حتى السداد — ولا يُحذف شيء من محتواك.",
    ],
    [
      "الإلغاء وتصدير البيانات",
      "يمكنك الإلغاء في أي وقت ويستمر الموقع حتى نهاية المدة المدفوعة؛ المبالغ المدفوعة مقدماً غير مستردة. عند الإنهاء نسلّمك نسخة من محتواك وصورك بصيغة قابلة للاستخدام خلال ١٤ يوماً، ونحتفظ بالبيانات ٣٠ يوماً قبل الحذف النهائي.",
    ],
    [
      "بيانات الزوار",
      "الموقع يسجل بيانات زيارة أساسية ورقم زائر لكل زيارة، وتظهر لك في لوحة التحكم. لا تُباع هذه البيانات ولا تُشارك مع طرف ثالث إلا المنصات الإعلانية التي تربطها أنت بنفسك، ولكل موقع صفحة سياسة خصوصية يمكنك تعديلها.",
    ],
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16" id="terms">
      <h2 className="text-3xl font-black sm:text-4xl">الشروط، باختصار وبلا مفاجآت</h2>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {terms.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <dt className="font-black text-amber-300">{t}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-white/75">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ the request form */

const TRADES = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c].ar }));

/**
 * "اطلب موقعك" — name, WhatsApp, trade and area, which is everything needed to have the first conversation
 * and nothing more. Every extra field on a form like this costs submissions, and the founder is going to
 * call the number anyway.
 *
 * It posts to a Server Action that writes a row to `platform_leads`; there is no transactional email in this
 * product and a row in /super cannot bounce or land in a spam folder.
 */
export function RequestForm({ source, plan }: { source: "home" | "pricing"; plan?: string }) {
  return (
    <section id="request" className="scroll-mt-24 border-y border-white/10 bg-white/[0.03]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-3xl font-black sm:text-4xl">اطلب موقعك</h2>
          <p className="mt-3 text-white/70">
            اكتب اسمك ورقم واتساب ونوع شغلك، ونرد عليك على الواتساب نفسه. نتفق على الباقة والقالب، ترسل صور
            أعمالك، ويكون الموقع جاهزاً عادةً خلال أيام قليلة.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-white/70">
            {[
              "لا نطلب دفعة قبل ما تشوف موقعك جاهزاً على رابط تجربة.",
              "الرد يكون من شخص، مو من رد آلي.",
              "إذا ما كان المنتج مناسباً لشغلك، نقول لك من أول رسالة.",
            ].map((l) => (
              <li key={l} className="flex gap-2">
                <span aria-hidden className="text-amber-300">
                  •
                </span>
                {l}
              </li>
            ))}
          </ul>
        </div>
        <form action={submitLeadAction} className="grid gap-4 rounded-3xl border border-white/10 bg-[#0b1220] p-6">
          <input type="hidden" name="source" value={source} />
          {plan && <input type="hidden" name="plan" value={plan} />}
          {/* Honeypot: a field a human never sees and a form-filling bot always completes. Hidden from
              assistive technology too, so a screen reader is never asked to fill in a trap. */}
          <div className="hidden" aria-hidden="true">
            <label>
              لا تملأ هذا الحقل
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-white/80">الاسم</span>
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:border-amber-300 focus:outline-none"
              placeholder="مثال: أبو محمد"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-white/80">رقم الواتساب</span>
            <input
              name="whatsapp"
              required
              inputMode="tel"
              maxLength={20}
              dir="ltr"
              autoComplete="tel"
              className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-start text-white placeholder:text-white/35 focus:border-amber-300 focus:outline-none"
              placeholder="5000 0000"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-white/80">نوع الشغل</span>
              <select
                name="trade"
                className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-amber-300 focus:outline-none"
              >
                {TRADES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-[#0b1220]">
                    {t.label}
                  </option>
                ))}
                <option value="other" className="bg-[#0b1220]">
                  شغل ديكور آخر
                </option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-white/80">المنطقة</span>
              <select
                name="area"
                className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-amber-300 focus:outline-none"
              >
                <option value="" className="bg-[#0b1220]">
                  اختياري
                </option>
                {KUWAIT_AREAS.map((a) => (
                  <option key={a} value={a} className="bg-[#0b1220]">
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-white/80">
              شي تحب نعرفه؟ <span className="font-normal text-white/50">(اختياري)</span>
            </span>
            <textarea
              name="message"
              maxLength={1000}
              rows={3}
              className="block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:border-amber-300 focus:outline-none"
              placeholder="عندي صور مشاريع جاهزة، وأبي نطاق باسم الشركة"
            />
          </label>
          {/* The variant's own colours are same-specificity utilities, so the override has to be marked
              important — Tailwind v4 spells that as a suffix (`bg-amber-400!`), not a v3 `!` prefix. */}
          <SubmitButton pendingText="جاري الإرسال..." className="w-full bg-amber-400! py-3 text-base text-black! hover:bg-amber-300!">
            أرسل الطلب
          </SubmitButton>
          <p className="text-xs leading-relaxed text-white/50">
            بإرسال الطلب توافق على أن نتواصل معك على الرقم المكتوب. لا نرسل رسائل تسويقية ولا نشارك رقمك مع أحد.
          </p>
        </form>
      </div>
    </section>
  );
}

/** Success / failure banner for the request form. The codes are ours; anything else is not rendered. */
export function RequestFlash({ sent, error }: { sent?: string; error?: string }) {
  const MESSAGES: Record<string, string> = {
    invalid_name: "اكتب اسمك من فضلك.",
    invalid_whatsapp: "رقم الواتساب غير صحيح. اكتبه بهذا الشكل: 50000000",
    rate_limited: "وصلنا أكثر من طلب من نفس الجهاز. جرّب بعد شوي أو راسلنا مباشرة.",
    server_error: "ما قدرنا نحفظ الطلب الآن. جرّب مرة ثانية بعد دقيقة.",
  };
  if (sent) {
    return (
      <div role="status" aria-live="polite" className="mx-auto mt-6 max-w-6xl px-5">
        <p className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-4 font-bold text-emerald-200">
          وصلنا طلبك. نرد عليك على الواتساب قريباً — عادةً خلال ساعات العمل نفسها.
        </p>
      </div>
    );
  }
  if (error && MESSAGES[error]) {
    return (
      <div role="alert" className="mx-auto mt-6 max-w-6xl px-5">
        <p className="rounded-2xl border border-red-400/40 bg-red-400/10 px-5 py-4 font-bold text-red-200">{MESSAGES[error]}</p>
      </div>
    );
  }
  return null;
}

/** Monthly/yearly comparison strip used on /pricing under the cards. */
export function CycleNote() {
  const plans = planCatalog();
  return (
    <div className="mt-10 overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
      <table className="w-full min-w-[480px] text-start text-sm">
        <thead className="text-white/60">
          <tr>
            <th className="px-5 py-3 text-start font-bold">الباقة</th>
            <th className="px-5 py-3 text-start font-bold">{cycleLabel("monthly", "ar")}</th>
            <th className="px-5 py-3 text-start font-bold">{cycleLabel("yearly", "ar")}</th>
            <th className="px-5 py-3 text-start font-bold">رسوم التجهيز</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.plan} className="border-t border-white/10">
              <th scope="row" className="px-5 py-3 text-start font-black">
                {p.name.ar}
              </th>
              <td className="px-5 py-3">{formatFils(p.price.monthly, "ar")}</td>
              <td className="px-5 py-3 font-bold text-amber-300">{formatFils(p.price.yearly, "ar")}</td>
              <td className="px-5 py-3">
                <span className="text-white/60">{formatFils(setupFeeFils(), "ar")} شهرياً · </span>
                <span className="font-bold text-emerald-300">مجاناً سنوياً</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
