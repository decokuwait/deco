import type { NextConfig } from "next";

// Two years, subdomains included: every tenant lives on a subdomain of the root domain, and a tenant
// reachable over plain http is a tenant whose admin session cookie can be stripped off the wire. No
// `preload` — that is a submission to a browser-vendor list that is slow and awkward to reverse, and the
// platform hands out custom domains it does not control the DNS of.
const HSTS = { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" };

/**
 * Admin and super panels.
 *
 * `frame-ancestors`/`X-Frame-Options` stop clickjacking; public sites stay embeddable. The rest of the
 * strict policy (`default-src`/`script-src`) is set by the proxy instead, because it needs a per-request
 * nonce for the inline bootstrap script Next streams the RSC payload through — a static `script-src 'self'`
 * here would block it and leave the panel unhydrated. Everything in this header is nonce-independent, so
 * it still applies to any response the proxy does not see. Two CSP headers are enforced as the
 * intersection of both, which is what we want.
 */
const ADMIN_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Keep metadata in `<head>` for everyone.
   *
   * Next 16 *streams* `generateMetadata`, appending the tags to `<body>` for any user agent it does not
   * classify as HTML-limited — and its default list covers Mediapartners-Google, AdsBot-Google,
   * Google-PageRenderer, Bingbot and Twitterbot but **not plain `Googlebot`**. Every tenant route is
   * dynamic (the site lookup lives inside `generateMetadata`), so without this every tenant's canonical,
   * hreflang and robots tag was emitted into `<body>`, where Google's documentation does not honour
   * `rel=canonical`. That is precisely the duplicate-content problem the primary-host work exists to fix,
   * so the risk is not worth Next's assurance that Googlebot copes.
   *
   * The cost is near zero: the page already awaits the same query in its body and React `cache()` dedupes
   * it, so blocking on metadata adds no extra round trip.
   */
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  outputFileTracingIncludes: {
    "/**": ["./supabase/migrations/**"],
  },
  async redirects() {
    return [{ source: "/template", destination: "/templates", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          HSTS,
        ],
      },
      // Template previews are the same bytes for everyone: 60 pages of fixed demo content whose only
      // input is the code and `?lang`. They were re-rendering on every request (and on every crawl of
      // the gallery), so let the CDN answer instead and refresh in the background.
      {
        source: "/template/:code",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
      },
      // Admin panels must never be framed (clickjacking); public sites stay embeddable.
      { source: "/admin/:path*", headers: ADMIN_HEADERS },
      { source: "/admin", headers: ADMIN_HEADERS },
      { source: "/super/:path*", headers: ADMIN_HEADERS },
      { source: "/super", headers: ADMIN_HEADERS },
      { source: "/tenant/:host/admin/:path*", headers: ADMIN_HEADERS },
      { source: "/tenant/:host/admin", headers: ADMIN_HEADERS },
    ];
  },
};

export default nextConfig;
