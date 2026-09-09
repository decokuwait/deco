import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/tenant";
import { generateVisitorCode, isValidVisitorCode } from "@/lib/visitor/code";
import { ROOT_DOMAIN, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from "@/lib/config";

/**
 * Multi-tenant routing:
 *  - platform root domain  -> normal routes (/, /templates, /template/xxx, /super ...)
 *  - any other host        -> rewritten to /tenant/<host>/... and given a 6-digit visitor cookie
 */
export default function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const info = parseHost(rawHost, ROOT_DOMAIN);

  if (info.kind === "root") {
    if (url.pathname.startsWith("/tenant")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next();
  }

  // Tenant host: never expose platform-only routes.
  if (url.pathname.startsWith("/tenant") || url.pathname.startsWith("/super") || url.pathname.startsWith("/templates") || url.pathname.startsWith("/template/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers(req.headers);
  headers.set("x-dk-host", info.host);

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
  if (code) headers.set("x-dk-vid", code);

  const res = NextResponse.rewrite(rewritten, { request: { headers } });
  if (code && isPublic) {
    res.cookies.set(VISITOR_COOKIE, code, {
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: req.nextUrl.protocol === "https:",
    });
    if (fresh) res.headers.set("x-dk-vid-new", "1");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)"],
};
