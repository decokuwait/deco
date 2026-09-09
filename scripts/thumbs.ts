/*
 * Generates gallery thumbnails from the QA screenshots (.qa/shots/tpl-<code>-desktop.png and -mobile.png):
 *   public/templates/<code>.jpg          desktop, 1366x860 region scaled to 683x430
 *   public/templates/<code>-mobile.jpg   mobile, 390x780 region scaled to 195x390
 * and writes src/templates/thumbs.json listing the codes that have thumbnails. Run `npm run shots` first.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SHOTS = path.join(process.cwd(), ".qa", "shots");
const OUT = path.join(process.cwd(), "public", "templates");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const codes: string[] = [];
  const files = fs.readdirSync(SHOTS).filter((f) => /^tpl-\d{3}-desktop\.png$/.test(f)).sort();
  for (const f of files) {
    const code = f.slice(4, 7);
    const desktop = path.join(SHOTS, f);
    const mobile = path.join(SHOTS, `tpl-${code}-mobile.png`);
    await render(page, desktop, path.join(OUT, `${code}.jpg`), 1366, 860, 0.5);
    if (fs.existsSync(mobile)) await render(page, mobile, path.join(OUT, `${code}-mobile.jpg`), 390, 780, 0.5);
    codes.push(code);
    console.log(`[thumbs] ${code}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(process.cwd(), "src", "templates", "thumbs.json"), JSON.stringify({ codes, generatedAt: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`[thumbs] ${codes.length} templates -> ${OUT}`);
}

async function render(page: import("playwright").Page, input: string, output: string, w: number, h: number, scale: number) {
  const b64 = fs.readFileSync(input).toString("base64");
  await page.setViewportSize({ width: Math.round(w * scale), height: Math.round(h * scale) });
  await page.setContent(
    `<body style="margin:0;overflow:hidden"><div style="width:${w * scale}px;height:${h * scale}px;overflow:hidden"><img src="data:image/png;base64,${b64}" style="width:${w * scale}px;display:block"></div></body>`,
    { waitUntil: "load" },
  );
  await page.screenshot({ path: output, type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: Math.round(w * scale), height: Math.round(h * scale) } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
