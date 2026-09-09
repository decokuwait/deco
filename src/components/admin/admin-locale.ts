import { cookies } from "next/headers";
import type { Locale } from "@/lib/types";
import { isLocale } from "@/lib/i18n/site";

export const ADMIN_LOCALE_COOKIE = "dk_admin_lang";

/** Admin panel language (Arabic by default, English on toggle). Independent from the site language. */
export async function getAdminLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(ADMIN_LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "ar";
}
