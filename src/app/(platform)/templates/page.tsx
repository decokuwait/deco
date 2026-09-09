import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { FONTS } from "@/templates/fonts";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-static";

export default function TemplatesGallery() {
  return (
    <div className="min-h-dvh bg-[#0b1220] text-white" dir="rtl" lang="ar">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-black">
            {APP_NAME}
          </Link>
          <nav className="flex gap-2 overflow-x-auto text-sm font-semibold">
            {CATEGORIES.map((c) => (
              <a key={c} href={`#${c}`} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20">
                {CATEGORY_LABELS[c].ar}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-black sm:text-4xl">معرض القوالب</h1>
        <p className="mt-2 text-white/60">كل قالب له رقم من ثلاثة أرقام. افتح أي قالب لمعاينته كاملاً بمحتوى تجريبي عربي وإنجليزي.</p>
        {CATEGORIES.map((cat) => (
          <section key={cat} id={cat} className="mt-14 scroll-mt-24">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold">
                {CATEGORY_LABELS[cat].ar} <span className="text-base font-semibold text-white/50">{CATEGORY_LABELS[cat].en}</span>
              </h2>
              <span className="text-sm text-white/50">{templatesFor(cat).length} قالباً</span>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {templatesFor(cat).map((t) => (
                <Link key={t.code} href={`/template/${t.code}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-amber-300/60">
                  <div className="relative h-40 p-4" style={{ background: t.tokens.bg, color: t.tokens.text, fontFamily: FONTS[t.tokens.headingFont].css }}>
                    <div className="flex items-center justify-between">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: t.tokens.primary, color: t.tokens.primaryFg }}>
                        {t.code}
                      </span>
                      <div className="flex gap-1">
                        {[t.tokens.primary, t.tokens.secondary, t.tokens.accent, t.tokens.surface2].map((c, i) => (
                          <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 text-2xl font-black leading-tight">{t.name.ar}</div>
                    <div className="text-xs opacity-70" style={{ fontFamily: FONTS[t.tokens.bodyFont].css }}>
                      {t.name.en} · {FONTS[t.tokens.headingFont].family}
                    </div>
                    <div className="absolute inset-x-4 bottom-3 flex gap-2">
                      <span className="h-6 flex-1 rounded" style={{ background: t.tokens.secondary, borderRadius: t.tokens.radius === "full" ? 999 : undefined }} />
                      <span className="h-6 w-16 rounded" style={{ background: t.tokens.accent }} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {t.code} — {t.name.ar}
                      </span>
                      <span className="text-xs text-white/50">
                        {t.layout.hero} / {t.layout.services}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">{t.description.ar}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
