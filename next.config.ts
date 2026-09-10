import type { NextConfig } from "next";

const NO_FRAME = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
        ],
      },
      // Admin panels must never be framed (clickjacking); public sites stay embeddable.
      { source: "/admin/:path*", headers: NO_FRAME },
      { source: "/admin", headers: NO_FRAME },
      { source: "/super/:path*", headers: NO_FRAME },
      { source: "/super", headers: NO_FRAME },
      { source: "/tenant/:host/admin/:path*", headers: NO_FRAME },
      { source: "/tenant/:host/admin", headers: NO_FRAME },
    ];
  },
};

export default nextConfig;
