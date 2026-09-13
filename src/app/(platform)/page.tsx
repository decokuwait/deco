import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { TEMPLATES, templatesFor } from "@/templates/registry";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-static";

export default function PlatformHome() {
  return (
    <div className="min-h-dvh bg-[#0b1220] text-white" dir="rtl" lang="ar">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-black tracking-tight">{APP_NAME}</span>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/templates" className="hover:text-amber-300">
            القوالب
          </Link>
          <Link href="/super" className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20">
            لوحة المشرف العام
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <section className="text-center">
          <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1 text-xs font-bold text-amber-300">منصة مواقع جاهزة للشركات في الكويت</span>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">{TEMPLATES.length} قالباً احترافياً لأعمال الديكور</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
            مواقع عربية أولاً مع ترجمة إنجليزية، لوحة تحكم كاملة من الجوال، تتبع الزوار برقم مميز، وإرسال إشارات التحويل إلى ميتا وتيك توك وسناب شات وجوجل وإكس.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/templates" className="rounded-full bg-amber-400 px-6 py-3 font-bold text-black hover:bg-amber-300">
              استعرض القوالب
            </Link>
            <Link href="/super" className="rounded-full border border-white/20 px-6 py-3 font-bold hover:bg-white/10">
              إدارة المواقع
            </Link>
          </div>
        </section>
        <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((cat) => {
            const list = templatesFor(cat);
            const first = list[0];
            return (
              <Link key={cat} href={`/templates/${cat}`} className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-amber-300/50 hover:bg-white/10">
                <div className="flex gap-1.5">
                  {list.slice(0, 6).map((t) => (
                    <span key={t.code} className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ background: t.tokens.primary }} />
                  ))}
                </div>
                <h2 className="mt-4 text-xl font-extrabold">{CATEGORY_LABELS[cat].ar}</h2>
                <p className="text-sm text-white/60">{CATEGORY_LABELS[cat].en}</p>
                <p className="mt-3 text-sm text-white/70">
                  {list.length} قالباً · الأكواد {first?.code} - {list[list.length - 1]?.code}
                </p>
              </Link>
            );
          })}
        </section>
        <section className="mt-20 grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 sm:grid-cols-3">
          {[
            ["رقم زائر من 6 أرقام", "كل زائر يحصل على رقم يظهر في أول رسالة واتساب، ليتمكن المدير من البحث عنه وتحديد حالته."],
            ["إشارات التحويل الذكية", "عند تحديد الحالة (تم التواصل، طلب زيارة، طلب، دفعة أولى، اكتمال) تُرسل الإشارة للمنصة التي جاء منها الزائر."],
            ["ثلاثة أنواع من المشاريع", "مشاريع منجزة بالصور والفيديو، قبل وبعد بمقارنة تفاعلية، ومراحل التنفيذ يوماً بيوم كعرض شرائح."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="text-lg font-bold text-amber-300">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
