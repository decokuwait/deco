/* Crops a PNG: tsx scripts/crop.ts <in.png> <out.png> <y> <height> [width] */
import fs from "node:fs";
import { chromium } from "playwright";

async function main() {
  const [input, output, yS, hS, wS] = process.argv.slice(2);
  const y = Number(yS || 0);
  const h = Number(hS || 1200);
  const b64 = fs.readFileSync(input).toString("base64");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<img id="i" src="data:image/png;base64,${b64}" style="display:block">`);
  const w = Number(wS || (await page.evaluate(() => (document.getElementById("i") as HTMLImageElement).naturalWidth)));
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.screenshot({ path: output, clip: { x: 0, y, width: w, height: h }, fullPage: true });
  await browser.close();
  console.log(output);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
