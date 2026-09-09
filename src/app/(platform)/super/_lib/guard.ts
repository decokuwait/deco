import { redirect } from "next/navigation";
import { getSuperAccess } from "@/lib/auth/session";
import { getAdminLocale } from "@/components/admin/admin-locale";
import { ts, type SuperUiKey } from "@/lib/i18n/super";
import type { NavItem } from "@/components/admin/Shell";
import type { Locale } from "@/lib/types";
import type { User } from "@/lib/db/users";

export type NavKey = "sites" | "new" | "templates" | "users";
export type T = (key: SuperUiKey) => string;
export interface SuperCtx {
  user: User;
  locale: Locale;
  t: T;
}

export async function requireSuper(): Promise<SuperCtx> {
  const user = await getSuperAccess();
  if (!user) redirect("/super/login");
  const locale = await getAdminLocale();
  return { user, locale, t: (k) => ts(locale, k) };
}

export function superNav(active: NavKey, t: T): NavItem[] {
  const items: Array<{ key: NavKey; href: string; icon: NavItem["icon"]; label: SuperUiKey }> = [
    { key: "sites", href: "/super", icon: "sites", label: "sites" },
    { key: "new", href: "/super/sites/new", icon: "edit", label: "new_site" },
    { key: "templates", href: "/super/templates", icon: "layout", label: "templates" },
    { key: "users", href: "/super/users", icon: "users", label: "users" },
  ];
  return items.map((i) => ({ href: i.href, icon: i.icon, label: t(i.label), active: i.key === active }));
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export function sp1(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
export function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 200);
}
export function withQuery(path: string, q: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}
