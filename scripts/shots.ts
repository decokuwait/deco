/*
 * Captures screenshots of every template preview (mobile + desktop, Arabic + English desktop) and of the
 * admin / super admin pages, for visual QA. Requires `npm run build` first.
 * Output: .qa/shots/<name>.png and .qa/shots/index.json
 */
import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser } from "playwright";
import { ensureDir, portFree, qaEnv, seedQa, startServer, stopServer, waitFor } from "./qa-lib";

const env = qaEnv("shots", 3126);
const OUT = ensureDir(path.join(process.cwd(), ".qa", "shots"));
const ONLY = (process.env.SHOTS_ONLY || "").split(",").filter(Boolean);
const SKIP_ADMIN = process.env.SHOTS_SKIP_ADMIN === "1";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 900 };

async function shot(browser: Browser, url: string, file: string, viewport: { width: number; height: number }, cookies: { name: string; value: string; domain: string }[] = [], fullPage = true) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "ar-KW" });
  if (cookies.length) await ctx.addCookies(cookies.map((c) => ({ ...c, path: "/" })));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  // Demo videos are large external files: skip them so screenshots do not wait on downloads.
  await page.route(/\.(mp4|webm|mov)(\?|$)/i, (r) => r.abort());
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, file), fullPage, timeout: 60000 });
    const h = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, height: document.documentElement.scrollHeight }));
    await ctx.close();
    return { file, url, viewport, errors: errors.filter((e) => !e.includes("fonts.googleapis") && !e.includes("net::ERR") && !e.includes("images.unsplash")), overflowX: h.scrollW > h.clientW + 1, height: h.height };
  } catch (err) {
    await ctx.close().catch(() => {});
    console.log(`  FAIL ${file}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    return { file, url, viewport, errors: [`capture failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`], overflowX: false, height: 0 };
  }
}

async function main() {
  if (!(await portFree(env.port))) throw new Error(`port ${env.port} busy`);
  const seed = await seedQa({ slug: "shots", name: "Demo Decor", category: "gypsum", templateCode: "104" });
  const server = startServer(env.port);
  const results: Array<Awaited<ReturnType<typeof shot>>> = [];
  const browser = await chromium.launch();
  try {
    await waitFor(`http://${env.root}/`);
    const { TEMPLATES } = await import("../src/templates/registry");
    const list = ONLY.length ? TEMPLATES.filter((t) => ONLY.includes(t.code)) : TEMPLATES;
    let i = 0;
    for (const t of list) {
      i++;
      results.push(await shot(browser, `http://${env.root}/template/${t.code}?lang=ar`, `tpl-${t.code}-mobile.png`, MOBILE));
      results.push(await shot(browser, `http://${env.root}/template/${t.code}?lang=ar`, `tpl-${t.code}-desktop.png`, DESKTOP));
      results.push(await shot(browser, `http://${env.root}/template/${t.code}?lang=en`, `tpl-${t.code}-desktop-en.png`, DESKTOP));
      console.log(`[shots] ${i}/${list.length} template ${t.code}`);
    }
    if (!SKIP_ADMIN) {
      const host = `shots.${env.root}`;
      const adminCookie = [{ name: "dk_session", value: seed.adminToken, domain: "shots.localhost" }];
      const superCookie = [{ name: "dk_session", value: seed.superToken, domain: "localhost" }];
      const adminPages = ["/admin", "/admin/visitors", "/admin/content", "/admin/content/hero", "/admin/content/services", "/admin/content/theme", "/admin/projects", `/admin/projects/${seed.projects[0]?.id}`, "/admin/marketing", "/admin/settings", "/admin/login"];
      for (const p of adminPages) {
        const name = p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
        results.push(await shot(browser, `http://${host}${p}`, `admin-${name}-mobile.png`, MOBILE, adminCookie));
        results.push(await shot(browser, `http://${host}${p}`, `admin-${name}-desktop.png`, DESKTOP, adminCookie));
      }
      for (const p of ["/super", "/super/sites/new", `/super/sites/${seed.site.id}`, "/super/users", "/super/templates", "/super/login"]) {
        const name = p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        results.push(await shot(browser, `http://${env.root}${p}`, `${name}-mobile.png`, MOBILE, superCookie));
        results.push(await shot(browser, `http://${env.root}${p}`, `${name}-desktop.png`, DESKTOP, superCookie));
      }
      results.push(await shot(browser, `http://${host}/`, "site-shots-mobile.png", MOBILE));
      results.push(await shot(browser, `http://${env.root}/templates`, "gallery-desktop.png", DESKTOP));
      results.push(await shot(browser, `http://${env.root}/`, "home-mobile.png", MOBILE));
    }
  } finally {
    await browser.close();
    await stopServer(server);
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(results, null, 2));
  const withErrors = results.filter((r) => r.errors.length);
  const overflow = results.filter((r) => r.overflowX);
  console.log(`[shots] ${results.length} screenshots in ${OUT}`);
  console.log(`[shots] pages with browser errors: ${withErrors.length}`);
  for (const r of withErrors) console.log(`   ${r.file}: ${r.errors.slice(0, 3).join(" | ")}`);
  console.log(`[shots] pages with horizontal overflow: ${overflow.length}`);
  for (const r of overflow) console.log(`   ${r.file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
