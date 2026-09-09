/*
 * Browser end-to-end test of the real user flows (Playwright + production build):
 *  visitor gets an id and WhatsApp link -> admin login -> visitor search + stage marking -> content editing
 *  -> services list editing -> project + media upload -> pixels + test event -> settings -> super admin
 *  creates a site, switches template, manages users -> cleanup.
 * Run `npm run build` first. Chromium resolves *.localhost to 127.0.0.1, so tenant hosts work natively.
 */
import "dotenv/config";
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
  const seed = await seedQa({ slug: "demo", name: "Demo Decor", category: "gypsum", templateCode: "101" });
  const tenant = `http://demo.${env.root}`;
  const rootUrl = `http://${env.root}`;
  // Node's fetch cannot resolve *.localhost (Chromium can), so server-side checks use the forwarded host header.
  const hfetch = (host: string, p = "/", cookie = "") => fetch(`${rootUrl}${p}`, { headers: { "x-forwarded-host": `${host}.${env.root}`, ...(cookie ? { cookie } : {}) } });
  const server = startServer(env.port);
  const browser = await chromium.launch();
  const pngPath = path.join(OUT, "upload.png");
  fs.writeFileSync(pngPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwDiqEAgAAB1WCAJ9y3IcAAAAAElFTkSuQmCC", "base64"));
  try {
    await waitFor(`${rootUrl}/`);

    // ---------- visitor ----------
    const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const vpage = await vctx.newPage();
    const errors: string[] = [];
    vpage.on("pageerror", (e) => errors.push(e.message));
    await vpage.goto(`${tenant}/?fbclid=E2E123`, { waitUntil: "networkidle" });
    const cookies = await vctx.cookies();
    const code = cookies.find((c) => c.name === "dk_vid")?.value ?? "";
    check(/^\d{6}$/.test(code), `visitor id cookie assigned (${code})`);
    const waHref = await vpage.locator('a[href^="https://wa.me/"]').first().getAttribute("href");
    check(!!waHref && decodeURIComponent(waHref).includes(code), "WhatsApp link on the site carries the visitor id");
    await vpage.waitForTimeout(800);
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
    const perrors: string[] = [];
    page.on("pageerror", (e) => perrors.push(e.message));
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
    check(/saved=(failed|sent|partial)/.test(page.url()), `first payment mark attempted delivery to Meta (${page.url().split("saved=")[1]})`);
    check(body.includes("Purchase"), "event history shows the Meta Purchase event with its delivery result");
    await snap(page, "visitor-history");
    const testBtn = page.locator("form").filter({ has: page.locator('button:has-text("تجريبي"), button:has-text("test event")') });
    await page.goto(`${tenant}/admin/marketing`);
    await page.locator("form").filter({ hasText: /تجريبي|test event/i }).first().locator("button").click();
    await page.waitForURL(/tested=meta/);
    check(page.url().includes("tested=meta"), "send test event reports a result for Meta");
    void testBtn;

    // content: hero title
    await page.goto(`${tenant}/admin/content/hero`);
    await page.fill('input[name="hero.title.ar"]', "عنوان تجريبي جديد");
    await page.fill('input[name="hero.title.en"]', "Brand new e2e title");
    await page.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    const siteHtml = await (await hfetch("demo", "/", "dk_lang=en")).text();
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
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator('button[name="op"][value="delete:0"]').click()]);
    check((await page.locator('input[name^="rows."][name$=".id"]').count()) === after - 1, "service deleted through the list editor");
    await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator('button[name="op"][value="move:1:up"]').click()]);
    check(page.url().includes("saved=1"), "service moved up through the list editor");

    // theme override
    await page.goto(`${tenant}/admin/content/theme`);
    await page.locator('input[name="primary_default"]').uncheck({ force: true });
    await page.fill('input[name="primary"]', "#123456");
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
    check(true, "project created and editor opened");
    const uploadForm = page.locator("form").filter({ has: page.locator('input[name="imageUrl"]') }).last();
    await uploadForm.locator('input[type="file"]').first().setInputFiles(pngPath);
    await page.waitForFunction(() => {
      const el = document.querySelector('form input[name="imageUrl"]') as HTMLInputElement | null;
      return !!el && el.value.includes("/api/files/");
    }, null, { timeout: 20000 });
    await uploadForm.locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=media/);
    check((await page.locator('form input[name="op"], form button[name="op"][value="delete"]').count()) > 0, "uploaded image added as project media");
    const mediaUrl = await page.locator("img").filter({ hasNot: page.locator("[alt]:not([alt=''])") }).last().getAttribute("src");
    if (mediaUrl) check((await hfetch("demo", mediaUrl)).status === 200, "uploaded file is served back");
    const publicSite = await (await hfetch("demo", "/", "dk_lang=en")).text();
    check(publicSite.includes("E2E project"), "new finished project appears on the public site");
    await page.goto(projectUrl);
    await page.locator('input[name="published"]').uncheck({ force: true });
    await page.locator("form").filter({ has: page.locator('input[name="published"]') }).locator('button[type="submit"]').last().click();
    await page.waitForURL(/saved=1/);
    check(!(await (await hfetch("demo", "/", "dk_lang=en")).text()).includes("E2E project"), "unpublished project disappears from the site");
    await snap(page, "project-editor");

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
    await sp.locator('button[type="submit"]').last().click();
    await sp.waitForURL(/\/super\/sites\/[0-9a-f-]+\?saved=1/, { timeout: 30000 });
    check(true, "super admin created a new site from template 404");
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
    check(domainsText.includes("ceramic-company.com") && domainsText.includes("76.76.21.21"), "custom domain added with DNS instructions");
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
