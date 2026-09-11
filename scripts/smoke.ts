/*
 * End-to-end smoke test against a production build (run `npm run build` first):
 *  1. seeds the local PGlite database with a demo site (Meta pixel with an invalid token)
 *  2. starts `next start` on a free port
 *  3. checks platform pages, all 60 template previews (both languages), the tenant site with the
 *     visitor cookie + WhatsApp link, SEO output, the tracking APIs (dedupe, rate limit, spoofing),
 *     uploads validation, admin/super auth guards and every admin page
 *  4. stops the server and verifies the visitor + event rows in the database
 */
import { randomUUID } from "node:crypto";
import { portFree, qaEnv, seedQa, startServer, stopServer, waitFor } from "./qa-lib";

const env = qaEnv("smoke", 3123);
const ROOT = env.root;

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}

async function main() {
  if (!(await portFree(env.port))) throw new Error(`port ${env.port} busy`);

  // 1. seed
  const seed = await seedQa({ slug: "demo", name: "Demo Decor", category: "gypsum", templateCode: "104", pixel: { platform: "meta", pixelId: "123456789", accessToken: "smoke-invalid-token" } });
  const { site, adminToken, superToken } = seed;
  const projectId = seed.projects[0]?.id ?? "";
  console.log("seeded demo site", site.id);

  // 2. start server
  let code = "";
  const server = startServer(env.port);
  const tenantHost = `demo.${ROOT}`;
  const tfetch = (p: string, init: RequestInit = {}, host = tenantHost) => fetch(`http://${ROOT}${p}`, { ...init, headers: { "x-forwarded-host": host, ...(init.headers as Record<string, string> | undefined) } });
  try {
    await waitFor(`http://${ROOT}/`, 90000, server);

    // 3a. platform pages
    const home = await fetch(`http://${ROOT}/`);
    check(home.status === 200, "GET / (platform home) 200");
    const gallery = await fetch(`http://${ROOT}/templates`);
    const galleryHtml = await gallery.text();
    check(gallery.status === 200 && galleryHtml.includes("/template/101") && galleryHtml.includes("/template/415"), "GET /templates lists 101..415");

    const { TEMPLATES } = await import("../src/templates/registry");
    let previewOk = 0;
    for (const t of TEMPLATES) {
      for (const lang of ["ar", "en"]) {
        const r = await fetch(`http://${ROOT}/template/${t.code}?lang=${lang}`);
        const html = await r.text();
        const good = r.status === 200 && html.includes(`data-template="${t.code}"`) && html.includes("wa.me/") && html.includes(lang === "ar" ? 'dir="rtl"' : 'dir="ltr"');
        if (good) previewOk++;
        else console.log(`  FAIL preview ${t.code} ${lang} status=${r.status}`);
      }
    }
    check(previewOk === TEMPLATES.length * 2, `all ${TEMPLATES.length} template previews render in ar + en (${previewOk}/${TEMPLATES.length * 2})`);
    const previewHtml = await (await fetch(`http://${ROOT}/template/205`)).text();
    check(previewHtml.includes('rel="canonical"') && previewHtml.includes("/templates/205.jpg"), "template preview has a canonical URL and an Open Graph thumbnail");
    check((await fetch(`http://${ROOT}/template/999`)).status === 404, "unknown template -> 404");
    check((await fetch(`http://${ROOT}/no-such-page`)).status === 404, "unknown platform path -> 404");
    const favicon = await fetch(`http://${ROOT}/favicon.ico`);
    check(favicon.status === 200 && (favicon.headers.get("content-type") || "").includes("icon"), "platform favicon.ico is served");

    // 3b. tenant site
    const site1 = await tfetch("/");
    const site1Html = await site1.text();
    const setCookie = site1.headers.get("set-cookie") || "";
    const codeMatch = setCookie.match(/dk_vid=(\d{6})/);
    check(site1.status === 200, "tenant site renders (Host: demo.localhost)");
    check(!!codeMatch, `visitor cookie dk_vid assigned (${codeMatch?.[1] ?? "none"})`);
    code = codeMatch?.[1] ?? "";
    const waLink = site1Html.match(/https:\/\/wa\.me\/96550000000\?text=([^"]+)"/);
    check(!!waLink && decodeURIComponent(waLink[1].replace(/&amp;/g, "&")).includes(code), "WhatsApp link contains the visitor id in the first message");
    check(site1Html.includes("Demo Decor"), "site brand rendered");
    // next/script (afterInteractive) loads pixels on the client; the pixel config must be in the page payload.
    check(site1Html.includes('"pixelId":"123456789"') || site1Html.includes("pixelId\\\":\\\"123456789"), "Meta browser pixel config delivered for active pixel");
    check(/<html[^>]*lang="ar"[^>]*dir="rtl"/.test(site1Html), "document language/direction are server-rendered (ar/rtl)");
    check(site1Html.includes('application/ld+json') && site1Html.includes("HomeAndConstructionBusiness"), "LocalBusiness structured data is embedded");
    check(/hreflang="en"/i.test(site1Html) && site1Html.includes('rel="canonical"'), "hreflang alternates and canonical are emitted");
    check(site1Html.includes('href="?lang=en"'), "language toggle is a crawlable link");
    const enQuery = await tfetch("/?lang=en", { headers: { cookie: `dk_vid=${code}` } });
    const enQueryHtml = await enQuery.text();
    check(/<html[^>]*lang="en"[^>]*dir="ltr"/.test(enQueryHtml) && enQueryHtml.includes("WhatsApp us"), "?lang=en renders the English document server-side");
    const icon = await tfetch("/icon");
    check(icon.status === 200 && (icon.headers.get("content-type") || "").includes("image/svg+xml") && !(icon.headers.get("set-cookie") || "").includes("dk_vid="), "fallback favicon monogram is served without minting a visitor id");
    check((await tfetch("/favicon.ico")).status === 200, "favicon.ico also resolves on tenant hosts");

    const site2 = await tfetch("/", { headers: { cookie: `dk_vid=${code}` } });
    check((site2.headers.get("set-cookie") || "").includes(`dk_vid=${code}`) || !(site2.headers.get("set-cookie") || "").includes("dk_vid="), "existing visitor keeps the same id");
    check(!(site2.headers.get("set-cookie") || "").match(/dk_vid=(?!\d{6}; |\d{6};)/), "no second id is ever issued to a returning visitor");

    const track = await tfetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dk_vid=${code}`, "user-agent": "smoke" },
      body: JSON.stringify({ code, url: `http://${tenantHost}/?fbclid=SMOKE123`, referrer: "https://www.instagram.com/", cookies: { _fbp: "fb.1.1.1" } }),
    });
    const trackJson = (await track.json()) as { ok?: boolean; created?: boolean };
    // The first render already created the visitor server-side, so the client call only enriches it.
    check(track.status === 200 && trackJson.ok === true && trackJson.created === false, `POST /api/track accepts the visit (${JSON.stringify(trackJson)})`);
    const spoofed = await tfetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "999999", url: `http://${tenantHost}/` }) });
    const spoofJson = (await spoofed.json()) as { ok?: boolean; created?: boolean };
    const spoofCookie = spoofed.headers.get("set-cookie") || "";
    check(spoofed.status === 200 && spoofCookie.includes("dk_vid=") && !spoofCookie.includes("dk_vid=999999") && spoofJson.created === true, `a client-chosen visitor code is ignored and a server code is issued instead (${JSON.stringify(spoofJson)})`);

    const ev = await tfetch("/api/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dk_vid=${code}` },
      body: JSON.stringify({ code, eventKey: "whatsapp_click", eventId: "smoke-evt-1", url: `http://${tenantHost}/` }),
    });
    const evJson = (await ev.json()) as { ok?: boolean; eventId?: string };
    check(ev.status === 200 && evJson.ok === true && evJson.eventId === "smoke-evt-1", "POST /api/track/event stores the WhatsApp click");
    const dup = await tfetch("/api/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `dk_vid=${code}` },
      body: JSON.stringify({ eventKey: "whatsapp_click", eventId: "smoke-evt-2", url: `http://${tenantHost}/` }),
    });
    const dupJson = (await dup.json()) as { ok?: boolean; deduped?: boolean };
    check(dup.status === 200 && dupJson.deduped === true, `a repeated click inside the dedupe window is not sent again (${JSON.stringify(dupJson)})`);
    // The per-IP limit for click events is 30 per minute: keep posting (as a second visitor) until it trips.
    const second = await tfetch("/", { headers: { "user-agent": "smoke-2" } });
    const code2 = (second.headers.get("set-cookie") || "").match(/dk_vid=(\d{6})/)?.[1] ?? "";
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await tfetch("/api/track/event", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `dk_vid=${code2}` },
        body: JSON.stringify({ eventKey: i % 2 ? "whatsapp_click" : "call_click", eventId: `flood-${i}`, url: `http://${tenantHost}/` }),
      });
      if (r.status === 429) limited = true;
    }
    check(limited, "click events are rate limited per IP (429 after the burst)");

    const en = await tfetch("/", { headers: { cookie: `dk_vid=${code}; dk_lang=en` } });
    check((await en.text()).includes('dir="ltr"'), "language cookie switches the site to English");

    // 3c. auth guards
    const adminRedirect = await tfetch("/admin", { redirect: "manual" });
    check([302, 303, 307, 308].includes(adminRedirect.status) && (adminRedirect.headers.get("location") || "").includes("/admin/login"), "tenant /admin redirects to login when signed out");
    const adminLogin = await tfetch("/admin/login");
    check(adminLogin.status === 200, "tenant /admin/login renders");
    const superRedirect = await fetch(`http://${ROOT}/super`, { redirect: "manual" });
    check([302, 303, 307, 308].includes(superRedirect.status) && (superRedirect.headers.get("location") || "").includes("/super/login"), "/super redirects to login when signed out");
    check((await fetch(`http://${ROOT}/super/login`)).status === 200, "/super/login renders");

    // 3d. authenticated admin + super admin pages render (session cookies created during seeding)
    const adminPages = [
      "/admin",
      "/admin/visitors",
      `/admin/visitors/${code}`,
      "/admin/content",
      "/admin/content/general",
      "/admin/content/hero",
      "/admin/content/about",
      "/admin/content/services",
      "/admin/content/stats",
      "/admin/content/process",
      "/admin/content/testimonials",
      "/admin/content/faq",
      "/admin/content/cta",
      "/admin/content/seo",
      "/admin/content/theme",
      "/admin/content/sections",
      "/admin/content/labels",
      "/admin/content/legal",
      "/admin/projects",
      "/admin/projects/new?type=progress",
      `/admin/projects/${projectId}`,
      "/admin/marketing",
      "/admin/settings",
    ];
    let adminOk = 0;
    for (const p of adminPages) {
      const r = await tfetch(p, { headers: { cookie: `dk_session=${adminToken}` } });
      const html = await r.text();
      if (r.status === 200 && html.includes("Demo Decor")) adminOk++;
      else console.log(`  FAIL admin page ${p} status=${r.status}`);
      if (p === "/admin/marketing") check(!html.includes("smoke-invalid-token"), "marketing page never echoes the stored access token");
    }
    check(adminOk === adminPages.length, `all ${adminPages.length} admin pages render for a signed-in site admin`);
    const adminOnOtherSite = await tfetch("/admin", { headers: { cookie: `dk_session=${adminToken}` } }, `unknown.${ROOT}`);
    check(adminOnOtherSite.status === 404, "admin of an unknown site -> 404");

    const privacy = await tfetch("/privacy");
    const privacyHtml = await privacy.text();
    check(privacy.status === 200 && privacyHtml.includes("سياسة الخصوصية") && privacyHtml.includes(`data-template="104"`), "privacy policy page renders inside the site template");
    const missing = await tfetch("/no-such-page");
    const missingHtml = await missing.text();
    // Next delivers not-found UI through the RSC payload (status 404 + noindex); the branded page must be in that payload.
    check(missing.status === 404 && missingHtml.includes("الصفحة غير موجودة") && missingHtml.includes("wa.me/96550000000") && missingHtml.includes("noindex"), "unknown page on a tenant host shows the site's own 404 with its WhatsApp contact");

    // uploads: validation is enforced server-side for signed-in admins
    const svg = await tfetch("/api/upload", { method: "POST", headers: { "content-type": "application/json", cookie: `dk_session=${adminToken}` }, body: JSON.stringify({ siteId: site.id, filename: "logo.svg", contentType: "image/svg+xml", size: 100 }) });
    check(svg.status === 400 && ((await svg.json()) as { error?: string }).error === "unsupported_type", "SVG uploads are refused");
    const unissued = await tfetch(`/api/upload/local?key=${encodeURIComponent(`sites/${site.id}/2026/01/${randomUUID()}-x.png`)}`, { method: "POST", headers: { "content-type": "image/png", cookie: `dk_session=${adminToken}` }, body: new Uint8Array([1, 2, 3]) });
    check(unissued.status === 400 && ((await unissued.json()) as { error?: string }).error === "key_not_issued", "local upload without an issued key is refused");
    const anon = await tfetch("/api/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId: site.id, filename: "a.png", contentType: "image/png", size: 10 }) });
    check(anon.status === 401, "anonymous upload requests are rejected");

    const superPages = ["/super", "/super/sites/new", `/super/sites/${site.id}`, "/super/users", "/super/templates"];
    let superOk = 0;
    for (const p of superPages) {
      const r = await fetch(`http://${ROOT}${p}`, { headers: { cookie: `dk_session=${superToken}` } });
      const html = await r.text();
      if (r.status === 200 && (html.includes("المشرف العام") || html.includes("Super admin"))) superOk++;
      else console.log(`  FAIL super page ${p} status=${r.status}`);
    }
    check(superOk === superPages.length, `all ${superPages.length} super admin pages render for the owner`);
    const superAsAdmin = await fetch(`http://${ROOT}/super`, { headers: { cookie: `dk_session=${adminToken}` }, redirect: "manual" });
    check([302, 303, 307, 308].includes(superAsAdmin.status), "non-super user is redirected away from /super");

    const robotsTenant = await (await tfetch("/robots.txt")).text();
    check(robotsTenant.includes("Disallow: /admin") && robotsTenant.includes(`http://${tenantHost}/sitemap.xml`), "tenant robots.txt hides /admin and points to its sitemap");
    const robotsUnknown = await (await tfetch("/robots.txt", {}, `unknown.${ROOT}`)).text();
    check(robotsUnknown.includes("Disallow: /") && !robotsUnknown.includes("Allow"), "unknown hosts are closed to crawlers");
    const sitemapTenant = await tfetch("/sitemap.xml");
    const sitemapHtml = await sitemapTenant.text();
    check(sitemapTenant.status === 200 && sitemapHtml.includes("<urlset") && sitemapHtml.includes("?lang=en") && sitemapHtml.includes("/privacy"), "tenant sitemap.xml lists both languages and the privacy page");
    const sitemapRoot = await (await fetch(`http://${ROOT}/sitemap.xml`)).text();
    check(sitemapRoot.includes("/template/101") && sitemapRoot.includes("/template/415"), "platform sitemap lists every template preview");
    const superOnTenant = await tfetch("/super");
    check(superOnTenant.status === 404 && (await superOnTenant.text()).includes("wa.me/96550000000"), "platform routes are hidden on tenant hosts (branded 404)");
    check((await tfetch("/", {}, `unknown.${ROOT}`)).status === 404, "unknown subdomain -> 404");
  } finally {
    await stopServer(server);
  }

  // 4. verify database rows
  await new Promise((r) => setTimeout(r, 1500));
  const { getDb, resetDb } = await import("../src/lib/db/client");
  await getDb();
  const { getVisitorByCode } = await import("../src/lib/db/visitors");
  const { listVisitorEvents } = await import("../src/lib/db/events");
  const visitors = await (await getDb()).query<{ code: string; whatsapp_clicks: number; source_platform: string }>(`select code, whatsapp_clicks, source_platform from visitors order by first_seen_at`);
  const v = visitors.find((x) => x.code === code);
  check(visitors.length === 3, `three visitors stored: the real one, the server-issued replacement for the spoofed code, and the second browser (${visitors.length})`);
  check(v?.source_platform === "meta" && Number(v?.whatsapp_clicks) === 1, "visitor has meta source (last-touch fbclid) and exactly 1 WhatsApp click (the duplicate was ignored)");
  const full = v ? await getVisitorByCode(site.id, v.code) : null;
  const events = full ? await listVisitorEvents(full.id) : [];
  check(events.some((e) => e.eventType === "whatsapp_click" && e.eventId === "smoke-evt-1"), "whatsapp_click event stored with shared event id");
  check(!events.some((e) => e.eventId === "smoke-evt-2"), "the deduplicated click created no second event");
  const delivered = events.find((e) => e.eventType === "whatsapp_click");
  check(delivered?.targets.join(",") === "meta", `signal routed to Meta only (visitor came from Meta) — targets: ${delivered?.targets.join(",")}`);
  check(delivered?.deliveries[0]?.platform === "meta" && delivered?.deliveries[0]?.ok === false, `Meta CAPI attempted and rejected the invalid token (${JSON.stringify(delivered?.deliveries[0] ?? null).slice(0, 160)})`);
  await resetDb();

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll smoke checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
