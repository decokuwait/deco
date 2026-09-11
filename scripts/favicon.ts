/*
 * Renders the platform favicon: public/icon.svg (vector) and public/favicon.ico (a 64x64 PNG wrapped in an
 * ICO container, which every browser accepts). Run with `npx tsx scripts/favicon.ts` after changing the mark.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#0f172a"/>
  <path d="M18 14h13c11 0 18 7 18 18s-7 18-18 18H18z" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linejoin="round"/>
  <path d="M26 24h5c5.5 0 9 3.2 9 8s-3.5 8-9 8h-5z" fill="#fbbf24"/>
</svg>`;

function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8); // bytes
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

async function main() {
  const pub = path.join(process.cwd(), "public");
  fs.writeFileSync(path.join(pub, "icon.svg"), SVG);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${SVG}</body></html>`);
  const png = await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: 64, height: 64 } });
  await browser.close();
  fs.writeFileSync(path.join(pub, "favicon.ico"), icoFromPng(Buffer.from(png), 64));
  console.log(`[favicon] wrote public/icon.svg and public/favicon.ico (${png.length} bytes png)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
