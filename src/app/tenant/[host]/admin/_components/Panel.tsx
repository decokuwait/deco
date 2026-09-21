import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/Shell";
import { adminNav, type AdminCtx, type NavKey } from "../_lib/guard";
import { logoutAction } from "../_lib/actions";

/** Admin shell wired to the current site: title = site name, subtitle = host, nav + logout. */
export function Panel({ ctx, active, children }: { ctx: AdminCtx; active: NavKey; children: ReactNode }) {
  return (
    <AdminShell
      title={ctx.site.name}
      subtitle={ctx.host}
      nav={adminNav(active, ctx.t)}
      locale={ctx.locale}
      logoutAction={logoutAction}
      logoutLabel={ctx.t("logout")}
      topRight={
        <Link
          href="/admin/settings"
          aria-label={ctx.t("settings")}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold md:hidden ${active === "settings" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      }
    >
      {children}
    </AdminShell>
  );
}

/** Sticky save bar: sits above the bottom tab bar on phones, inline on desktop. */
export function SaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 -mx-4 mt-5 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
      {children}
    </div>
  );
}

/** Small back link used at the top of sub pages. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-900">
      <span aria-hidden className="rtl:hidden">
        ←
      </span>
      <span aria-hidden className="hidden rtl:inline">
        →
      </span>
      {label}
    </Link>
  );
}
