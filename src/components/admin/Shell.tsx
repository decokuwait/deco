import type { ReactNode } from "react";
import type { Locale } from "@/lib/types";
import { AdminLangToggle } from "./AdminLangToggle";
import { cx } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "users" | "edit" | "grid" | "megaphone" | "settings" | "sites" | "layout" | "user";
  active?: boolean;
}

function NavIcon({ name, className = "h-5 w-5" }: { name: NavItem["icon"]; className?: string }) {
  const d: Record<NavItem["icon"], string> = {
    home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    megaphone: "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    sites: "M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
    layout: "M3 3h18v18H3zM3 9h18M9 21V9",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d[name]} />
    </svg>
  );
}

/**
 * Mobile-first admin shell: top bar, desktop sidebar, bottom tab bar on phones.
 * `nav` items are rendered in both places; `active` marks the current page.
 */
export function AdminShell({
  title,
  subtitle,
  nav,
  locale,
  children,
  topRight,
  logoutAction,
  logoutLabel,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  locale: Locale;
  children: ReactNode;
  topRight?: ReactNode;
  logoutAction?: () => Promise<void>;
  logoutLabel?: string;
}) {
  const primary = nav.slice(0, 5);
  return (
    <div className="admin" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-900 sm:text-base">{title}</div>
            {subtitle && <div className="truncate text-[11px] text-slate-500">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2">
            {topRight}
            <AdminLangToggle locale={locale} />
            {logoutAction && (
              <form action={logoutAction}>
                <button type="submit" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  {logoutLabel || "Logout"}
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 flex flex-col gap-1">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                aria-current={n.active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  n.active ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-white hover:shadow-sm",
                )}
              >
                <NavIcon name={n.icon} />
                {n.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {primary.map((n) => (
          <a key={n.href} href={n.href} aria-current={n.active ? "page" : undefined} className={cx("flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-bold", n.active ? "text-emerald-700" : "text-slate-500")}>
            <NavIcon name={n.icon} className="h-6 w-6" />
            <span className="truncate">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
