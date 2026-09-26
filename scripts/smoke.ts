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

// Patterns for the project/service page checks. Declared here, without the `g` flag where
// `.test()` is used: a global regex carries lastIndex between calls and starts skipping matches.
const ALT_MISSING = /<img\b(?![^>]*\salt="[^"]+")[^>]*>/;
const PROJECT_HREF = /href="\/projects\/[^"]+"/;
const SERVICE_HREF = /href="\/services\/([^"]+)"/g;

async function main() {
  if (!(await portFree(env.port))) throw new Error(`port ${env.port} busy`);

  // 1. seed
  const seed = await seedQa({ slug: "demo", name: "Demo Decor", category: "gypsum", templateCode: "104", pixel: { platform: "meta", pixelId: "123456789", accessToken: "smoke-invalid-token" } });
  const { site, adminToken, superToken } = seed;
  const projectId = seed.projects[0]?.id ?? "";
  console.log("seeded demo site", site.id);

  // 2. start server
  let code = "";
  // A visitor identity is the readable code AND the HttpOnly dk_vsec secret; the endpoints refuse a
  // code presented without it, which is the whole point of the secret.
  let vsec = "";
  const visitorCookie = () => `dk_vid=${code}; dk_vsec=${vsec}`;
  const server = startServer(env.port);
  const tenantHost = `demo.${ROOT}`;
  const tfetch = (p: string, init: RequestInit = {}, host = tenantHost) => fetch(`http://${ROOT}${p}`, { ...init, headers: { "x-forwarded-host": host, ...(init.headers as Record<string, string> | undefined) } });
  try {
    await waitFor(`http://${ROOT}/`, 90000, server);

    // 3a. platform pages
    const home = await fetch(`http://${ROOT}/`);
    check(home.status === 200, "GET / (platform home) 200");
    const homeHtml = await home.text();
    // The home page has to be able to sell: a price, a request form and an Arabic canonical/OG.
    check(homeHtml.includes("اطلب موقعك") && homeHtml.includes('id="request"'), "platform home carries the request form");
    check(homeHtml.includes('rel="canonical"') && homeHtml.includes('property="og:image"'), "platform home has a canonical URL and an Open Graph image");
    const pricing = await fetch(`http://${ROOT}/pricing`);
    const pricingHtml = await pricing.text();
    check(pricing.status === 200 && pricingHtml.includes("د.ك") && pricingHtml.includes('id="terms"'), "GET /pricing shows prices in KWD and the terms section");

    const gallery = await fetch(`http://${ROOT}/templates`);
    const galleryHtml = await gallery.text();
    check(gallery.status === 200 && galleryHtml.includes("/template/101") && galleryHtml.includes("/template/415"), "GET /templates lists 101..415");

    // Picking a category must narrow the gallery to that trade only.
    const gyp = await fetch(`http://${ROOT}/templates/gypsum`);
    const gypHtml = await gyp.text();
    const onlyGypsum = gypHtml.includes("/template/101") && gypHtml.includes("/template/115") && !gypHtml.includes("/template/201") && !gypHtml.includes("/template/415");
    check(gyp.status === 200 && onlyGypsum, "GET /templates/gypsum shows only 101..115");
    const cer = await fetch(`http://${ROOT}/templates/ceramic`);
    const cerHtml = await cer.text();
    check(cer.status === 200 && cerHtml.includes("/template/401") && !cerHtml.includes("/template/101"), "GET /templates/ceramic shows only the ceramic templates");
    check(gypHtml.includes('aria-current="page"') && gypHtml.includes('href="/templates"'), "active category pill is marked and links back to the full gallery");
    check((await fetch(`http://${ROOT}/templates/nonsense`)).status === 404, "unknown category -> 404");

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
    check(/<meta name="robots" content="noindex/.test(previewHtml), "template preview is noindex");
    check(!/hreflang=/.test(previewHtml), "template preview emits no hreflang cluster");
    check((await fetch(`http://${ROOT}/template/999`)).status === 404, "unknown template -> 404");
    check((await fetch(`http://${ROOT}/no-such-page`)).status === 404, "unknown platform path -> 404");
    const favicon = await fetch(`http://${ROOT}/favicon.ico`);
    check(favicon.status === 200 && (favicon.headers.get("content-type") || "").includes("icon"), "platform favicon.ico is served");

    // 3b. tenant site
    const site1 = await tfetch("/");
    const site1Html = await site1.text();
    const setCookie = site1.headers.get("set-cookie") || "";
    const codeMatch = setCookie.match(/dk_vid=(\d{6})/);
    const secretMatch = setCookie.match(/dk_vsec=([0-9a-f]{32})/);
    check(site1.status === 200, "tenant site renders (Host: demo.localhost)");
    check(!!codeMatch, `visitor cookie dk_vid assigned (${codeMatch?.[1] ?? "none"})`);
    code = codeMatch?.[1] ?? "";
    vsec = secretMatch?.[1] ?? "";
    // The code may be read by the page (it is printed in the WhatsApp message); the secret never may.
    check(!!secretMatch, `visitor secret dk_vsec assigned (${secretMatch ? "yes" : "no"})`);
    check(/dk_vsec=[0-9a-f]{32};[^,]*?HttpOnly/i.test(setCookie.replace(/Expires=[^;]+;/gi, "")), "dk_vsec is HttpOnly");
    check(!/dk_vid=\d{6};[^,]*?HttpOnly/i.test(setCookie.replace(/Expires=[^;]+;/gi, "")), "dk_vid stays readable by the page");
    const waLink = site1Html.match(/https:\/\/wa\.me\/96550000000\?text=([^"]+)"/);
    check(!!waLink && decodeURIComponent(waLink[1].replace(/&amp;/g, "&")).includes(code), "WhatsApp link contains the visitor id in the first message");
    check(site1Html.includes("Demo Decor"), "site brand rendered");
    // next/script (afterInteractive) loads pixels on the client; the pixel config must be in the page payload.
    check(site1Html.includes('"pixelId":"123456789"') || site1Html.includes("pixelId\\\":\\\"123456789"), "Meta browser pixel config delivered for active pixel");
    check(/<html[^>]*lang="ar"[^>]*dir="rtl"/.test(site1Html), "document language/direction are server-rendered (ar/rtl)");
    check(site1Html.includes('application/ld+json') && site1Html.includes("HomeAndConstructionBusiness"), "LocalBusiness structured data is embedded");
    check(/hreflang="en"/i.test(site1Html) && site1Html.includes('rel="canonical"'), "hreflang alternates and canonical are emitted");
    check(site1Html.includes('href="?lang=en"'), "language toggle is a crawlable link");
    const enQuery = await tfetch("/?lang=en", { headers: { cookie: visitorCookie() } });
    const enQueryHtml = await enQuery.text();
    check(/<html[^>]*lang="en"[^>]*dir="ltr"/.test(enQueryHtml) && enQueryHtml.includes("WhatsApp us"), "?lang=en renders the English document server-side");
    const icon = await tfetch("/icon");
    check(icon.status === 200 && (icon.headers.get("content-type") || "").includes("image/svg+xml") && !(icon.headers.get("set-cookie") || "").includes("dk_vid="), "fallback favicon monogram is served without minting a visitor id");
    check((await tfetch("/favicon.ico")).status === 200, "favicon.ico also resolves on tenant hosts");

    // 3b-i. Project and service pages. A tenant used to be exactly one indexable URL; these
    // are the ten to forty that replace it, so the smoke run proves each answers 200 with its own
    // content, that its photographs are in the HTML, and that an unknown slug is a real 404.
    const demoProject = seed.projects.find((p) => p.type === "finished" && p.published);
    const demoProgress = seed.projects.find((p) => p.type === "progress" && p.published);
    const projectsIndex = await tfetch("/projects", { headers: { cookie: visitorCookie() } });
    const projectsIndexHtml = await projectsIndex.text();
    check(projectsIndex.status === 200 && projectsIndexHtml.includes("data-template="), "GET /projects renders inside the tenant's own template");
    check(!!demoProject && projectsIndexHtml.includes(`href="/projects/${demoProject.slug}"`), "the portfolio index links every project to its own page");
    const projectPage = await tfetch(`/projects/${demoProject?.slug ?? "none"}`, { headers: { cookie: visitorCookie() } });
    const projectHtml = await projectPage.text();
    check(projectPage.status === 200 && !!demoProject && projectHtml.includes(demoProject.title.ar), "GET /projects/<slug> renders the project");
    check(projectHtml.includes("BreadcrumbList") && projectHtml.includes('"position":2'), "project page emits BreadcrumbList with at least two items");
    check(projectHtml.includes('"@type":"ImageObject"'), "project page emits ImageObject markup for its photos");
    // An <img> with no alt, or with alt="", is a photograph declared decorative on a page made of photographs.
    check(!ALT_MISSING.test(projectHtml), "every image on the project page carries non-empty alt text");
    check(decodeURIComponent(projectHtml.replace(/&amp;/g, "&")).includes(code), "project page WhatsApp link carries the visitor id");
    check(projectHtml.includes('rel="canonical"'), "project page declares a canonical URL");
    const progressHtml = demoProgress ? await (await tfetch(`/projects/${demoProgress.slug}`, { headers: { cookie: visitorCookie() } })).text() : "";
    const stepUrls = (demoProgress?.media ?? []).filter((m) => m.role === "step").map((m) => m.url);
    check(stepUrls.length > 1 && stepUrls.every((u) => progressHtml.includes(u)), "a progress project server-renders every stage, not just the first slide");
    check((await tfetch("/projects/no-such-project", { headers: { cookie: visitorCookie() } })).status === 404, "unknown project slug -> 404");

    const servicesIndex = await tfetch("/services", { headers: { cookie: visitorCookie() } });
    const servicesIndexHtml = await servicesIndex.text();
    const serviceHrefs = [...servicesIndexHtml.matchAll(SERVICE_HREF)].map((m) => m[1]);
    check(servicesIndex.status === 200 && new Set(serviceHrefs).size >= 3, `GET /services gives each service its own URL (${new Set(serviceHrefs).size})`);
    const servicePage = await tfetch(`/services/${serviceHrefs[0] ?? "none"}`, { headers: { cookie: visitorCookie() } });
    const serviceHtml = await servicePage.text();
    check(servicePage.status === 200 && serviceHtml.includes('"@type":"Service"'), "GET /services/<slug> renders with Service markup");
    check(PROJECT_HREF.test(serviceHtml), "a service page links to the work that proves it");
    check(!ALT_MISSING.test(serviceHtml), "every image on the service page carries non-empty alt text");
    check((await tfetch("/services/not-a-service", { headers: { cookie: visitorCookie() } })).status === 404, "unknown service slug -> 404");

    const site2 = await tfetch("/", { headers: { cookie: visitorCookie() } });
    check((site2.headers.get("set-cookie") || "").includes(`dk_vid=${code}`) || !(site2.headers.get("set-cookie") || "").includes("dk_vid="), "existing visitor keeps the same id");
    check(!(site2.headers.get("set-cookie") || "").match(/dk_vid=(?!\d{6}; |\d{6};)/), "no second id is ever issued to a returning visitor");

    // A real browser on a first visit still carries the proxy's `dk_vid_new` marker when SiteRuntime
    // posts this, and that marker is what lets the landing URL set the row's attribution. Without it the
    // call is a *within-visit* touch, and re-attributing there is exactly the hijack that was closed:
    // anyone could POST a stranger's code with their own fbclid and steal the lead's source.
    const track = await tfetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${visitorCookie()}; dk_vid_new=1`, "user-agent": "smoke" },
      body: JSON.stringify({ code, url: `http://${tenantHost}/?fbclid=SMOKE123`, referrer: "https://www.instagram.com/", cookies: { _fbp: "fb.1.1.1" } }),
    });
    const trackJson = (await track.json()) as { ok?: boolean; created?: boolean };
    check(track.status === 200 && trackJson.ok === true, `POST /api/track accepts the visit (${JSON.stringify(trackJson)})`);
    // The response used to carry `created`, which answered "does this 6-digit code exist?" for anyone who
    // cared to ask 900,000 times. A hit and a miss must now look identical.
    check(!("created" in trackJson), `/api/track no longer says whether the code existed (${JSON.stringify(trackJson)})`);
    // /api/track re-issues the pair for whatever row it ended up on; follow it, as a browser would.
    const trackCookie = track.headers.get("set-cookie") || "";
    code = trackCookie.match(/dk_vid=(\d{6})/)?.[1] ?? code;
    vsec = trackCookie.match(/dk_vsec=([0-9a-f]{32})/)?.[1] ?? vsec;

    const spoofed = await tfetch("/api/track", { method: "POST", headers: { "content-type": "application/json", cookie: `dk_vid=${code}` }, body: JSON.stringify({ code: "999999", url: `http://${tenantHost}/` }) });
    const spoofJson = (await spoofed.json()) as { ok?: boolean; created?: boolean };
    const spoofCookie = spoofed.headers.get("set-cookie") || "";
    const spoofCode = spoofCookie.match(/dk_vid=(\d{6})/)?.[1] ?? "";
    // A code with no secret is not an identity: the caller gets a server-allocated one, never the code it
    // named and never the one it presented without proof.
    check(spoofed.status === 200 && !!spoofCode && spoofCode !== "999999" && spoofCode !== code, `a visitor code presented without its secret is ignored and a server code is issued instead (${spoofCode})`);
    check(spoofCookie.includes("dk_vsec="), "the new identity is issued with its secret");
    check(!("created" in spoofJson), "a guessed code gets the same answer as a real one");

    const ev = await tfetch("/api/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: visitorCookie() },
      body: JSON.stringify({ code, eventKey: "whatsapp_click", eventId: "smoke-evt-1", url: `http://${tenantHost}/` }),
    });
    const evJson = (await ev.json()) as { ok?: boolean; eventId?: string };
    check(ev.status === 200 && evJson.ok === true && evJson.eventId === "smoke-evt-1", "POST /api/track/event stores the WhatsApp click");
    const dup = await tfetch("/api/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: visitorCookie() },
      body: JSON.stringify({ eventKey: "whatsapp_click", eventId: "smoke-evt-2", url: `http://${tenantHost}/` }),
    });
    const dupJson = (await dup.json()) as { ok?: boolean; deduped?: boolean };
    check(dup.status === 200 && dupJson.deduped === true, `a repeated click inside the dedupe window is not sent again (${JSON.stringify(dupJson)})`);
    // The per-IP limit for click events is 30 per minute: keep posting until it trips. The limit is checked
    // before the dedupe window, so a known-good identity is what proves it.
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await tfetch("/api/track/event", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: visitorCookie() },
        body: JSON.stringify({ eventKey: i % 2 ? "whatsapp_click" : "call_click", eventId: `flood-${i}`, url: `http://${tenantHost}/` }),
      });
      if (r.status === 429) limited = true;
    }
    check(limited, "click events are rate limited per IP (429 after the burst)");

    const en = await tfetch("/", { headers: { cookie: `${visitorCookie()}; dk_lang=en` } });
    check((await en.text()).includes('dir="ltr"'), "language cookie switches the site to English");

    // 3c. auth guards
    const adminRedirect = await tfetch("/admin", { redirect: "manual" });
    check([302, 303, 307, 308].includes(adminRedirect.status) && (adminRedirect.headers.get("location") || "").includes("/admin/login"), "tenant /admin redirects to login when signed out");
    const adminLogin = await tfetch("/admin/login");
    check(adminLogin.status === 200, "tenant /admin/login renders");
    const superRedirect = await fetch(`http://${ROOT}/super`, { redirect: "manual" });
    check([302, 303, 307, 308].includes(superRedirect.status) && (superRedirect.headers.get("location") || "").includes("/super/login"), "/super redirects to login when signed out");
    check((await fetch(`http://${ROOT}/super/login`)).status === 200, "/super/login renders");
    // The public answer is deliberately thin (uptime monitors only need ok/database); the deployment
    // detail and the write probe are operator-only, so the super admin session is what unlocks them.
    const healthPublic = await fetch(`http://${ROOT}/api/health`);
    const publicBody = (await healthPublic.json()) as { ok?: boolean; database?: string; pendingMigrations?: string[]; commit?: string | null; region?: string | null };
    check(healthPublic.status === 200 && publicBody.ok === true && publicBody.database === "ok", "/api/health reports the database ready");
    check(!("pendingMigrations" in publicBody) && !("commit" in publicBody) && !("region" in publicBody), "/api/health hides deployment detail from anonymous callers");
    const health = await fetch(`http://${ROOT}/api/health`, { headers: { cookie: `dk_session=${superToken}` } });
    const healthBody = (await health.json()) as { ok?: boolean; database?: string; pendingMigrations?: string[] };
    check(health.status === 200 && healthBody.ok === true && healthBody.database === "ok" && healthBody.pendingMigrations?.length === 0, "/api/health shows the super admin no pending migrations");

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

    const superPages = ["/super", "/super/sites/new", `/super/sites/${site.id}`, "/super/users", "/super/templates", "/super/leads", "/super/deleted"];
    let superOk = 0;
    for (const p of superPages) {
      const r = await fetch(`http://${ROOT}${p}`, { headers: { cookie: `dk_session=${superToken}` } });
      const html = await r.text();
      if (r.status === 200 && (html.includes("المشرف العام") || html.includes("Super admin"))) superOk++;
      else console.log(`  FAIL super page ${p} status=${r.status}`);
    }
    check(superOk === superPages.length, `all ${superPages.length} super admin pages render for the owner`);
    // Cron routes pause sites and delete objects, so they must never answer an unauthenticated caller.
    // Without CRON_SECRET set (as here) the bearer path does not exist at all and the answer is 503.
    for (const p of ["/api/cron/billing", "/api/cron/maintenance"]) {
      const anon = await fetch(`http://${ROOT}${p}`);
      const badToken = await fetch(`http://${ROOT}${p}`, { headers: { authorization: "Bearer not-the-secret" } });
      check([401, 503].includes(anon.status) && [401, 503].includes(badToken.status), `${p} refuses an anonymous caller and a wrong bearer token (${anon.status}/${badToken.status})`);
    }
    const cronAsOwner = await fetch(`http://${ROOT}/api/cron/billing`, { headers: { cookie: `dk_session=${superToken}` } });
    const cronBody = (await cronAsOwner.json()) as { ok?: boolean; via?: string; paused?: unknown[] };
    check(cronAsOwner.status === 200 && cronBody.ok === true && cronBody.via === "super_admin" && cronBody.paused?.length === 0, "the billing cron runs for a signed-in owner and pauses nothing when no site is overdue");
    const cronAsAdmin = await fetch(`http://${ROOT}/api/cron/billing`, { headers: { cookie: `dk_session=${adminToken}` } });
    check([401, 503].includes(cronAsAdmin.status), "a site admin session cannot trigger a cron route");

    const superAsAdmin = await fetch(`http://${ROOT}/super`, { headers: { cookie: `dk_session=${adminToken}` }, redirect: "manual" });
    check([302, 303, 307, 308].includes(superAsAdmin.status), "non-super user is redirected away from /super");

    const robotsTenant = await (await tfetch("/robots.txt")).text();
    check(robotsTenant.includes("Disallow: /admin") && robotsTenant.includes(`http://${tenantHost}/sitemap.xml`), "tenant robots.txt hides /admin and points to its sitemap");
    const robotsUnknown = await (await tfetch("/robots.txt", {}, `unknown.${ROOT}`)).text();
    check(robotsUnknown.includes("Disallow: /") && !robotsUnknown.includes("Allow"), "unknown hosts are closed to crawlers");
    const sitemapTenant = await tfetch("/sitemap.xml");
    const sitemapHtml = await sitemapTenant.text();
    check(sitemapTenant.status === 200 && sitemapHtml.includes("<urlset") && sitemapHtml.includes("?lang=en"), "tenant sitemap.xml lists both languages (the demo site publishes English)");
    // /privacy is noindex, so it must not be submitted; submitting a URL you told Google not to index is
    // a contradiction Search Console reports back as an error.
    check(!sitemapHtml.includes("/privacy"), "tenant sitemap.xml omits the noindex privacy page");
    check(sitemapHtml.includes("<lastmod>"), "tenant sitemap.xml carries lastmod");
    // The platform sitemap is an index: the platform pages, plus one entry per tenant on a subdomain.
    const sitemapRoot = await (await fetch(`http://${ROOT}/sitemap.xml`)).text();
    check(sitemapRoot.includes("<sitemapindex") && sitemapRoot.includes("sitemap.xml?part=platform"), "platform sitemap.xml is an index");
    check(sitemapRoot.includes(`http://demo.${ROOT}/sitemap.xml`), "platform sitemap index lists the tenant sitemaps it can cross-submit");
    const sitemapPart = await (await fetch(`http://${ROOT}/sitemap.xml?part=platform`)).text();
    check(sitemapPart.includes("/templates/gypsum") && sitemapPart.includes("/templates/ceramic"), "platform sitemap lists the category pages");
    check(sitemapPart.includes("<lastmod>"), "platform sitemap carries lastmod");
    // 60 near-duplicate previews on the money domain: noindex, and out of the sitemap.
    check(!sitemapPart.includes("/template/101") && !sitemapPart.includes("/template/415"), "template previews are no longer submitted");
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
  // Exactly two rows, and the count matters as much as the identities: it is what catches a page that
  // quietly mints a visitor it should not (the /projects and /services checks browse with a cookie, as a
  // real visitor does) and a first visit that stores a secret the browser never received, which used to
  // strand the render's row and make /api/track allocate a second one.
  check(visitors.length === 2, `two visitors stored: the real one and the server-issued replacement for the spoofed code (${visitors.length})`);
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
