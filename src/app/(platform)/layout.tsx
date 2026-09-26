import type { Metadata, Viewport } from "next";
import "../globals.css";
import { APP_NAME, rootUrl } from "@/lib/config";
import { ldJson, platformGraph } from "@/lib/seo/jsonld";

const DESCRIPTION = "منصة مواقع جاهزة لشركات الديكور في الكويت: جبس بورد، ألمنيوم، بارتيشن وسيراميك.";

/** Root layout of the platform itself (home, gallery, previews, super admin): Arabic, RTL, platform branding. */
export const metadata: Metadata = {
  /**
   * Without `metadataBase` every canonical on the platform was a relative string (`/templates/gypsum`).
   * That is valid and self-referencing, but it is also the reason a `*.vercel.app` copy of the gallery
   * canonicalised to ITSELF instead of to decokuwait.com — an absolute canonical is what makes a stray
   * host point home.
   */
  metadataBase: new URL(rootUrl("/")),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: DESCRIPTION,
  // No `alternates` here on purpose: a canonical set on a layout is inherited by every page that does not
  // override it, which would have pointed all of /super at the home page. Each indexable page sets its own.
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

/**
 * The platform's entity markup, which did not exist at all.
 *
 * `Organization` + `WebSite` only. No `potentialAction: SearchAction`: the sitelinks searchbox was retired
 * and the markup does nothing but add bytes to every page on the platform.
 */
const GRAPH = ldJson(
  platformGraph({
    url: rootUrl("/"),
    name: APP_NAME,
    description: DESCRIPTION,
    logo: rootUrl("/icon.svg"),
  }),
);

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: GRAPH }} />
        {children}
      </body>
    </html>
  );
}
