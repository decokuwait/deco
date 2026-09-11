import type { Metadata, Viewport } from "next";
import "../globals.css";

/** Root layout of the platform itself (home, gallery, previews, super admin): Arabic, RTL, platform branding. */
export const metadata: Metadata = {
  title: "DecoKuwait",
  description: "Multi-site platform for Kuwaiti decor businesses",
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
