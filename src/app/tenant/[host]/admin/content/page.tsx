import Link from "next/link";
import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { PageHeader, Flash } from "@/components/admin/ui";
import { CONTENT_SECTIONS, SPECS } from "./_lib/spec";

const ICONS: Record<string, string> = {
  general: "M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z",
  hero: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  about: "M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  services: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  process: "M4 6h16M4 12h10M4 18h6",
  testimonials: "M8 10h8M8 14h5M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z",
  faq: "M9 9a3 3 0 1 1 4 2.8c-.7.4-1 1-1 1.7M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  cta: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  labels: "M4 7h16M4 12h10M4 17h6M20 12l-3-3M20 12l-3 3",
  legal: "M12 3l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V6zM9 12h6M9 15h4",
  seo: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  theme: "M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2v-1a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4c0-6-4.5-11-10-11zM7 12h.01M10 7h.01M15 7h.01",
  sections: "M3 3h18v18H3zM3 9h18M9 21V9",
};

export default async function ContentIndex({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, locale } = ctx;
  // A save now returns here rather than staying on the form, so `?saved=` names the section it came from:
  // the owner lands on a page of twelve identical cards and should not have to work out where they were.
  const justSaved = sp1(sp.saved);
  return (
    <Panel ctx={ctx} active="content">
      <PageHeader title={t("content")} subtitle={t("content_hint")} />
      <Flash saved={justSaved} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} locale={locale} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_SECTIONS.map((key) => {
          const s = SPECS[key];
          const saved = justSaved === key;
          return (
            <a
              key={key}
              href={`/admin/content/${key}`}
              className={`flex items-start gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow ${saved ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200"}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={ICONS[key]} />
                </svg>
              </span>
              <span>
                <span className="block font-black text-slate-900">{t(s.title)}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t(s.hint)}</span>
              </span>
            </a>
          );
        })}
        <Link href="/admin/projects" className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-400 hover:shadow">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7h18v13H3zM8 7V4h8v3" />
            </svg>
          </span>
          <span>
            <span className="block font-black text-slate-900">{t("projects")}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{t("finished")} · {t("before_after")} · {t("progress")}</span>
          </span>
        </Link>
      </div>
    </Panel>
  );
}
