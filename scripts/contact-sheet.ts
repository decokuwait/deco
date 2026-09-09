/*
 * Builds contact sheets from .qa/shots: one image per category and viewport with the top part of each
 * template screenshot side by side, so the 15 designs of a trade can be compared at a glance.
 * Output: .qa/sheets/<category>-<mobile|desktop|desktop-en>.png
 */
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";
import { ensureDir } from "./qa-lib";

const SHOTS = path.join(process.cwd(), ".qa", "shots");
const OUT = ensureDir(path.join(process.cwd(), ".qa", "sheets"));
const CATS: Record<string, string> = { gypsum: "1", aluminum: "2", partition: "3", ceramic: "4" };
const VIEWS = [
  { key: "mobile", w: 390, cropH: 1700, cols: 5, scale: 0.42 },
  { key: "desktop", w: 1366, cropH: 1100, cols: 3, scale: 0.36 },
  { key: "desktop-en", w: 1366, cropH: 1100, cols: 3, scale: 0.36 },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [cat, prefix] of Object.entries(CATS)) {
    for (const v of VIEWS) {
      const codes = Array.from({ length: 15 }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
      const cards = codes
        .map((code) => {
          const file = path.join(SHOTS, `tpl-${code}-${v.key}.png`);
          if (!fs.existsSync(file)) return `<div class="card"><div class="cap">${code} — missing</div></div>`;
          const b64 = fs.readFileSync(file).toString("base64");
          return `<div class="card"><div class="cap">${code}</div><div class="frame"><img src="data:image/png;base64,${b64}"></div></div>`;
        })
        .join("");
      const cw = Math.round(v.w * v.scale);
      const ch = Math.round(v.cropH * v.scale);
      const html = `<!doctype html><html><head><style>
        body{margin:0;background:#111;font-family:system-ui;color:#eee}
        h1{margin:12px 16px;font-size:18px}
        .grid{display:grid;grid-template-columns:repeat(${v.cols},${cw}px);gap:14px;padding:0 16px 16px}
        .card{background:#222;border-radius:8px;overflow:hidden}
        .cap{font-size:13px;font-weight:700;padding:6px 8px;background:#333}
        .frame{width:${cw}px;height:${ch}px;overflow:hidden;background:#000}
        .frame img{width:${cw}px;display:block}
      </style></head><body><h1>${cat} — ${v.key}</h1><div class="grid">${cards}</div></body></html>`;
      const width = v.cols * (cw + 14) + 32;
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(html, { waitUntil: "load" });
      const file = path.join(OUT, `${cat}-${v.key}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`[sheet] ${file}`);
    }
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
