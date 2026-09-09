import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getRequestSite } from "@/lib/site-request";
import { getSiteAccess } from "@/lib/auth/session";
import { getAdminLocale } from "@/components/admin/admin-locale";
import { ta, type AdminUiKey } from "@/lib/i18n/admin";
import type { NavItem } from "@/components/admin/Shell";
import type { Locale, SiteRecord } from "@/lib/types";
import type { User } from "@/lib/db/users";

export type NavKey = "dashboard" | "visitors" | "content" | "projects" | "marketing" | "settings";
export type T = (key: AdminUiKey) => string;

export interface AdminCtx {
  host: string;
  site: SiteRecord;
  user: User;
  isSuper: boolean;
  locale: Locale;
  t: T;
}

/**
 * Resolves the tenant site for `host`, verifies the current user may administer it and returns
 * everything a page/action needs. Redirects to the login page when the user is not allowed.
 */
export async function requireSiteAdmin(host?: string): Promise<AdminCtx> {
  const site = await getRequestSite(host);
  if (!site) notFound();
  const access = await getSiteAccess(site.id);
  if (!access) redirect("/admin/login");
  const locale = await getAdminLocale();
  const h = host || (await headers()).get("x-dk-host") || site.slug;
  return {
    host: h,
    site,
    user: access.user,
    isSuper: access.isSuper,
    locale,
    t: (key) => ta(locale, key),
  };
}

export function adminNav(active: NavKey, t: T): NavItem[] {
  const items: Array<{ key: NavKey; href: string; icon: NavItem["icon"] }> = [
    { key: "dashboard", href: "/admin", icon: "home" },
    { key: "visitors", href: "/admin/visitors", icon: "users" },
    { key: "content", href: "/admin/content", icon: "edit" },
    { key: "projects", href: "/admin/projects", icon: "grid" },
    { key: "marketing", href: "/admin/marketing", icon: "megaphone" },
    { key: "settings", href: "/admin/settings", icon: "settings" },
  ];
  return items.map((i) => ({ href: i.href, label: t(i.key), icon: i.icon, active: i.key === active }));
}

/** First value of a search param (string | string[] | undefined). */
export function sp1(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 200);
}

/** Build `path?saved=1` / `path?error=...` style URLs. */
export function withQuery(path: string, q: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}
