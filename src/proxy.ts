import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/tenant";
import { generateVisitorCode, isValidVisitorCode } from "@/lib/visitor/code";
import { ROOT_DOMAIN, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";
import { VISITOR_SECRET_COOKIE, VISITOR_SECRET_HEADER, VISITOR_SECRET_MAX_AGE, generateVisitorSecret, isValidVisitorSecret } from "@/lib/auth/visitor-secret";

// `content-security-policy` is in here because Next derives the nonce it stamps onto its own inline
// scripts from the CSP header *on the request*: an inbound copy is a client choosing its own nonce.
const INTERNAL_HEADERS = ["x-dk-host", "x-dk-vid", "x-dk-vid-new", "x-dk-vsec", "x-dk-bot", "x-dk-path", "x-dk-lang", "x-nonce", "content-security-policy"];

/**
 * User agents that get no visitor identity and no tracking.
 *
 * Every cookieless request to a public path used to mint a code and, on the server render, insert a
 * `visitors` row with the caller's IP and user agent. Tenant robots.txt invites crawlers, so the visitor
 * list filled with GPTBot and AhrefsBot rows — each one a function invocation, a database write, and a row
 * the owner has to scroll past to find a real lead.
 *
 * Substring match against the lowercased UA. Keep the entries lowercase, keep them grouped, and prefer a
 * distinctive fragment over a short one ("bot" alone also matches "Cubot", which is a phone).
 *
 * Deliberately NOT listed: `headlesschrome` and a bare `node`/`undici`. Playwright drives a headless
 * Chromium in `scripts/e2e.ts` and the smoke run calls the endpoints from Node, and both have to keep
 * exercising the real visitor path.
 */
const BOT_UA = [
  // Search engines
  "googlebot", "google-inspectiontool", "bingbot", "yandexbot", "duckduckbot", "baiduspider", "slurp", "seznambot", "sogou",
  // AI / LLM crawlers
  "gptbot", "oai-searchbot", "chatgpt-user", "claudebot", "claude-web", "anthropic-ai", "perplexitybot", "perplexity-user",
  "google-extended", "ccbot", "bytespider", "amazonbot", "applebot", "meta-externalagent", "cohere-ai", "diffbot", "timpibot",
  // SEO / marketing crawlers
  "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "dataforseobot", "petalbot", "blexbot", "serpstatbot", "screaming frog",
  "barkrowler", "zoominfobot", "megaindex", "linkdexbot",
  // Link unfurlers and social preview fetchers (the person who tapped the link arrives later, in a browser)
  "facebookexternalhit", "twitterbot", "linkedinbot", "slackbot", "telegrambot", "whatsapp", "discordbot", "embedly",
  "pinterest", "redditbot", "quora link preview", "skypeuripreview",
  // Uptime monitors, auditors and validators
  "uptimerobot", "pingdom", "statuscake", "site24x7", "newrelicpinger", "lighthouse", "chrome-lighthouse",
  "google page speed", "validator.nu", "w3c_validator", "vercel-screenshot",
  // Generic scrapers and HTTP libraries
  "python-requests", "scrapy", "libwww-perl", "go-http-client", "okhttp", "apache-httpclient", "wget/", "curl/", "httrack",
] as const;

const BOT_RE = new RegExp(BOT_UA.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

function isBot(ua: string | null): boolean {
  // An empty UA is not evidence of a bot: privacy extensions strip it, and so do some in-app browsers.
  return !!ua && BOT_RE.test(ua);
}

/** Admin and super panels, addressed by the path the request actually arrived on. */
function isPanelPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/super" || pathname.startsWith("/super/");
}

/**
 * Strict CSP for the panels, with a per-request nonce.
 *
 * Next streams the RSC payload through inline `<script>` tags, so a flat `script-src 'self'` would leave
 * the panel unhydrated. Next reads the nonce out of the CSP header *on the request* and stamps it onto
 * everything it emits, which is why the same value goes on both the request and the response. Both panel
 * segments are `dynamic = "force-dynamic"`, which is what makes a per-request nonce possible at all.
 *
 * `style-src` keeps `'unsafe-inline'`: a nonce does not cover `style=` attributes, and the panels use a
 * handful of them for computed widths and template swatches. CSS injection is not the threat being
 * addressed here; script injection is, and that is the directive that is locked down.
 *
 * `img-src` allows any https origin because uploaded media is served from the R2 public bucket, which is
 * a different origin in every deployment. `unsafe-eval` in development only: React uses eval there to
 * rebuild server stacks in the browser.
 *
 * `connect-src` has to name the bucket too, and for a reason that is easy to miss: the panel does not
 * upload *through* this origin. `/api/upload` only hands back a presigned URL, and the browser then PUTs
 * the file straight to R2 — a cross-origin request that a bare `connect-src 'self'` refuses before it
 * leaves the page. The XHR reports that refusal as a plain network error, so the owner was told
 * "connection lost" while the network was fine. Local development stores uploads on disk through a
 * same-origin route, which is why every test passed: the bug only exists once R2 is configured.
 */
function r2Origins(): string[] {
  const out: string[] = [];
  const account = process.env.R2_ACCOUNT_ID?.trim();
  // Where the presigned PUT actually goes (the S3 API endpoint, not the public bucket URL).
  if (account) out.push(`https://${account}.r2.cloudflarestorage.com`);
  // The public bucket — a custom domain or r2.dev — for anything that reads a stored object back.
  const pub = process.env.R2_PUBLIC_URL?.trim();
  if (pub) {
    try {
      out.push(new URL(pub).origin);
    } catch {
      // A malformed R2_PUBLIC_URL is a deployment problem /api/health already reports; do not let it
      // throw here, or every panel request 500s on a bad environment variable.
    }
  }
  return [...new Set(out)];
}

function panelCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const connect = ["'self'", ...r2Origins()].join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

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

  // The panels are the only pages that can take a strict CSP today; public tenant pages inline the
  // ad-pixel bootstraps and would go dark under a `script-src 'self'`.
  const nonce = isPanelPath(url.pathname) ? crypto.randomUUID().replace(/-/g, "") : null;
  const csp = nonce ? panelCsp(nonce) : null;
  if (nonce && csp) {
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
  }

  const withCsp = (res: NextResponse) => {
    if (csp) res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (info.kind === "root") {
    if (url.pathname.startsWith("/tenant")) return new NextResponse("Not found", { status: 404 });
    return withCsp(NextResponse.next({ request: { headers } }));
  }

  // One canonical host per custom domain: www.example.com -> example.com (keeps one visitor id per person).
  if (info.subdomain === null && info.host.startsWith("www.")) {
    const target = url.clone();
    target.host = info.host.slice(4);
    return NextResponse.redirect(target, 308);
  }

  headers.set("x-dk-host", info.host);
  headers.set("x-dk-path", `${url.pathname}${url.search}`.slice(0, 1500));

  const bot = isBot(req.headers.get("user-agent"));
  if (bot) headers.set("x-dk-bot", "1");

  // API routes are shared by all hosts; pass them through with the tenant host header only.
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers } });
  }

  // Everything else is served from the tenant tree. Platform-only paths (/super, /templates, /tenant ...)
  // have no route there and end in the site's own 404 page.
  const rewritten = url.clone();
  rewritten.pathname = `/tenant/${info.host}${url.pathname === "/" ? "" : url.pathname}`;

  // Visitor ids are minted for public pages only (never for the admin panel or asset routes), and never
  // for a crawler: a bot handed a code costs a visitor row carrying an IP and a user agent, plus the
  // writes to create it, and the owner's lead list is what pays for it.
  const isPublic = !url.pathname.startsWith("/admin") && url.pathname !== "/icon" && !bot;
  const cookieCode = req.cookies.get(VISITOR_COOKIE)?.value;
  const cookieSecret = req.cookies.get(VISITOR_SECRET_COOKIE)?.value;
  // A code without its secret is an identity nobody can prove — which is exactly what the old scheme
  // handed out, since any caller could present any code. Such a pair counts as no identity at all, so a
  // returning pre-`dk_vsec` visitor is re-identified once instead of staying forgeable forever.
  const known = isValidVisitorCode(cookieCode) && isValidVisitorSecret(cookieSecret);
  const fresh = isPublic && !known;
  const identity = !isPublic ? null : known ? { code: cookieCode as string, secret: cookieSecret as string } : { code: generateVisitorCode(), secret: generateVisitorSecret() };
  if (identity) {
    headers.set("x-dk-vid", identity.code);
    headers.set(VISITOR_SECRET_HEADER, identity.secret);
    if (fresh) headers.set("x-dk-vid-new", "1");
  }

  const res = withCsp(NextResponse.rewrite(rewritten, { request: { headers } }));
  if (identity) {
    const secure = req.nextUrl.protocol === "https:";
    res.cookies.set(VISITOR_COOKIE, identity.code, { path: "/", maxAge: VISITOR_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false, secure });
    // HttpOnly: the code may be read by the page (it is printed into the WhatsApp message), the secret
    // never may, or one XSS on any tenant page hands over every visitor identity it can see.
    res.cookies.set(VISITOR_SECRET_COOKIE, identity.secret, { path: "/", maxAge: VISITOR_SECRET_MAX_AGE, sameSite: "lax", httpOnly: true, secure });
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
