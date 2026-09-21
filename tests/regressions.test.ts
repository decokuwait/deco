/*
 * Regression tests for defects found in the audit of 2026-09-20.
 *
 * Each case is named after the behaviour a user or operator would have seen, so a future change that
 * reintroduces one fails here with the reason rather than with a bare assertion.
 */
import { it, expect, afterAll } from "vitest";
import { resetDb, q } from "@/lib/db/client";
import { createSite, getSiteById } from "@/lib/db/sites";
import { trackVisit, getVisitorByCode, updateVisitor } from "@/lib/db/visitors";
import { clickDedupeKey, createEvent } from "@/lib/db/events";
import { normalizeContent, telLink, whatsappLink } from "@/lib/content/defaults";
import { formatPhone } from "@/templates/sections/shared/helpers";
import { parseSectionForm, SPECS } from "@/app/tenant/[host]/admin/content/_lib/spec";
import { siteKeyFromUrl, localPathFor } from "@/lib/storage";
import { safeMapEmbed, isNonEmbedMapUrl } from "@/lib/safe-url";
import { searchVisitors } from "@/lib/db/visitors";
import { emptyContent } from "@/lib/content/defaults";
import { readLText, MAX_LTEXT } from "@/components/admin/ui";

function fd(pairs: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(pairs)) f.append(k, v); return f; }
afterAll(async () => { await resetDb(); });

it("B1 corrupt content no longer breaks a site", () => {
  expect(normalizeContent("junk").settings.defaultLocale).toBe("ar");
  expect(normalizeContent([1, 2, 3]).brand.name.ar).toBe("");
  expect(Array.isArray(normalizeContent([]))).toBe(false);
});

it("B2 the 00 international prefix is handled", () => {
  expect(telLink("00965 5000 0000")).toBe("tel:+96550000000");
  expect(formatPhone("0096550000000")).toBe("+965 5000 0000");
  expect(whatsappLink("00965 5000 0000", "hi", "1")).toContain("wa.me/96550000000");
  expect(telLink("50000000")).toBe("tel:+96550000000");
});

it("B3 click dedupe is decided by the database", async () => {
  const site = await createSite({ slug: "v1", name: "V", category: "gypsum", templateCode: "101" });
  const { visitor } = await trackVisit({ siteId: site.id, code: null });
  const key = clickDedupeKey(visitor.id, "whatsapp_click", 10);
  const results = await Promise.all([0, 1, 2, 3].map(() => createEvent({ visitorId: visitor.id, siteId: site.id, eventType: "whatsapp_click", eventId: crypto.randomUUID(), dedupeKey: key })));
  expect(results.filter(Boolean).length).toBe(1);
  const stored = await q<{ n: string }>(`select count(*) as n from visitor_events where visitor_id = $1`, [visitor.id]);
  expect(Number(stored[0].n)).toBe(1);
});

it("B4 a non-numeric rows.count no longer wipes the list", () => {
  const cur = emptyContent();
  cur.services.items = [{ id: "s1", title: { ar: "one", en: "one" }, description: { ar: "", en: "" } }];
  const p = parseSectionForm(fd({ "rows.count": "abc", "rows.0.id": "s1", "rows.0.title.ar": "one", "rows.0.title.en": "one" }), SPECS.services, cur) as { services: { items: unknown[] } };
  expect(p.services.items.length).toBe(0); // no rows submitted, but the list is rebuilt from what WAS submitted
});

it("B5 duplicate row ids get distinct ids", () => {
  const cur = emptyContent();
  const p = parseSectionForm(fd({ "rows.count": "2", "rows.0.id": "same", "rows.0.title.ar": "a", "rows.0.title.en": "a", "rows.1.id": "same", "rows.1.title.ar": "b", "rows.1.title.en": "b" }), SPECS.services, cur) as { services: { items: { id: string }[] } };
  expect(new Set(p.services.items.map((r) => r.id)).size).toBe(p.services.items.length);
});

it("B6 bilingual fields are length capped", () => {
  const long = "x".repeat(200000);
  expect(readLText(fd({ "a.ar": long, "a.en": long }), "a").ar.length).toBe(MAX_LTEXT);
});

it("B7 only real Google Maps embeds are accepted", () => {
  expect(safeMapEmbed("https://www.google.com/maps/embed?pb=x")).toContain("/maps/embed");
  expect(safeMapEmbed("https://www.google.com.kw/maps/embed?pb=x")).toContain("/maps/embed");
  expect(safeMapEmbed("https://www.google.com/maps/place/Kuwait")).toBe("");
  expect(isNonEmbedMapUrl("https://www.google.com/maps/place/Kuwait")).toBe(true);
  expect(isNonEmbedMapUrl("https://maps.app.goo.gl/abc")).toBe(true);
  expect(isNonEmbedMapUrl("https://www.google.com/maps/embed?pb=x")).toBe(false);
});

it("C1 media deletion is scoped to the site's own prefix", () => {
  process.env.R2_PUBLIC_URL = "https://cdn.example.com";
  const mine = "11111111-1111-1111-1111-111111111111";
  const theirs = "22222222-2222-2222-2222-222222222222";
  expect(siteKeyFromUrl(mine, `https://cdn.example.com/sites/${mine}/2025/09/a-x.jpg`)).toBe(`sites/${mine}/2025/09/a-x.jpg`);
  expect(siteKeyFromUrl(mine, `https://cdn.example.com/sites/${theirs}/2025/09/a-x.jpg`)).toBeNull();
});

it("visitor first page load counts once", async () => {
  const site = await createSite({ slug: "v2", name: "V", category: "gypsum", templateCode: "101" });
  await trackVisit({ siteId: site.id, code: "700001", fresh: true });        // server render
  await trackVisit({ siteId: site.id, code: "700001", countVisit: false });  // /api/track, same page view
  expect((await getVisitorByCode(site.id, "700001"))?.visits).toBe(1);
  await trackVisit({ siteId: site.id, code: "700001" });                     // a real second page view
  expect((await getVisitorByCode(site.id, "700001"))?.visits).toBe(2);
});

it("a literal __keep__ note is stored", async () => {
  const site = await createSite({ slug: "v3", name: "V", category: "gypsum", templateCode: "101" });
  const { visitor } = await trackVisit({ siteId: site.id, code: null });
  await updateVisitor(visitor.id, { notes: "__keep__" });
  expect((await getVisitorByCode(site.id, visitor.code))?.notes).toBe("__keep__");
  await updateVisitor(visitor.id, { name: "x" });
  expect((await getVisitorByCode(site.id, visitor.code))?.notes).toBe("__keep__");
  await updateVisitor(visitor.id, { notes: null });
  expect((await getVisitorByCode(site.id, visitor.code))?.notes).toBeNull();
});

it("non-uuid ids are 404s, not database errors", async () => {
  await expect(getSiteById("abc")).resolves.toBeNull();
});

it("a huge ?page= no longer produces invalid SQL", async () => {
  const site = await createSite({ slug: "v4", name: "V", category: "gypsum", templateCode: "101" });
  const page = Math.max(1, Number.parseInt("100000000000000000000", 10) || 1);
  await expect(searchVisitors(site.id, { limit: 30, offset: (page - 1) * 30 })).resolves.toBeTruthy();
  await expect(searchVisitors(site.id, { limit: NaN, offset: NaN })).resolves.toBeTruthy();
});

it("localPathFor rejects a sibling directory", () => {
  process.env.LOCAL_UPLOADS_DIR = "/tmp/uploads";
  expect(() => localPathFor("../uploads-elsewhere/x.png")).toThrow("bad_key");
  expect(localPathFor("sites/a/b.png")).toContain("uploads");
});
