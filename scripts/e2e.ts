/*
 * Browser end-to-end test of the real user flows (Playwright + production build):
 *  visitor gets an id and WhatsApp link -> admin login -> visitor search + stage marking -> content editing
 *  -> services list editing -> project + media upload -> pixels + test event -> settings -> super admin
 *  creates a site, switches template, manages users -> cleanup.
 * Run `npm run build` first. Chromium resolves *.localhost to 127.0.0.1, so tenant hosts work natively.
 */
import path from "node:path";
import fs from "node:fs";
import { chromium, type Page } from "playwright";
import { ensureDir, portFree, qaEnv, seedQa, startServer, stopServer, waitFor } from "./qa-lib";

const env = qaEnv("e2e", 3127);
const OUT = ensureDir(path.join(process.cwd(), ".qa", "e2e"));
let failures = 0;
let step = 0;

function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}

async function snap(page: Page, name: string) {
  step++;
  await page.screenshot({ path: path.join(OUT, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: true }).catch(() => {});
}

async function main() {
  if (!(await portFree(env.port))) throw new Error(`port ${env.port} busy`);
  await seedQa({ slug: "demo", name: "Demo Decor", category: "gypsum", templateCode: "101" });
  const tenant = `http://demo.${env.root}`;
  const rootUrl = `http://${env.root}`;
  // Node's fetch cannot resolve *.localhost (Chromium can), so server-side checks use the forwarded host header.
  const hfetch = (host: string, p = "/", cookie = "") => fetch(`${rootUrl}${p}`, { headers: { "x-forwarded-host": `${host}.${env.root}`, ...(cookie ? { cookie } : {}) } });
  const server = startServer(env.port);
  const browser = await chromium.launch();
  const pngPath = path.join(OUT, "upload.png");
  fs.writeFileSync(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwDiqEAgAAB1WCAJ9y3IcAAAAAElFTkSuQmCC", "base64"));
  try {
    await waitFor(`${rootUrl}/`, 90000, server);

    // ---------- visitor ----------
    const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const vpage = await vctx.newPage();
    const errors: string[] = [];
    vpage.on("pageerror", (e) => errors.push(e.message));
    // Demo videos are large external files; the visit registration call is the real "page is ready" signal.
    await vpage.route(/\.(mp4|webm|mov)(\?|$)/i, (r) => r.abort());
    const visitRegistered = vpage.waitForResponse((r) => r.url().endsWith("/api/track") && r.request().method() === "POST", { timeout: 30000 });
    await vpage.goto(`${tenant}/?fbclid=E2E123`, { waitUntil: "domcontentloaded" });
    check((await visitRegistered).status() === 200, "visit registered through /api/track");
    const cookies = await vctx.cookies();
    const code = cookies.find((c) => c.name === "dk_vid")?.value ?? "";
    check(/^\d{6}$/.test(code), `visitor id cookie assigned (${code})`);
    const waHref = await vpage.locator('a[href^="https://wa.me/"]').first().getAttribute("href");
    check(!!waHref && decodeURIComponent(waHref).includes(code), "WhatsApp link on the site carries the visitor id");
    check((await vpage.locator('a[href="?lang=en"]').count()) > 0, "language toggle is a crawlable link to the English version");
    const htmlEl = vpage.locator("html");
    check((await htmlEl.getAttribute("lang")) === "ar" && (await htmlEl.getAttribute("dir")) === "rtl", "document language and direction are server-rendered for the site");
    const trackResp = vpage.waitForResponse((r) => r.url().includes("/api/track/event"));
    await vpage.evaluate(() => (window as unknown as { __dkTrack?: (k: string) => void }).__dkTrack?.("whatsapp_click"));
    check((await trackResp).status() === 200, "WhatsApp click is recorded through /api/track/event");
    await vpage.click('button[aria-label]:has(svg)', { timeout: 3000 }).catch(() => {});
    await snap(vpage, "site-mobile");
    check(errors.length === 0, `no browser errors on the site (${errors.join(" | ").slice(0, 200)})`);
    await vctx.close();

    // ---------- site admin ----------
    const actx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await actx.newPage();
    // The admin panel previews the same large demo media the site does. The run should test our pages,
    // not a third-party image host's latency, so the external originals are stubbed out here exactly as
    // the visitor context already does for the demo videos.
    await page.route(/images\.unsplash\.com/, (r) => r.abort());
    await page.route(/\.(mp4|webm|mov)(\?|$)/i, (r) => r.abort());
    const perrors: string[] = [];
    page.on("pageerror", (e) => perrors.push(e.message));
    page.on("dialog", (d) => d.accept()); // confirm() dialogs on delete buttons
    await page.goto(`${tenant}/admin`);
    check(page.url().includes("/admin/login"), "unauthenticated admin is redirected to login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "wrong");
    await page.click('button[type="submit"]');
    await page.waitForURL(/error=invalid/);
    check(page.url().includes("error=invalid"), "wrong password is rejected");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.fill('input[name="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin$/, { timeout: 20000 });
    check(page.url().endsWith("/admin"), "admin login succeeds and lands on the dashboard");
    await snap(page, "admin-dashboard");

    // visitors: search + mark stage
    await page.goto(`${tenant}/admin/visitors?code=${code.slice(0, 3)}`);
    check((await page.locator(`a[href="/admin/visitors/${code}"]`).count()) > 0, "visitor search by id prefix finds the visitor");
    await page.goto(`${tenant}/admin/visitors/${code}`);
    check((await page.locator("body").innerText()).includes("Meta"), "visitor detail shows Meta as the source");
    await page.click('button[value="contacted"]');
    await page.waitForURL(/saved=/);
    check(page.url().includes("saved=nosignal"), "stage marked as contacted (no pixels yet -> saved without signal)");
    await snap(page, "visitor-marked");

    // marketing: activate Meta pixel, then mark another stage -> signal attempted and logged
    await page.goto(`${tenant}/admin/marketing`);
    const metaForm = page.locator("form").filter({ has: page.locator('input[name="pixelId"]') }).first();
    await metaForm.locator('input[name="pixelId"]').fill("111222333");
    await metaForm.locator('input[name="accessToken"]').fill("EAAtestToken");
    await metaForm.locator('input[name="testEventCode"]').fill("TEST42");
    const metaToggle = metaForm.locator('input[name="active"]');
    if (!(await metaToggle.isChecked())) await metaToggle.check({ force: true });
    await metaForm.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check(page.url().includes("saved=1"), "Meta pixel saved");
    await page.goto(`${tenant}/admin/visitors/${code}`);
    await page.fill('input[name="value"]', "150");
    await page.click('button[value="first_payment"]');
    await page.waitForURL(/saved=/);
    const body = await page.locator("body").innerText();
    // The token is invalid on purpose: Meta must be attempted and must reject it, never "sent" or silently skipped.
    check(page.url().includes("saved=failed"), `first payment mark attempted delivery to Meta and Meta rejected the invalid token (${page.url().split("saved=")[1]})`);
    check(body.includes("Purchase"), "event history shows the Meta Purchase event with its delivery result");
    await snap(page, "visitor-history");
    const testBtn = page.locator("form").filter({ has: page.locator('button:has-text("تجريبي"), button:has-text("test event")') });
    await page.goto(`${tenant}/admin/marketing`);
    await page.locator("form").filter({ hasText: /تجريبي|test event/i }).first().locator("button").click();
    await page.waitForURL(/tested=meta/);
    check(page.url().includes("tested=meta"), "send test event reports a result for Meta");
    void testBtn;

    // A Server Action that redirects to the URL the page is already on is a soft navigation, so there is
    // no `waitForURL` to hang on: wait for the action's POST and let the re-render settle instead.
    const saveAndSettle = async (locator: ReturnType<Page["locator"]>) => {
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST", { timeout: 30000 }), locator.click()]);
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
    };

    // content: hero title
    await page.goto(`${tenant}/admin/content/hero`);
    await page.fill('input[name="hero.title.ar"]', "عنوان تجريبي جديد");
    await page.fill('input[name="hero.title.en"]', "Brand new e2e title");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check((await page.locator('input[name="hero.title.en"]').inputValue()) === "Brand new e2e title", "edited hero title is stored and comes back in the editor");
    const siteHtml = await (await hfetch("demo", "/?lang=en")).text();
    check(siteHtml.includes("Brand new e2e title"), "edited hero title appears on the public site");

    // services list: add, then delete
    await page.goto(`${tenant}/admin/content/services`);
    const before = await page.locator('input[name^="rows."][name$=".id"]').count();
    await page.fill('input[name="rows.new.title.ar"]', "خدمة جديدة");
    await page.fill('input[name="rows.new.title.en"]', "Brand new service");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    const after = await page.locator('input[name^="rows."][name$=".id"]').count();
    check(after === before + 1, `service added through the list editor (${before} -> ${after})`);
    // Reordering and removing are now done on the device and travel with the one save at the bottom of
    // the page, so neither costs a page load. Removing is undoable right up to that save.
    const secondService = await page.locator('input[name="rows.1.title.en"]').inputValue();
    await page.locator('[data-dk="rows-up"]').nth(1).click();
    check((await page.locator('input[name="rows.order"]').inputValue()).startsWith("1,0"), "moving a service up does not reload the page");
    // The moved row is now first in the DOM too, so this removes an untouched one further down.
    await page.locator('[data-dk="rows-remove"]').last().click();
    check((await page.locator('input[name="rows.removed"]').inputValue()) !== "", "removing a service is staged, not submitted");
    await page.locator('[data-dk="rows-undo"]').first().click();
    check((await page.locator('input[name="rows.removed"]').inputValue()) === "", "removing a service can be undone before saving");
    await page.locator('[data-dk="rows-remove"]').last().click();
    await saveAndSettle(page.locator('form button[type="submit"]').last());
    check(page.url().includes("saved=1") && (await page.locator('input[name^="rows."][name$=".id"]').count()) === after - 1, "the staged removal and reorder are applied by the one save");
    const nowFirst = await page.locator('input[name="rows.0.title.en"]').inputValue();
    check(nowFirst === secondService, `the reordered service is now first (${secondService} -> ${nowFirst})`);

    // A form rendered from content that has since changed elsewhere is refused instead of overwriting it.
    const staleVersion = await page.locator('input[name="__version"]').inputValue();
    await page.evaluate(() => {
      const el = document.querySelector('input[name="__version"]') as HTMLInputElement | null;
      if (el) el.value = "0000000000000000";
    });
    await saveAndSettle(page.locator('form button[type="submit"]').last());
    check(page.url().includes("error=content_changed") && staleVersion.length > 0, "a stale editor is refused rather than silently deleting another tab's work");
    const stillThere = await page.goto(`${tenant}/admin/content/services`);
    check(!!stillThere && (await page.locator('input[name^="rows."][name$=".id"]').count()) === after - 1, "the refused save changed nothing");

    // theme override
    await page.goto(`${tenant}/admin/content/theme`);
    await page.fill('input[name="primary"]', "#123456");
    await page.locator('input[name="primary_custom"]').check({ force: true });
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check((await (await hfetch("demo")).text()).includes("--t-primary:#123456"), "theme colour override applied to the site");

    // projects: create + upload media + publish state
    await page.goto(`${tenant}/admin/projects/new?type=finished`);
    await page.fill('input[name="title.ar"]', "مشروع الاختبار");
    await page.fill('input[name="title.en"]', "E2E project");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+\?saved=created/);
    const projectUrl = page.url().split("?")[0];
    check(/\/admin\/projects\/[0-9a-f-]{36}$/.test(projectUrl) && (await page.locator('input[name="title.en"]').inputValue()) === "E2E project", "project created and editor opened with its title");
    const uploadForm = page.locator("form").filter({ has: page.locator('input[name="imageUrl"]') }).last();
    await uploadForm.locator('input[type="file"]').first().setInputFiles(pngPath);
    await page.waitForFunction(() => {
      const el = document.querySelector('form input[name="imageUrl"]') as HTMLInputElement | null;
      return !!el && el.value.includes("/api/files/");
    }, null, { timeout: 20000 });
    await uploadForm.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=media/);
    check((await page.locator('input[name^="media."][name$=".id"]').count()) > 0, "uploaded image added as project media");

    // The upload that does NOT work. A presigned upload leaves for the bucket, so when it fails the
    // browser hands the page one opaque error and refuses to say more — a blocked CORS preflight, an
    // unreachable bucket and a dead Wi-Fi connection are indistinguishable from inside the page. The
    // panel showed "connection lost" for all three, which described only the last one and sent the owner
    // looking at their router while their deployment was misconfigured. Aborting the request here is
    // exactly what the browser does to a refused preflight, so this drives the real failure path: the
    // server is asked what happened and its answer is what the owner reads.
    for (const [reason, sentence] of [
      ["cors_blocked", "رفضت مساحة التخزين"],
      ["bucket_unreachable", "لم تستجب مساحة التخزين"],
      ["network", "انقطع الاتصال"],
    ] as const) {
      await page.route("**/api/upload/local**", (r) => r.abort("failed"));
      await page.route("**/api/upload/diagnose", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reason }) }));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("form").filter({ has: page.locator('input[name="imageUrl"]') }).last().locator('input[type="file"]').first().setInputFiles(pngPath);
      const shown = await page
        .locator("body")
        .innerText()
        .then(() => page.waitForFunction((s) => document.body.innerText.includes(s), sentence, { timeout: 15000 }).then(() => true).catch(() => false));
      check(shown, `a failed upload diagnosed as ${reason} tells the owner so, in their own language`);
      await page.unroute("**/api/upload/local**");
      await page.unroute("**/api/upload/diagnose");
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    // Alt text and the focal point are edited in the same form as everything else and saved by the one
    // "save all" button — the page no longer has four buttons that all say "حفظ".
    await page.fill('input[name="media.0.alt.en"]', "Gypsum ceiling detail");
    await page.locator('input[name="media.0.focal"][value="top"]').check({ force: true });
    await page.locator("form").filter({ has: page.locator('input[name="published"]') }).locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check((await page.locator('input[name="media.0.alt.en"]').inputValue()) === "Gypsum ceiling detail", "photo description saved with the project, in one submit");
    check(await page.locator('input[name="media.0.focal"][value="top"]').isChecked(), "focal point saved with the project");
    const mediaUrl = await page.locator("img").filter({ hasNot: page.locator("[alt]:not([alt=''])") }).last().getAttribute("src");
    check(!!mediaUrl && (await hfetch("demo", mediaUrl)).status === 200, `uploaded file is served back (${mediaUrl ?? "no media url"})`);
    const publicSite = await (await hfetch("demo", "/?lang=en")).text();
    check(publicSite.includes("E2E project"), "new finished project appears on the public site");
    await page.goto(projectUrl);
    await page.locator('input[name="published"]').uncheck({ force: true });
    await page.locator("form").filter({ has: page.locator('input[name="published"]') }).locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check(!(await (await hfetch("demo", "/?lang=en")).text()).includes("E2E project"), "unpublished project disappears from the site");
    await snap(page, "project-editor");

    // before/after project through the admin form (roles before + after, warning badge disappears)
    await page.goto(`${tenant}/admin/projects/new?type=before_after`);
    await page.fill('input[name="title.ar"]', "قبل وبعد تجريبي");
    await page.fill('input[name="title.en"]', "E2E before after");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+\?saved=created/);
    const baUrl = page.url().split("?")[0];
    const addMedia = async (role: string) => {
      const form = page.locator("form").filter({ has: page.locator('input[name="imageUrl"]') }).last();
      const roleSelect = form.locator('select[name="role"]');
      if (await roleSelect.count()) await roleSelect.selectOption(role);
      await form.locator('input[type="file"]').first().setInputFiles(pngPath);
      await page.waitForFunction(() => {
        const el = document.querySelector('form input[name="imageUrl"]') as HTMLInputElement | null;
        return !!el && el.value.includes("/api/files/");
      }, null, { timeout: 20000 });
      await form.locator('button[type="submit"]').last().click();
      await page.waitForURL(/saved=media/);
    };
    const needsBoth = (text: string) => text.includes("يحتاج صورة قبل") || text.includes("Needs one before");
    await addMedia("before");
    const incomplete = needsBoth(await page.locator("body").innerText());
    await addMedia("after");
    const baHtml = await (await hfetch("demo", "/?lang=en")).text();
    check(incomplete && baHtml.includes("E2E before after") && baHtml.includes('id="before-after"'), "before/after project built from the admin form renders on the site");
    await page.goto(baUrl);
    check(!needsBoth(await page.locator("body").innerText()), "before/after warning cleared once both roles exist");

    // progress project with two labelled steps, reordered
    await page.goto(`${tenant}/admin/projects/new?type=progress`);
    await page.fill('input[name="title.ar"]', "مشروع قيد التنفيذ تجريبي");
    await page.fill('input[name="title.en"]', "E2E progress");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/\/admin\/projects\/[0-9a-f-]+\?saved=created/);
    const addStep = async (ar: string, en: string) => {
      const form = page.locator("form").filter({ has: page.locator('input[name="imageUrl"]') }).last();
      await form.locator('input[name="stepLabel.ar"]').fill(ar);
      await form.locator('input[name="stepLabel.en"]').fill(en);
      await form.locator('input[type="file"]').first().setInputFiles(pngPath);
      await page.waitForFunction(() => {
        const el = document.querySelector('form input[name="imageUrl"]') as HTMLInputElement | null;
        return !!el && el.value.includes("/api/files/");
      }, null, { timeout: 20000 });
      await form.locator('button[type="submit"]').last().click();
      await page.waitForURL(/saved=media/);
    };
    await addStep("اليوم الأول", "Day one");
    await addStep("اليوم الثاني", "Day two");
    // Moving a photo is now instant on the device; the new order rides along with the single save.
    await page.locator('[data-dk="media-up"]').nth(1).click();
    check((await page.locator('input[name="media.order"]').inputValue()).startsWith("1,0"), "moving a photo up does not reload the page");
    await page.locator("form").filter({ has: page.locator('input[name="published"]') }).locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    const progressHtml = await (await hfetch("demo", "/?lang=en")).text();
    check(progressHtml.includes("E2E progress") && progressHtml.indexOf("Day two") < progressHtml.indexOf("Day one"), "progress project steps render on the site in the reordered sequence");

    // project type toggle
    await page.goto(`${tenant}/admin/projects`);
    const progressForm = page.locator("form").filter({ has: page.locator('input[name="enabled"]') }).nth(2);
    await progressForm.locator('input[name="enabled"]').uncheck({ force: true });
    await progressForm.locator('button[type="submit"]').click();
    await page.waitForURL(/saved=1/);
    check(!(await (await hfetch("demo")).text()).includes('id="progress"'), "disabling the progress type hides it on the site");

    // settings
    await page.goto(`${tenant}/admin/settings`);
    await page.locator('input[name="floatingWhatsapp"]').uncheck({ force: true });
    await page.locator("form").filter({ has: page.locator('input[name="floatingWhatsapp"]') }).locator('button[type="submit"]').click();
    await page.waitForURL(/saved=1/);
    check(!(await (await hfetch("demo")).text()).includes("animate-pulse-ring"), "floating WhatsApp button hidden after settings change");
    await snap(page, "settings");
    check(perrors.length === 0, `no browser errors in the admin panel (${perrors.join(" | ").slice(0, 200)})`);
    await actx.close();

    // ---------- super admin ----------
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await sctx.newPage();
    await sp.goto(`${rootUrl}/super/login`);
    await sp.fill('input[name="email"]', "owner@example.com");
    await sp.fill('input[name="password"]', "wrong-password");
    await sp.click('button[type="submit"]');
    await sp.waitForURL(/\/super\/login\?error=invalid$/);
    const loginError = (await sp.locator("main").innerText()).trim();
    check(/Invalid email or password|بيانات الدخول غير صحيحة/.test(loginError), "a wrong super admin password returns to the form with a message, not a server error");
    await sp.fill('input[name="email"]', "owner@example.com");
    await sp.fill('input[name="password"]', "Owner123!");
    await sp.click('button[type="submit"]');
    await sp.waitForURL(/\/super$/);
    check(sp.url().endsWith("/super"), "super admin login works");
    await sp.goto(`${rootUrl}/super/sites/new?cat=ceramic`);
    await sp.fill('input[name="name"]', "شركة السيراميك");
    await sp.selectOption('select[name="category"]', "ceramic");
    await sp.fill('input[name="slug"]', "e2e-ceramic");
    await sp.fill('input[name="whatsapp"]', "96599999999");
    await sp.fill('input[name="adminEmail"]', "ceramic-admin@example.com");
    await sp.fill('input[name="adminPassword"]', "Ceramic123!");
    await sp.check('input[name="template"][value="404"]', { force: true });
    // A new site is created paused by default so a customer's domain never serves Google an unfinished
    // shell. The operator publishes it when the content is in — which is what this unchecks, after
    // confirming the toggle really does default to on.
    const pausedToggle = sp.locator('input[name="startPaused"]');
    check(await pausedToggle.isChecked(), "new sites default to starting paused");
    check(!(await sp.locator('input[name="seedDemo"]').isChecked()), "demo content is off by default");
    await pausedToggle.uncheck({ force: true });
    await sp.locator('button[type="submit"]').last().click();
    await sp.waitForURL(/\/super\/sites\/[0-9a-f-]+\?saved=(1|created)/, { timeout: 30000 });
    check(/\/super\/sites\/[0-9a-f-]{36}\?saved=created$/.test(sp.url()), "super admin created a new site from template 404 with its admin account");
    const newSiteHtml = await (await hfetch("e2e-ceramic")).text();
    check(newSiteHtml.includes('data-template="404"') && newSiteHtml.includes("wa.me/96599999999"), "new site is live on its subdomain with its template and WhatsApp number");
    // Server-action redirects to the same URL are soft navigations: wait for the action's POST to finish
    // and the page to go idle before touching the re-rendered form.
    const submitAndSettle = async (p: Page, btn: ReturnType<Page["locator"]>) => {
      await Promise.all([p.waitForResponse((r) => r.request().method() === "POST", { timeout: 30000 }), btn.click()]);
      await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(400);
    };
    await sp.check('input[name="template"][value="409"]', { force: true });
    await submitAndSettle(sp, sp.locator("form").filter({ has: sp.locator('select[name="status"]') }).locator('button[type="submit"]').last());
    check((await (await hfetch("e2e-ceramic")).text()).includes('data-template="409"'), "switching the template re-renders the site instantly");
    await sp.fill('input[name="hostname"]', "ceramic-company.com");
    await submitAndSettle(sp, sp.locator("form").filter({ has: sp.locator('input[name="hostname"]') }).locator("button"));
    await sp.waitForSelector("text=ceramic-company.com", { timeout: 15000 }).catch(() => {});
    const domainsText = await sp.locator("body").innerText();
    check(domainsText.includes("ceramic-company.com") && /\bA\s+@\s+76\.76\.21\.21/.test(domainsText) && /CNAME\s+www/.test(domainsText), "custom domain added with A + www CNAME instructions");
    await sp.fill('input[name="hostname"]', "www.ceramic-company.com");
    await submitAndSettle(sp, sp.locator("form").filter({ has: sp.locator('input[name="hostname"]') }).locator("button"));
    check(sp.url().includes("error=domain_taken") || (await sp.locator("body").innerText()).match(/ceramic-company\.com/g)!.length >= 1, "www variant of an existing domain is normalised and refused as a duplicate");
    await snap(sp, "super-site");
    await sp.goto(`${rootUrl}/super/users`);
    check((await sp.locator("body").innerText()).includes("ceramic-admin@example.com"), "new site admin user listed in users");
    const cctx = await browser.newContext();
    const cp = await cctx.newPage();
    await cp.goto(`http://e2e-ceramic.${env.root}/admin/login`);
    await cp.fill('input[name="email"]', "ceramic-admin@example.com");
    await cp.fill('input[name="password"]', "Ceramic123!");
    await cp.click('button[type="submit"]');
    await cp.waitForURL(/\/admin$/);
    check(cp.url().endsWith("/admin"), "new site admin can log into the new site");
    await cp.goto(`${tenant}/admin`);
    check(cp.url().includes("/admin/login"), "site admin of one site cannot access another site's admin");
    await cctx.close();
    await sp.goto(`${rootUrl}/super`);
    check((await sp.locator("body").innerText()).includes("e2e-ceramic"), "sites list shows both sites");
    await sctx.close();
  } finally {
    await browser.close();
    await stopServer(server);
  }
  console.log(failures ? `\n${failures} e2e check(s) failed` : "\nAll e2e checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
