import type { ReactNode } from "react";
import "../globals.css";
import { getRequestLocale, getRequestSite } from "@/lib/site-request";

// Tenant hosts are always rendered per request: the document language and direction follow the
// site's default language (or the visitor's choice), so crawlers and screen readers see the right values.
export const dynamic = "force-dynamic";

export default async function TenantRootLayout({ children }: { children: ReactNode }) {
  const site = await getRequestSite();
  const locale = await getRequestLocale(site?.content.settings.defaultLocale ?? "ar");
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
