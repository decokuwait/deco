import type { Metadata } from "next";
import Link from "next/link";
import { rootUrl } from "@/lib/config";
import { formatFils, planPriceFils } from "@/lib/billing";
import { TEMPLATES } from "@/templates/registry";
import { MarketingFooter, MarketingHeader, PlanCards, ProofSection, RequestFlash, RequestForm, TermsSection } from "./pricing/_components/marketing";
import { HOW_IT_WORKS, SITE_PITCH } from "./pricing/_lib/copy";

/**
 * The platform's front door, rebuilt as something a customer can arrive on.
 *
 * What was here before was an internal index: the entire navigation was "القوالب" and "لوحة المشرف العام",
 * there was no price, no contact, no phone number and no way to ask for anything — a Kuwaiti contractor who
 * found decokuwait.com could not become a customer. The metadata was an English sentence with no canonical
 * and no Open Graph image, on a page whose readers search in Arabic.
 *
 * The order of the page is the order of the argument: what this is, proof you can open on your phone, how
 * it works, what it costs, what the terms are, and a form. The visitor-tracking and conversion-API
 * machinery is mentioned once, inside the Plus tier, and never leads — it is a small part of the product,
 * its deep-funnel promise does not survive a six-week fit-out job against Meta's 7-day click window, and an
 * acronym is not how you open a conversation with the person this page is written for.
 */

const TITLE = SITE_PITCH.title;

export const metadata: Metadata = {
  // The layout's template would otherwise put "DecoKuwait" around this; the home page owns its own title.
  title: { absolute: `${TITLE} | جبس بورد، ألمنيوم، بارتيشن، سيراميك` },
  description: SITE_PITCH.description,
  keywords: "تصميم موقع شركة ديكور الكويت, موقع جبس بورد, موقع ألمنيوم, موقع بارتيشن, موقع سيراميك, مواقع جاهزة الكويت",
  // Absolute, not relative: a relative metadata URL without a `metadataBase` is a build error, and this
  // page must keep working whatever the layout above it does or does not set.
  alternates: { canonical: rootUrl("/") },
  openGraph: {
    type: "website",
    locale: "ar_KW",
    url: rootUrl("/"),
    title: TITLE,
    description: SITE_PITCH.description,
    siteName: TITLE,
    images: [{ url: rootUrl("/templates/104.jpg"), width: 1200, height: 900, alt: "نموذج موقع لشركة ديكور في الكويت" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: SITE_PITCH.description, images: [rootUrl("/templates/104.jpg")] },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PlatformHome({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="min-h-dvh bg-[#0b1220] text-white" dir="rtl" lang="ar">
      <MarketingHeader active="home" />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-6 pt-14 sm:pt-20">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1 text-xs font-bold text-amber-300">
            للكويت · جبس بورد، ألمنيوم، بارتيشن، سيراميك
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.15] sm:text-6xl">{TITLE}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
            شغلك يستاهل أحسن من ألبوم صور في إنستغرام. موقع باسم شركتك يعرض مشاريعك و«قبل وبعد» ومراحل التنفيذ،
            ويوصل العميل لك على الواتساب من أي صفحة — تديره بنفسك من جوالك، باشتراك سنوي يبدأ من{" "}
            {formatFils(planPriceFils("basic", "yearly"), "ar")}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#request" className="rounded-full bg-amber-400 px-6 py-3 font-bold text-black transition hover:bg-amber-300">
              اطلب موقعك
            </a>
            <Link href="/pricing" className="rounded-full border border-white/25 px-6 py-3 font-bold transition hover:bg-white/10">
              شوف الأسعار
            </Link>
            <a href="#work" className="rounded-full border border-white/25 px-6 py-3 font-bold transition hover:bg-white/10">
              شوف نماذج الشغل
            </a>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/50">
            ما نَعِد بعدد عملاء ولا بترتيب في جوجل — هذي أمور ما نتحكم فيها ولا يتحكم فيها أحد. اللي نقدمه: موقع
            سريع ومرتب باسمك، تتحكم في محتواه، ويشتغل من أول يوم.
          </p>
        </section>

        <RequestFlash sent={first(sp.sent)} error={first(sp.error)} />

        <ProofSection />

        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-black sm:text-4xl">كيف تصير العملية</h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-3">
              {HOW_IT_WORKS.map((s) => (
                <li key={s.title} className="rounded-2xl border border-white/10 bg-[#0b1220] p-6">
                  <h3 className="text-lg font-black text-amber-300">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-black sm:text-4xl">وش تاخذ بالضبط</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["معرض مشاريع يليق بشغلك", "مشاريع منجزة بالصور والفيديو، «قبل وبعد» بمقارنة يسحبها الزائر بإصبعه، ومراحل التنفيذ يوماً بيوم. ولكل مشروع صفحته الخاصة."],
              ["عربي أولاً، وإنجليزي معه", "الموقع مكتوب من اليمين لليسار بشكل صحيح، وفيه نسخة إنجليزية لمن يحتاجها. مو ترجمة مقلوبة من قالب أجنبي."],
              ["واتساب في كل صفحة", "زر ثابت يفتح محادثة برسالة جاهزة فيها رقم الزيارة، حتى تعرف من أي صفحة جاك العميل."],
              ["لوحة تحكم من الجوال", "تضيف مشروعاً وأنت في الموقع، ترفع الصور من كاميرتك، وتغيّر النصوص والألوان بدون ما تتصل فينا."],
              [`${TEMPLATES.length} قالباً جاهزاً`, "أربعة أقسام، وكل قسم فيه قوالب بألوان وخطوط وتخطيطات مختلفة. تختار واحداً، وتقدر تغيّره لاحقاً بضغطة."],
              ["نطاقك وبريدك", "نربط الموقع بنطاق شركتك ونضبط سجلات DNS معك. النطاق يُسجَّل باسمك، مو باسمنا."],
            ].map(([t, d]) => (
              <article key={t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-black">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-black sm:text-4xl">الأسعار</h2>
            <Link href="/pricing" className="text-sm font-bold text-amber-300 hover:text-amber-200">
              التفاصيل الكاملة والشروط ↗
            </Link>
          </div>
          <PlanCards />
        </section>

        <TermsSection />
        <RequestForm source="home" />
      </main>
      <MarketingFooter />
    </div>
  );
}
