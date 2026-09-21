import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/tenant";
import { generateVisitorCode, isValidVisitorCode } from "@/lib/visitor/code";
import { ROOT_DOMAIN, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";

const INTERNAL_HEADERS = ["x-dk-host", "x-dk-vid", "x-dk-vid-new", "x-dk-path", "x-dk-lang"];

/**
 * Multi-tenant routing:
 *  - platform root domain  -> normal routes (/, /templates, /template/xxx, /super ...)
 *  - any other host        -> rewritten to /tenant/<host>/... and given a 6-digit visitor cookie
 * Internal x-dk-* headers are always stripped from the inbound request so clients cannot spoof them.
 * A `?lang=ar|en` query is forwarded as `x-dk-lang` so layouts (which cannot read search params) can
 * render the document in the requested language.
 */
export default function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const info = parseHost(rawHost, ROOT_DOMAIN);
  const headers = new Headers(req.headers);
  for (const h of INTERNAL_HEADERS) headers.delete(h);
  const lang = url.searchParams.get("lang");
  if (lang === "ar" || lang === "en") headers.set("x-dk-lang", lang);

  if (info.kind === "root") {
    if (url.pathname.startsWith("/tenant")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next({ request: { headers } });
  }

  // One canonical host per custom domain: www.example.com -> example.com (keeps one visitor id per person).
  if (info.subdomain === null && info.host.startsWith("www.")) {
    const target = url.clone();
    target.host = info.host.slice(4);
    return NextResponse.redirect(target, 308);
  }

  headers.set("x-dk-host", info.host);
  headers.set("x-dk-path", `${url.pathname}${url.search}`.slice(0, 1500));

  // API routes are shared by all hosts; pass them through with the tenant host header only.
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers } });
  }

  // Everything else is served from the tenant tree. Platform-only paths (/super, /templates, /tenant ...)
  // have no route there and end in the site's own 404 page.
  const rewritten = url.clone();
  rewritten.pathname = `/tenant/${info.host}${url.pathname === "/" ? "" : url.pathname}`;

  // Visitor ids are minted for public pages only (never for the admin panel or asset routes).
  const isPublic = !url.pathname.startsWith("/admin") && url.pathname !== "/icon";
  let code = req.cookies.get(VISITOR_COOKIE)?.value;
  let fresh = false;
  if (isPublic && !isValidVisitorCode(code)) {
    code = generateVisitorCode();
    fresh = true;
  }
  if (code && isValidVisitorCode(code)) {
    headers.set("x-dk-vid", code);
    if (fresh) headers.set("x-dk-vid-new", "1");
  }

  const res = NextResponse.rewrite(rewritten, { request: { headers } });
  if (code && isPublic) {
    const secure = req.nextUrl.protocol === "https:";
    res.cookies.set(VISITOR_COOKIE, code, { path: "/", maxAge: VISITOR_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false, secure });
    if (fresh) {
      // Short-lived marker read by the client runtime so a colliding random code is never merged into another visitor.
      res.cookies.set(VISITOR_FRESH_COOKIE, "1", { path: "/", maxAge: 120, sameSite: "lax", httpOnly: false, secure });
      res.headers.set("x-dk-vid-new", "1");
    }
  }
  return res;
}

export const config = {
  /**
   * Everything except Next's own build output and the handful of real files in `public/`.
   *
   * This used to exclude *any* path ending in an asset extension. Two things came out of that: a broken
   * `<img>`/`<script>` path on a tenant site answered with the platform's own 404 page instead of the
   * site's, and — because the proxy is what strips inbound `x-dk-*` headers — those paths were the one
   * place a client could still present its own `x-dk-host`. Listing the real assets instead keeps the
   * proxy in front of every route that resolves a tenant.
   *
   * robots.txt and sitemap.xml stay out: they are route handlers that read the forwarded host themselves
   * and answer for the canonical host.
   */
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|templates/[^/]+\\.(?:jpg|jpeg|png|webp)$).*)"],
};
