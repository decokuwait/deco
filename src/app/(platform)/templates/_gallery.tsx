import Link from "next/link";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { TemplateThumb } from "@/templates/Thumb";
import { APP_NAME } from "@/lib/config";

export type GalleryFilter = Category | "all";

/**
 * Category filter. Each pill is a real link to its own statically rendered page, so a filtered view is
 * shareable, crawlable and works without JavaScript; "الكل" goes back to the full gallery.
 */
function CategoryTabs({ active }: { active: GalleryFilter }) {
  const tabs: { key: GalleryFilter; href: string; label: string }[] = [
    { key: "all", href: "/templates", label: "الكل" },
    ...CATEGORIES.map((c) => ({ key: c as GalleryFilter, href: `/templates/${c}`, label: CATEGORY_LABELS[c].ar })),
  ];
  return (
    <nav aria-label="تصفية حسب القسم" className="flex gap-2 overflow-x-auto text-sm font-semibold">
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 transition ${on ? "bg-amber-400 text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CategorySection({ cat, withHeading }: { cat: Category; withHeading: boolean }) {
  const items = templatesFor(cat);
  return (
    <section id={cat} className={withHeading ? "mt-14 scroll-mt-24" : "mt-8"}>
      {withHeading && (
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">
            {CATEGORY_LABELS[cat].ar} <span className="text-base font-semibold text-white/50">{CATEGORY_LABELS[cat].en}</span>
          </h2>
          <span className="text-sm text-white/50">{items.length} قالباً</span>
        </div>
      )}
      <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${withHeading ? "mt-6" : ""}`}>
        {items.map((t) => (
          <Link
            key={t.code}
            href={`/template/${t.code}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-amber-300/60"
          >
            <TemplateThumb def={t} className="transition group-hover:opacity-95">
              <span className="absolute start-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-black text-white">{t.code}</span>
              <span className="absolute end-3 top-3 flex gap-1">
                {[t.tokens.primary, t.tokens.secondary, t.tokens.accent].map((c, i) => (
                  <span key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-white/60" style={{ background: c }} />
                ))}
              </span>
            </TemplateThumb>
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
  );
}

/** The template gallery, either complete (`active: "all"`) or narrowed to one trade. */
export function TemplateGallery({ active }: { active: GalleryFilter }) {
  const shown: Category[] = active === "all" ? CATEGORIES : [active];
  const count = shown.reduce((n, c) => n + templatesFor(c).length, 0);
  return (
    <div className="min-h-dvh bg-[#0b1220] text-white" dir="rtl" lang="ar">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="text-lg font-black">
            {APP_NAME}
          </Link>
          <CategoryTabs active={active} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-black sm:text-4xl">
          {active === "all" ? "معرض القوالب" : `قوالب ${CATEGORY_LABELS[active].ar}`}
        </h1>
        <p className="mt-2 text-white/60">
          {active === "all"
            ? "كل قالب له رقم من ثلاثة أرقام. افتح أي قالب لمعاينته كاملاً بمحتوى تجريبي عربي وإنجليزي."
            : `${count} قالباً جاهزاً لهذا القسم. افتح أي قالب لمعاينته كاملاً بمحتوى تجريبي عربي وإنجليزي.`}
        </p>
        {shown.map((cat) => (
          <CategorySection key={cat} cat={cat} withHeading={active === "all"} />
        ))}
      </main>
    </div>
  );
}
