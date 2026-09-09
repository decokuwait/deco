/*
 * End-to-end smoke test against a production build (run `npm run build` first):
 *  1. seeds the local PGlite database with a demo site
 *  2. starts `next start` on a free port
 *  3. checks platform pages, all 60 template previews (both languages), the tenant site with the
 *     visitor cookie + WhatsApp link, the tracking APIs, admin/super auth redirects
 *  4. stops the server and verifies the visitor + event rows in the database
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.SMOKE_PORT || 3123);
const ROOT = `localhost:${PORT}`;
const DATA_DIR = path.join(process.cwd(), ".data", "pglite-smoke");
process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
process.env.DATABASE_URL = "";
process.env.PGLITE_DATA_DIR = DATA_DIR;
process.env.SUPER_ADMIN_EMAILS = "owner@example.com";

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}

async function freePort(p: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(p);
  });
}

async function waitFor(url: string, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start: ${url}`);
}

async function main() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  if (!(await freePort(PORT))) throw new Error(`port ${PORT} busy`);

  // 1. seed
  const { getDb, resetDb } = await import("../src/lib/db/client");
  const { upsertSuperAdmin, createUser } = await import("../src/lib/db/users");
  const { provisionSite } = await import("../src/lib/provision");
  const { addMember } = await import("../src/lib/db/members");
  const { upsertPixel } = await import("../src/lib/db/pixels");
  const { createSession } = await import("../src/lib/db/users");
  const { listProjects } = await import("../src/lib/db/projects");
  await getDb();
  const owner = await upsertSuperAdmin("owner@example.com", "Owner123!");
  const admin = await createUser({ email: "admin@example.com", password: "Admin123!", isSuper: false });
  const { site } = await provisionSite({ slug: "demo", name: "Demo Decor", category: "gypsum", templateCode: "104", whatsapp: "96550000000", provisionVercel: false });
  await addMember(site.id, admin.id);
  await upsertPixel(site.id, "meta", { pixelId: "123456789", accessToken: "", active: true });
  const { token: adminToken } = await createSession(admin.id);
  const { token: superToken } = await createSession(owner.id);
  const projectId = (await listProjects(site.id))[0]?.id ?? "";
  await resetDb();
  console.log("seeded demo site", site.id);

  // 2. start server
  const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  server.stdout.on("data", (d) => process.env.SMOKE_VERBOSE && process.stdout.write(d));
  server.stderr.on("data", (d) => process.stdout.write(d));
  try {
    await waitFor(`http://${ROOT}/`);

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
    check((await fetch(`http://${ROOT}/template/999`)).status === 404, "unknown template -> 404");

    // 3b. tenant site
    const tenantHost = `demo.${ROOT}`;
    const site1 = await fetch(`http://${ROOT}/`, { headers: { "x-forwarded-host": tenantHost } });
    const site1Html = await site1.text();
    const setCookie = site1.headers.get("set-cookie") || "";
    const codeMatch = setCookie.match(/dk_vid=(\d{6})/);
    check(site1.status === 200, "tenant site renders (Host: demo.localhost)");
    check(!!codeMatch, `visitor cookie dk_vid assigned (${codeMatch?.[1] ?? "none"})`);
    const code = codeMatch?.[1] ?? "";
    const waLink = site1Html.match(/https:\/\/wa\.me\/96550000000\?text=([^"]+)"/);
    check(!!waLink && decodeURIComponent(waLink[1].replace(/&amp;/g, "&")).includes(code), "WhatsApp link contains the visitor id in the first message");
    check(site1Html.includes("Demo Decor") || site1Html.includes("ديكور"), "site brand rendered");
    // next/script (afterInteractive) loads pixels on the client; the pixel config must be in the page payload.
    check(site1Html.includes("123456789") && /pixelId|meta/.test(site1Html), "Meta browser pixel config delivered for active pixel");

    const site2 = await fetch(`http://${ROOT}/`, { headers: { "x-forwarded-host": tenantHost, cookie: `dk_vid=${code}` } });
    check(!(site2.headers.get("set-cookie") || "").includes("dk_vid=") || (site2.headers.get("set-cookie") || "").includes(`dk_vid=${code}`), "existing visitor keeps the same id");

    const track = await fetch(`http://${ROOT}/api/track`, {
      method: "POST",
      headers: { "x-forwarded-host": tenantHost, "content-type": "application/json", cookie: `dk_vid=${code}`, "user-agent": "smoke" },
      body: JSON.stringify({ code, url: `http://${tenantHost}/?fbclid=SMOKE123`, referrer: "https://www.instagram.com/", cookies: { _fbp: "fb.1.1.1" } }),
    });
    const trackJson = (await track.json()) as { code?: string; created?: boolean; source?: string };
    check(track.status === 200 && trackJson.code === code && trackJson.created === true && trackJson.source === "meta", `POST /api/track registers visitor with Meta attribution (${JSON.stringify(trackJson)})`);

    const ev = await fetch(`http://${ROOT}/api/track/event`, {
      method: "POST",
      headers: { "x-forwarded-host": tenantHost, "content-type": "application/json", cookie: `dk_vid=${code}` },
      body: JSON.stringify({ code, eventKey: "whatsapp_click", eventId: "smoke-evt-1", url: `http://${tenantHost}/` }),
    });
    const evJson = (await ev.json()) as { ok?: boolean; eventId?: string };
    check(ev.status === 200 && evJson.ok === true && evJson.eventId === "smoke-evt-1", "POST /api/track/event stores the WhatsApp click");

    const en = await fetch(`http://${ROOT}/`, { headers: { "x-forwarded-host": tenantHost, cookie: `dk_vid=${code}; dk_lang=en` } });
    check((await en.text()).includes('dir="ltr"'), "language cookie switches the site to English");

    // 3c. auth guards
    const adminRedirect = await fetch(`http://${ROOT}/admin`, { headers: { "x-forwarded-host": tenantHost }, redirect: "manual" });
    check([302, 303, 307, 308].includes(adminRedirect.status) && (adminRedirect.headers.get("location") || "").includes("/admin/login"), "tenant /admin redirects to login when signed out");
    const adminLogin = await fetch(`http://${ROOT}/admin/login`, { headers: { "x-forwarded-host": tenantHost } });
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
      "/admin/projects",
      "/admin/projects/new?type=progress",
      `/admin/projects/${projectId}`,
      "/admin/marketing",
      "/admin/settings",
    ];
    let adminOk = 0;
    for (const p of adminPages) {
      const r = await fetch(`http://${ROOT}${p}`, { headers: { "x-forwarded-host": tenantHost, cookie: `dk_session=${adminToken}` } });
      const html = await r.text();
      if (r.status === 200 && html.includes("Demo Decor")) adminOk++;
      else console.log(`  FAIL admin page ${p} status=${r.status}`);
    }
    check(adminOk === adminPages.length, `all ${adminPages.length} admin pages render for a signed-in site admin`);
    const adminOnOtherSite = await fetch(`http://${ROOT}/admin`, { headers: { "x-forwarded-host": `unknown.${ROOT}`, cookie: `dk_session=${adminToken}` } });
    check(adminOnOtherSite.status === 404, "admin of an unknown site -> 404");

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

    check((await fetch(`http://${ROOT}/super`, { headers: { "x-forwarded-host": tenantHost } })).status === 404, "platform routes are hidden on tenant hosts");
    check((await fetch(`http://${ROOT}/`, { headers: { "x-forwarded-host": `unknown.${ROOT}` } })).status === 404, "unknown subdomain -> 404");
  } finally {
    // Kill the whole process tree first (shell -> node), otherwise the server outlives the script on Windows.
    if (process.platform === "win32" && server.pid) {
      await new Promise<void>((resolve) => {
        const k = spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
        k.on("exit", () => resolve());
        k.on("error", () => resolve());
      });
    }
    server.kill();
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 4. verify database rows
  await new Promise((r) => setTimeout(r, 1500));
  const { getDb: getDb2, resetDb: resetDb2 } = await import("../src/lib/db/client");
  await getDb2();
  const { getVisitorByCode } = await import("../src/lib/db/visitors");
  const { listVisitorEvents } = await import("../src/lib/db/events");
  const visitors = await (await getDb2()).query<{ code: string; whatsapp_clicks: number; source_platform: string }>(`select code, whatsapp_clicks, source_platform from visitors`);
  const v = visitors[0];
  check(visitors.length === 1, "one visitor stored");
  check(v?.source_platform === "meta" && Number(v?.whatsapp_clicks) === 1, "visitor has meta source and 1 WhatsApp click");
  const full = v ? await getVisitorByCode(site.id, v.code) : null;
  const events = full ? await listVisitorEvents(full.id) : [];
  check(events.some((e) => e.eventType === "whatsapp_click" && e.eventId === "smoke-evt-1"), "whatsapp_click event stored with shared event id");
  const delivered = events.find((e) => e.eventType === "whatsapp_click");
  check(delivered?.targets.includes("meta") && delivered?.deliveries[0]?.skipped === "missing_access_token", "signal routed to Meta (skipped: no access token configured)");
  await resetDb2();

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll smoke checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
