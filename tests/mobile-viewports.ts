/*
 * Mobile + Arabic viewport gate for the template engine.
 *
 * Deliberately NOT a vitest file. `vitest.config.mts` includes `tests/**\/*.test.ts` and runs in the
 * `node` environment: this needs a production build, a real browser and a seeded tenant, so it runs as a
 * script instead and stays out of `npm test`:
 *
 *     npm run build
 *     npx tsx tests/mobile-viewports.ts              # gate: exits 1 on a failure
 *     MV_REPORT=1 npx tsx tests/mobile-viewports.ts  # + full measurements to .qa/mobile-viewports/
 *     MV_TEMPLATE=104 MV_STRICT=0 npx tsx tests/mobile-viewports.ts
 *
 * It follows `scripts/shots.ts`'s SHOTS_STRICT pattern — same `qa-lib` boot, same reason for looking at
 * element rectangles instead of `document.scrollWidth`: `globals.css` sets `overflow-x: hidden` on body
 * and `overflow-x: clip` on `.tpl`, so a page that overflows has no scrollbar to find. The widths are the
 * real devices in the Kuwaiti market, not round numbers, and Arabic is measured first because it is the
 * default locale.
 *
 * What fails the run (all measured, no adjectives):
 *   1. An element sticking past the viewport's inline edge with nothing clipping it. A decoration hanging
 *      out of its own `overflow-hidden` section is design and passes; everything else is a page whose
 *      content the visitor cannot reach.
 *   2. Words cut off sideways inside their own box — content wider than an `overflow-x: hidden` parent,
 *      excluding the deliberate clips (`truncate`, `line-clamp`, `sr-only`, the before/after reveal pane).
 *   3. The hero's WhatsApp CTA below the fold. This is a WhatsApp-lead business: on a 360x640 phone a CTA
 *      at y=700 is a lost lead.
 *   4. A conversion control (WhatsApp / phone / mail / submit) smaller than 44x44 CSS px — including the
 *      one inside the mobile drawer, which only exists while the menu is open.
 *   5. A conversion control buried under a fixed overlay with a higher z-index (a consent bar, a promo
 *      strip): visible, and unpressable.
 *   6. An Arabic h1/h2 set below the `AR_LEADING` floor of 1.4, with 0.1 of slack for rounding and for a
 *      face whose own metrics differ.
 */
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { ensureDir, portFree, qaEnv, seedQa, startServer, stopServer, waitFor } from "../scripts/qa-lib";

const env = qaEnv("mobile-viewports", 3141);
const OUT = ensureDir(path.join(process.cwd(), ".qa", "mobile-viewports"));
const TEMPLATE = process.env.MV_TEMPLATE || "101";
const REPORT = process.env.MV_REPORT === "1";
const STRICT = process.env.MV_STRICT !== "0";

/** The phones this market actually uses, plus a tablet and a desktop as controls. */
const VIEWPORTS = [
  { w: 320, h: 568, name: "iPhone SE 1 / older budget Android" },
  { w: 360, h: 640, name: "commonest Android width in the Gulf" },
  { w: 375, h: 667, name: "iPhone SE 2/3" },
  { w: 390, h: 844, name: "iPhone 13/14/15" },
  { w: 412, h: 915, name: "Pixel / Samsung" },
  { w: 430, h: 932, name: "iPhone Pro Max" },
  { w: 768, h: 1024, name: "tablet portrait (control)" },
  { w: 1280, h: 800, name: "desktop (control)" },
];

/** Arabic everywhere; English only where a one-direction-only break would hide. */
const RUNS: { lang: "ar" | "en"; widths: number[] }[] = [
  { lang: "ar", widths: VIEWPORTS.map((v) => v.w) },
  { lang: "en", widths: [360, 390] },
];

/** CLS needs an observer in place before the first paint. */
const INIT = `
window.__cls = { value: 0, shifts: [] };
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const ent = e;
      if (ent.hadRecentInput) continue;
      window.__cls.value += ent.value;
      window.__cls.shifts.push({
        value: Number(ent.value.toFixed(5)),
        t: Math.round(ent.startTime),
        srcs: (ent.sources || []).map(function (s) {
          const n = s.node;
          if (!n || !n.tagName) return { node: "(detached)" };
          return {
            node: n.tagName.toLowerCase(),
            cls: String(n.className || "").slice(0, 140),
            txt: (n.innerText || n.alt || "").trim().replace(/\\s+/g, " ").slice(0, 40),
            from: [Math.round(s.previousRect.y), Math.round(s.previousRect.height)],
            to: [Math.round(s.currentRect.y), Math.round(s.currentRect.height)],
          };
        }),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
} catch (e) {}
`;

/**
 * Everything measured inside the page, in one pass, as a plain object.
 *
 * Written as a string rather than a function so the whole probe is one literal with no bundling concerns
 * and no shared types leaking between the node and browser halves.
 */
const PROBE = `(() => {
  const AR = /[\\u0600-\\u06FF]/;
  const vw = window.innerWidth, vh = window.innerHeight;
  const tpl = document.querySelector(".tpl");
  const sectionOf = (el) => { let p = el; while (p && p !== document.body) { if (p.tagName === "SECTION" || p.tagName === "HEADER" || p.tagName === "FOOTER" || p.tagName === "NAV") return p.id ? "#" + p.id : p.tagName.toLowerCase(); p = p.parentElement; } return "?"; };
  const desc = (el) => ({
    tag: el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""),
    cls: String(el.className || "").split(/\\s+/).filter(Boolean).slice(0, 7).join(" "),
    txt: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || "").trim().replace(/\\s+/g, " ").slice(0, 45),
    sec: sectionOf(el),
  });
  const inScroller = (el) => { let p = el; while (p && p !== document.documentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; p = p.parentElement; } return false; };
  const decorative = (el) => el.getAttribute("aria-hidden") === "true" || !!el.closest("[aria-hidden=true]");
  /* The nearest ancestor that actually cuts this box off, and whether it does. A decorative glow hanging
     80px past its own \`overflow-hidden\` section is design; the same glow with nothing clipping it is a
     page that would scroll sideways if body were not hiding it. */
  const clipper = (el) => {
    const r = el.getBoundingClientRect();
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const c = getComputedStyle(p);
      if (c.overflowX === "hidden" || c.overflowX === "clip" || c.overflow === "hidden" || c.overflow === "clip") {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) return p.tagName.toLowerCase() + "." + String(p.className || "").split(/\\s+/).slice(0, 3).join(".");
      }
      p = p.parentElement;
    }
    return null;
  };

  /* ---- horizontal overflow: rectangles, because the clip hides the scrollbar ---- */
  const overflow = [];
  document.querySelectorAll("*").forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const past = Math.max(r.right - vw, -r.left);
    if (past <= 1) return;
    if (inScroller(el)) return;
    if (s.position === "fixed" && s.transform !== "none") return; /* parked off-canvas drawer */
    overflow.push({ ...desc(el), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), past: Math.round(past), side: r.right - vw > -r.left ? "right" : "left", decorative: decorative(el), clippedBy: clipper(el), position: s.position });
  });
  /*
   * Content cut off inside a box, which the viewport check cannot see.
   *
   * \`overflow-x: hidden\` is legitimate almost everywhere it appears here — the before/after reveal pane is
   * a half-width clip over a full-width photograph, \`sr-only\` is a 1px box, \`truncate\`/\`line-clamp\` cut on
   * purpose. What is never legitimate is *words* disappearing off the side of their own box, so this looks
   * only at elements with their own text.
   */
  const textCutOff = [];
  document.querySelectorAll("*").forEach((el) => {
    if (!(el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4)) return;
    const o = getComputedStyle(el).overflowX;
    if (o === "auto" || o === "scroll" || o === "visible") return;
    if (/truncate|line-clamp|sr-only|text-ellipsis/.test(String(el.className || ""))) return;
    if (el.closest(".sr-only")) return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) return;
    textCutOff.push({ ...desc(el), clientW: el.clientWidth, scrollW: el.scrollWidth, overflowX: o });
  });
  const scrollers = [];
  document.querySelectorAll("*").forEach((el) => {
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      scrollers.push({ ...desc(el), clientW: el.clientWidth, scrollW: el.scrollWidth, overflowX: o, intended: o === "auto" || o === "scroll" });
    }
  });

  /* ---- above-the-fold conversion ---- */
  const waLinks = [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]')];
  const isFixed = (el) => { let p = el; while (p) { if (getComputedStyle(p).position === "fixed") return true; p = p.parentElement; } return false; };
  const floating = waLinks.filter(isFixed);
  /* The nav's own WhatsApp button is \`max-sm:hidden\`: display:none measures as a 0x0 box at y=0, which
     would otherwise read as a CTA comfortably above the fold. Only a painted box counts. */
  const inFlow = waLinks.filter((a) => !floating.includes(a) && a.getBoundingClientRect().height > 0);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, txt: (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 30), sec: sectionOf(el) }; };
  const heroCta = inFlow.find((a) => a.closest("main")) || inFlow[0] || null;
  const allWa = { floating: floating.map(box), inFlow: inFlow.map(box), hiddenInNav: waLinks.filter((a) => a.getBoundingClientRect().height === 0).map((a) => ({ cls: String(a.className || "").slice(0, 80), sec: sectionOf(a) })) };
  /* A fixed overlay painted over a conversion control (a consent bar, a promo strip) is a lost lead: the
     visitor can see the button and cannot press it. */
  const zOf = (el) => { let p = el; while (p) { const z = getComputedStyle(p).zIndex; if (z !== "auto") return Number(z) || 0; p = p.parentElement; } return 0; };
  const fixedOverlays = [...document.querySelectorAll("body *")].filter((el) => { if (getComputedStyle(el).position !== "fixed") return false; const r = el.getBoundingClientRect(); return r.width > vw * 0.5 && r.height > 20; });
  const buried = [];
  for (const c of floating.concat(inFlow)) {
    const r = c.getBoundingClientRect();
    if (r.width <= 0) continue;
    for (const o of fixedOverlays) {
      if (o === c || o.contains(c)) continue;
      const or = o.getBoundingClientRect();
      if (or.right < r.left || or.left > r.right || or.bottom < r.top || or.top > r.bottom) continue;
      if (zOf(o) <= zOf(c)) continue;
      buried.push({ control: (c.innerText || c.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 24), controlZ: zOf(c), overlay: desc(o), overlayZ: zOf(o), overlayH: Math.round(or.height), coversPct: Math.round((or.height / vh) * 1000) / 10 });
    }
  }

  /* ---- tap targets ---- */
  const taps = [];
  document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, [role=button], summary").forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return;
    if (el.classList.contains("sr-only") || el.closest(".sr-only")) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    if (r.width >= 44 && r.height >= 44) return;
    const href = el.getAttribute("href") || "";
    taps.push({ ...desc(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, href: href.slice(0, 44), conversion: /wa\\.me|whatsapp|tel:|mailto:/.test(href) || el.type === "submit" });
  });

  /* ---- Arabic typography ---- */
  const lineBoxes = (el) => {
    try {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const rects = [...rg.getClientRects()].filter((r) => r.height > 2);
      const lines = [];
      rects.forEach((r) => {
        const hit = lines.find((l) => Math.abs(l.top - r.top) < r.height * 0.5);
        if (hit) { hit.left = Math.min(hit.left, r.left); hit.right = Math.max(hit.right, r.right); hit.bottom = Math.max(hit.bottom, r.bottom); }
        else lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      });
      return lines.sort((a, b) => a.top - b.top);
    } catch (e) { return []; }
  };
  const type = [];
  document.querySelectorAll("h1, h2, h3, main p, footer p, blockquote").forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display === "none") return;
    const t = (el.innerText || "").trim();
    if (!t) return;
    const fs = parseFloat(s.fontSize);
    const lh = s.lineHeight === "normal" ? NaN : parseFloat(s.lineHeight);
    const lines = lineBoxes(el);
    let overlap = 0;
    for (let i = 1; i < lines.length; i++) if (lines[i].top < lines[i - 1].bottom - 0.6) overlap = Math.max(overlap, Math.round((lines[i - 1].bottom - lines[i].top) * 10) / 10);
    const r = el.getBoundingClientRect();
    type.push({ ...desc(el), arabic: AR.test(t), fontSize: fs, lineHeight: isNaN(lh) ? null : Math.round(lh * 10) / 10, ratio: isNaN(lh) ? null : Math.round((lh / fs) * 1000) / 1000, lines: lines.length, words: t.split(/\\s+/).length, wordsPerLine: lines.length ? Math.round((t.split(/\\s+/).length / lines.length) * 10) / 10 : null, lineOverlapPx: overlap, clipped: el.scrollHeight > el.clientHeight + 1, clamped: /line-clamp|truncate/.test(String(el.className || "")), boxH: Math.round(r.height), boxW: Math.round(r.width), dir: s.direction, align: s.textAlign, family: s.fontFamily.split(",")[0].replace(/['"]/g, "") });
  });

  /* ---- direction / alignment faults on Arabic leaf text ---- */
  const dirFaults = [];
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length) return;
    const t = (el.innerText || el.textContent || "").trim();
    if (!t || !AR.test(t)) return;
    const s = getComputedStyle(el);
    const bad = [];
    if (s.direction === "ltr") bad.push("direction:ltr");
    if (s.textAlign === "left") bad.push("text-align:left");
    if (bad.length) dirFaults.push({ ...desc(el), faults: bad });
  });

  /* ---- named RTL landmarks ---- */
  const chrome = {
    dir: tpl ? getComputedStyle(tpl).direction : null,
    htmlDir: document.documentElement.getAttribute("dir"),
    htmlLang: document.documentElement.getAttribute("lang"),
    scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
    header: (() => { const h = document.querySelector("header"); if (!h) return null; const r = h.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), position: getComputedStyle(h).position }; })(),
    floatingWa: floating[0] ? (() => { const r = floating[0].getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), bottomGap: Math.round(vh - r.bottom), side: r.left < vw / 2 ? "screen-left" : "screen-right" }; })() : null,
  };
  const slider = (() => {
    const el = [...document.querySelectorAll("div[dir]")].find((d) => d.querySelector("input[type=range]"));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      dir: el.getAttribute("dir"), computedDir: getComputedStyle(el).direction,
      w: Math.round(r.width), h: Math.round(r.height), aspect: getComputedStyle(el).aspectRatio,
      chips: [...el.querySelectorAll("span")].filter((s) => (s.innerText || "").trim().length && (s.innerText || "").trim().length < 14).map((s) => { const b = s.getBoundingClientRect(); return { txt: s.innerText.trim(), fromInlineStart: Math.round(getComputedStyle(el).direction === "rtl" ? r.right - b.right : b.left - r.left), w: Math.round(b.width), h: Math.round(b.height) }; }),
      rangeH: (() => { const i = el.querySelector("input[type=range]"); return i ? Math.round(i.getBoundingClientRect().height) : null; })(),
    };
  })();
  const forms = [...document.querySelectorAll("form")].map((f) => ({
    fields: [...f.querySelectorAll("input, textarea, select")].map((i) => { const s = getComputedStyle(i); const r = i.getBoundingClientRect(); return { name: i.getAttribute("name") || i.type, type: i.type, fontSize: parseFloat(s.fontSize), align: s.textAlign, dir: s.direction, h: Math.round(r.height), w: Math.round(r.width), inputmode: i.getAttribute("inputmode"), autocomplete: i.getAttribute("autocomplete") }; }),
    submit: (() => { const b = f.querySelector("[type=submit], button"); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
  }));
  const frames = [...document.querySelectorAll("iframe")].map((f) => { const r = f.getBoundingClientRect(); return { src: (f.getAttribute("src") || "").slice(0, 70), w: Math.round(r.width), h: Math.round(r.height), title: f.getAttribute("title"), loading: f.getAttribute("loading") }; });

  /* ---- shape of the page: grids that become columns, images squashed out of shape ---- */
  const grids = [];
  document.querySelectorAll("main div").forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display !== "grid") return;
    const cols = s.gridTemplateColumns.split(" ").filter(Boolean);
    const kids = [...el.children].filter((k) => getComputedStyle(k).display !== "none");
    if (!kids.length) return;
    const r = el.getBoundingClientRect(), k0 = kids[0].getBoundingClientRect();
    grids.push({ ...desc(el), cols: cols.length, colW: cols.map((c) => Math.round(parseFloat(c) || 0)).slice(0, 6), items: kids.length, itemW: Math.round(k0.width), itemH: Math.round(k0.height), totalH: Math.round(r.height), screensTall: Math.round((r.height / vh) * 10) / 10 });
  });
  const imgs = [...document.querySelectorAll("img")].map((i) => { const r = i.getBoundingClientRect(); const s = getComputedStyle(i); return { alt: (i.alt || "").slice(0, 28), emptyAlt: i.getAttribute("alt") === "", w: Math.round(r.width), h: Math.round(r.height), boxRatio: r.height ? Math.round((r.width / r.height) * 100) / 100 : null, natural: i.naturalWidth + "x" + i.naturalHeight, natRatio: i.naturalHeight ? Math.round((i.naturalWidth / i.naturalHeight) * 100) / 100 : null, fit: s.objectFit, objectPosition: s.objectPosition, loading: i.loading, hasWH: !!(i.getAttribute("width") && i.getAttribute("height")), sec: sectionOf(i), complete: i.complete }; });

  return {
    vw, vh, docH: document.documentElement.scrollHeight,
    docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX, tplOverflowX: tpl ? getComputedStyle(tpl).overflowX : null,
    overflow: overflow.sort((a, b) => b.past - a.past).slice(0, 40),
    textCutOff, buried,
    scrollers: scrollers.slice(0, 25),
    heroCta: box(heroCta), heroCtaAboveFold: heroCta ? heroCta.getBoundingClientRect().bottom <= vh : null, allWa,
    h1: box(document.querySelector("h1")),
    firstSectionH: (() => { const s = document.querySelector("main > section"); return s ? Math.round(s.getBoundingClientRect().height) : null; })(),
    taps, type: type.slice(0, 90), dirFaults: dirFaults.slice(0, 25),
    chrome, slider, forms, frames, grids: grids.slice(0, 25), imgs: imgs.slice(0, 45),
    cls: window.__cls,
    fontsStatus: document.fonts ? document.fonts.status : null,
  };
})()`;

type Probe = any;

/** Scrolls the page once so lazy images below the fold have real boxes, then settles. */
async function settleImages(page: Page) {
  await page
    .evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      for (const i of imgs) i.loading = "eager";
      const step = window.innerHeight;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 70));
      }
      window.scrollTo(0, 0);
      await Promise.all(
        imgs.map(
          (i) =>
            new Promise<void>((res) => {
              if (i.complete) return res();
              i.addEventListener("load", () => res(), { once: true });
              i.addEventListener("error", () => res(), { once: true });
              setTimeout(() => res(), 8000);
            }),
        ),
      );
    })
    .catch(() => {});
  await page.waitForTimeout(350);
}

async function measure(browser: Browser, url: string, vp: { w: number; h: number; name: string }) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, locale: "ar-KW", isMobile: vp.w < 700, hasTouch: vp.w < 700 });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const fonts: { url: string; bytes: number }[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("response", async (r) => {
    if (!/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) return;
    let bytes = 0;
    try {
      bytes = (await r.body()).byteLength;
    } catch {
      /* body already gone */
    }
    fonts.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ""), bytes });
  });
  // Demo videos are large external files; the screenshot script skips them for the same reason.
  await page.route(/\.(mp4|webm|mov)(\?|$)/i, (r) => r.abort());
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    // What face is the headline painted in before the webfont lands? `display: swap` means a flash.
    const preSwap = await page.evaluate(() => { const h = document.querySelector("h1"); return { family: h ? getComputedStyle(h).fontFamily.split(",")[0].replace(/['"]/g, "") : null, fontsStatus: (document as any).fonts?.status ?? null }; }).catch(() => null);
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
    // First pass: the fold, measured at scroll 0 with nothing forced.
    const fold: Probe = await page.evaluate(PROBE);
    await settleImages(page);
    const full: Probe = await page.evaluate(PROBE);
    // The mobile drawer, which only exists below lg.
    let menu: Probe = null;
    const trigger = page.locator("header button[aria-expanded]").first();
    if (vp.w < 1024 && (await trigger.count())) {
      const tb = await trigger.boundingBox();
      await trigger.click().catch(() => {});
      await page.waitForTimeout(400);
      menu = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[role=dialog]') ?? document.querySelector<HTMLElement>('[class*="z-[100]"]');
        const r = panel?.getBoundingClientRect();
        return {
          panel: r ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) } : null,
          vw: window.innerWidth, vh: window.innerHeight,
          items: panel ? [...panel.querySelectorAll("a,button")].map((a) => { const b = a.getBoundingClientRect(); return { txt: (a as HTMLElement).innerText.trim().replace(/\s+/g, " ").slice(0, 24), w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), align: getComputedStyle(a).textAlign, belowFold: b.bottom > window.innerHeight }; }) : [],
        };
      });
      if (menu) menu.trigger = tb ? { w: Math.round(tb.width), h: Math.round(tb.height) } : null;
      await page.keyboard.press("Escape").catch(() => {});
    }
    return { url, vp, errors: errors.filter((e) => !/net::ERR|unsplash|fonts\.googleapis/.test(e)), preSwap, fold, full, menu, fonts, fontCount: fonts.length, fontBytes: fonts.reduce((a, f) => a + f.bytes, 0) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Turns one measurement into the list of gate failures. */
function verdict(m: Awaited<ReturnType<typeof measure>>, lang: string) {
  const at = `${lang} ${m.vp.w}x${m.vp.h}`;
  const fails: string[] = [];
  // A decoration hanging past its own `overflow-hidden` section is design; anything else is a cut-off page.
  const real = m.full.overflow.filter((o: Probe) => !o.decorative || !o.clippedBy);
  for (const o of real.slice(0, 6)) fails.push(`${at}: <${o.tag}> "${o.txt}" is ${o.w}px wide and sticks ${o.past}px past the ${o.side} edge with nothing clipping it (${o.sec}, class="${o.cls}")`);
  for (const s of m.full.textCutOff.slice(0, 5)) fails.push(`${at}: text cut off sideways — <${s.tag}> "${s.txt}" holds ${s.scrollW}px of content in a ${s.clientW}px box with overflow-x:${s.overflowX} (${s.sec})`);
  if (!m.fold.heroCta) fails.push(`${at}: no in-flow WhatsApp CTA found on the page at all`);
  else if (m.fold.heroCta.bottom > m.vp.h) fails.push(`${at}: hero WhatsApp CTA "${m.fold.heroCta.txt}" ends at y=${m.fold.heroCta.bottom}, below the ${m.vp.h}px fold`);
  for (const t of m.full.taps.filter((t: Probe) => t.conversion)) fails.push(`${at}: conversion control <${t.tag}> "${t.txt || t.href}" is ${t.w}x${t.h}, under 44x44 (${t.sec})`);
  for (const b of m.fold.buried.slice(0, 3)) fails.push(`${at}: conversion control "${b.control}" (z=${b.controlZ}) is covered by a fixed <${b.overlay.tag}> "${b.overlay.txt}" (z=${b.overlayZ}, ${b.overlayH}px = ${b.coversPct}% of the screen)`);
  // The drawer's own CTA is the whole point of opening the menu, and it is measured only when it is open.
  for (const i of (m.menu?.items ?? []).filter((i: Probe) => /whatsapp|واتساب/i.test(i.txt) && (i.h < 44 || i.w < 44)))
    fails.push(`${at}: the mobile drawer's WhatsApp CTA is ${i.w}x${i.h}, under 44x44`);
  if (lang === "ar")
    for (const h of m.full.type.filter((t: Probe) => t.arabic && /^h[12]/.test(t.tag) && t.ratio !== null && t.ratio < 1.3).slice(0, 6))
      fails.push(`${at}: Arabic <${h.tag}> "${h.txt}" is set at ${h.fontSize}px/${h.lineHeight}px = ${h.ratio}, under the 1.4 AR_LEADING floor (${h.sec})`);
  return fails;
}


/** Warnings: measured, reported, but not a gate — thresholds are judgement calls, not correctness. */
function warnings(m: Awaited<ReturnType<typeof measure>>, lang: string) {
  const at = `${lang} ${m.vp.w}x${m.vp.h}`;
  const w: string[] = [];
  for (const t of m.full.taps.filter((t: Probe) => !t.conversion).slice(0, 8)) w.push(`${at}: tap target <${t.tag}> "${t.txt || t.href}" is ${t.w}x${t.h} (${t.sec})`);
  for (const s of m.full.scrollers.filter((s: Probe) => !s.intended).slice(0, 4)) w.push(`${at}: <${s.tag}> holds ${s.scrollW}px in a ${s.clientW}px box (overflow-x:${s.overflowX}) — intended clip or cut-off content? (${s.sec})`);
  for (const o of m.full.overflow.filter((o: Probe) => o.decorative && o.clippedBy).slice(0, 3)) w.push(`${at}: decoration <${o.tag}> reaches ${o.past}px past the ${o.side} edge, clipped by ${o.clippedBy} (${o.sec})`);
  if (m.full.cls?.value > 0.1) {
    const worst = [...(m.full.cls.shifts || [])].sort((a: Probe, b: Probe) => b.value - a.value)[0];
    w.push(`${at}: CLS ${m.full.cls.value.toFixed(3)} — worst shift ${worst?.value} from <${worst?.srcs?.[0]?.node}> "${worst?.srcs?.[0]?.txt}" y ${worst?.srcs?.[0]?.from?.[0]} -> ${worst?.srcs?.[0]?.to?.[0]}`);
  }
  for (const d of m.full.dirFaults.slice(0, 6)) w.push(`${at}: Arabic text with ${d.faults.join(" + ")}: <${d.tag}> "${d.txt}" (${d.sec})`);
  for (const t of m.full.type.filter((t: Probe) => t.lineOverlapPx > 0).slice(0, 6)) w.push(`${at}: line boxes overlap by ${t.lineOverlapPx}px in <${t.tag}> "${t.txt}" (${t.fontSize}px/${t.lineHeight}px)`);
  for (const t of m.full.type.filter((t: Probe) => t.clipped && !t.clamped).slice(0, 6)) w.push(`${at}: text clipped by its box: <${t.tag}> "${t.txt}" (${t.sec})`);
  for (const g of m.full.grids.filter((g: Probe) => g.cols === 1 && g.items >= 6 && g.screensTall >= 4).slice(0, 5)) w.push(`${at}: ${g.items} items in 1 column is ${g.screensTall} screens tall (${g.sec}, class="${g.cls}")`);
  for (const g of m.full.grids.filter((g: Probe) => g.itemW > 0 && g.itemW < 150 && g.cols > 1).slice(0, 5)) w.push(`${at}: grid cell only ${g.itemW}px wide across ${g.cols} columns (${g.sec})`);
  for (const i of m.full.imgs.filter((i: Probe) => i.fit !== "cover" && i.fit !== "contain" && i.natRatio && i.boxRatio && Math.abs(i.natRatio - i.boxRatio) > 0.15).slice(0, 5)) w.push(`${at}: image "${i.alt}" squashed: box ${i.w}x${i.h} (${i.boxRatio}) vs source ${i.natural} (${i.natRatio}), object-fit:${i.fit}`);
  for (const e of m.errors.slice(0, 4)) w.push(`${at}: ${e}`);
  return w;
}

async function main() {
  if (!(await portFree(env.port))) throw new Error(`port ${env.port} busy`);
  const seed = await seedQa({ slug: "mv", name: "ديكور الديرة", category: "gypsum", templateCode: TEMPLATE });
  const host = `mv.${env.root}`;
  const server = startServer(env.port);
  const browser = await chromium.launch();
  const all: Probe[] = [];
  const fails: string[] = [];
  const warns: string[] = [];
  try {
    await waitFor(`http://${env.root}/`, 120000, server);
    for (const run of RUNS) {
      for (const w of run.widths) {
        const vp = VIEWPORTS.find((v) => v.w === w)!;
        const m = await measure(browser, `http://${host}/?lang=${run.lang}`, vp);
        const f = verdict(m, run.lang);
        const g = warnings(m, run.lang);
        fails.push(...f);
        warns.push(...g);
        // The full measurement of one viewport is ~140 KB of JSON; keeping ten of them alive at once is
        // enough to lose a memory-pressured machine, so only the report mode holds on to them.
        if (REPORT) all.push({ lang: run.lang, ...m });
        console.log(`[mv] ${run.lang} ${vp.w}x${vp.h} ${vp.name}: doc ${m.full.docH}px, hero CTA y=${m.fold.heroCta?.bottom ?? "?"}, CLS ${(m.full.cls?.value ?? 0).toFixed(3)}, ${m.fontCount} fonts / ${Math.round(m.fontBytes / 1024)} KB — ${f.length} failures, ${g.length} warnings`);
        if (REPORT) fs.writeFileSync(path.join(OUT, `${run.lang}-${vp.w}.json`), JSON.stringify({ lang: run.lang, ...m }, null, 1));
      }
    }
  } finally {
    await browser.close();
    await stopServer(server);
  }
  if (REPORT) fs.writeFileSync(path.join(OUT, "all.json"), JSON.stringify(all, null, 1));
  console.log(`\n[mv] template ${TEMPLATE} — ${fails.length} failures, ${warns.length} warnings`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  for (const w of warns) console.log(`  warn ${w}`);
  if (REPORT) console.log(`[mv] measurements in ${OUT}`);
  void seed;
  if (STRICT && fails.length) {
    console.log(`[mv] failing: ${fails.length} mobile/Arabic regressions above`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
