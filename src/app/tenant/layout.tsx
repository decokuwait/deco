import type { ReactNode } from "react";
import "../globals.css";
import { getRequestSite } from "@/lib/site-request";
import { urlLocale } from "@/lib/seo/locale";

// Tenant hosts are always rendered per request: the document language and direction follow the
// site's default language (or the language asked for in the URL), so crawlers and screen readers see
// the right values.
export const dynamic = "force-dynamic";

export default async function TenantRootLayout({ children }: { children: ReactNode }) {
  const site = await getRequestSite();
  // Deliberately `urlLocale`, not the cookie-aware resolver: a visitor carrying `dk_lang=en` used to get
  // English bytes and `<html lang="en">` at the bare `/`, while the page's canonical pointed at
  // `?lang=en`. One URL must have one document.
  const locale = await urlLocale(site?.content.settings.defaultLocale ?? "ar");
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
