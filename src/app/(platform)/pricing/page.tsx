import type { Metadata } from "next";
import { rootUrl } from "@/lib/config";
import { formatFils, planPriceFils, setupFeeFils } from "@/lib/billing";
import { CycleNote, MarketingFooter, MarketingHeader, PlanCards, RequestFlash, RequestForm, TermsSection } from "./_components/marketing";
import { FAQ, SITE_PITCH } from "./_lib/copy";

const TITLE = "الأسعار — اشتراك سنوي واضح لموقع شركة الديكور";
const DESCRIPTION = `ثلاث باقات لمواقع شركات الديكور في الكويت: الأساسية ${formatFils(planPriceFils("basic", "yearly"), "ar")} والاحترافية ${formatFils(planPriceFils("pro", "yearly"), "ar")} والمتقدمة ${formatFils(planPriceFils("plus", "yearly"), "ar")} سنوياً، شاملة الاستضافة ولوحة التحكم. رسوم التجهيز مجانية مع الاشتراك السنوي.`;

/**
 * Absolute URLs everywhere in this metadata rather than relative ones resolved against `metadataBase`:
 * a relative URL without a `metadataBase` is a build error, and this page must not depend on a value
 * another layout sets. `rootUrl()` already knows the deployment's scheme and host.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: rootUrl("/pricing") },
  openGraph: {
    type: "website",
    locale: "ar_KW",
    url: rootUrl("/pricing"),
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_PITCH.title,
    images: [{ url: rootUrl("/templates/104.jpg"), width: 1200, height: 900, alt: "نموذج موقع لشركة ديكور" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [rootUrl("/templates/104.jpg")] },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="min-h-dvh bg-[#0b1220] text-white" dir="rtl" lang="ar">
      <MarketingHeader active="pricing" />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-4 pt-14">
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">أسعار واضحة، بلا عقود سنوية مُلزِمة</h1>
          <p className="mt-4 max-w-3xl text-lg text-white/70">
            سعر واحد يشمل بناء الموقع واستضافته ولوحة التحكم. تدفع سنوياً فتسقط رسوم التجهيز البالغة{" "}
            {formatFils(setupFeeFils(), "ar")}، أو شهرياً إذا تحب تجرّب أولاً. تقدر توقف الاشتراك متى ما حبيت،
            ويستمر الموقع لنهاية المدة المدفوعة.
          </p>
        </section>
        <RequestFlash sent={first(sp.sent)} error={first(sp.error)} />
        <section className="mx-auto max-w-6xl px-5 py-10">
          <PlanCards />
          <CycleNote />
        </section>
        <TermsSection />
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <h2 className="text-3xl font-black sm:text-4xl">أسئلة تتكرر</h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <dt className="font-black">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-white/75">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <RequestForm source="pricing" plan={first(sp.plan)} />
      </main>
      <MarketingFooter />
    </div>
  );
}
