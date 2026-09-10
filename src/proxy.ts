import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/tenant";
import { generateVisitorCode, isValidVisitorCode } from "@/lib/visitor/code";
import { ROOT_DOMAIN, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";

const INTERNAL_HEADERS = ["x-dk-host", "x-dk-vid", "x-dk-vid-new", "x-dk-path"];

/**
 * Multi-tenant routing:
 *  - platform root domain  -> normal routes (/, /templates, /template/xxx, /super ...)
 *  - any other host        -> rewritten to /tenant/<host>/... and given a 6-digit visitor cookie
 * Internal x-dk-* headers are always stripped from the inbound request so clients cannot spoof them.
 */
export default function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const info = parseHost(rawHost, ROOT_DOMAIN);
  const headers = new Headers(req.headers);
  for (const h of INTERNAL_HEADERS) headers.delete(h);

  if (info.kind === "root") {
    if (url.pathname.startsWith("/tenant")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next({ request: { headers } });
  }

  // Tenant host: never expose platform-only routes.
  if (url.pathname.startsWith("/tenant") || url.pathname.startsWith("/super") || url.pathname.startsWith("/templates") || url.pathname.startsWith("/template")) {
    return new NextResponse("Not found", { status: 404 });
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

  const rewritten = url.clone();
  rewritten.pathname = `/tenant/${info.host}${url.pathname === "/" ? "" : url.pathname}`;

  const isPublic = !url.pathname.startsWith("/admin");
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)"],
};
