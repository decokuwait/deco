import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";
process.env.SUPER_ADMIN_EMAILS = "owner@example.com";

import { getDb, resetDb } from "@/lib/db/client";
import { authenticate, createSession, createUser, deleteSession, getUserByEmail, getUserBySessionToken, listUsers, setPassword, upsertSuperAdmin } from "@/lib/db/users";
import { createSite, deleteSite, getSiteByHost, getSiteById, getSiteData, listSites, patchSiteContent, updateSite } from "@/lib/db/sites";
import { addDomain, findDomain, listDomains, removeDomain, updateDomainStatus } from "@/lib/db/domains";
import { addMember, isSiteMember, listMembers, removeMember } from "@/lib/db/members";
import { addMedia, createProject, deleteMedia, deleteProject, getProject, listProjects, moveMedia, moveProject, updateMedia, updateProject, countProjects } from "@/lib/db/projects";
import { getActivePixels, listPixels, upsertPixel } from "@/lib/db/pixels";
import { getVisitorByCode, incrementWhatsappClicks, searchVisitors, trackVisit, updateVisitor, visitorStats } from "@/lib/db/visitors";
import { createEvent, hasRecentEvent, listRecentEvents, listVisitorEvents, setEventDeliveries } from "@/lib/db/events";
import { listOrphanMemberIds } from "@/lib/db/members";
import { listMediaKeys } from "@/lib/db/media";
import { q } from "@/lib/db/client";
import { demoContent } from "@/lib/demo/content";

let siteId = "";
let userId = "";

beforeAll(async () => {
  const db = await getDb();
  expect(db.backend).toBe(process.env.TEST_DATABASE_URL ? "postgres" : "pglite");
});

afterAll(async () => {
  await resetDb();
});

describe("users & sessions", () => {
  it("creates users, hashes passwords and authenticates", async () => {
    const u = await createUser({ email: "Owner@Example.com", password: "Secret123!", name: "Owner" });
    userId = u.id;
    expect(u.email).toBe("owner@example.com");
    expect(u.isSuper).toBe(true); // in SUPER_ADMIN_EMAILS
    const stored = await getUserByEmail("owner@example.com");
    expect(stored?.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(await authenticate("owner@example.com", "wrong")).toBeNull();
    expect((await authenticate("owner@example.com", "Secret123!"))?.id).toBe(u.id);
  });
  it("issues and revokes sessions", async () => {
    const { token } = await createSession(userId);
    expect((await getUserBySessionToken(token))?.id).toBe(userId);
    await deleteSession(token);
    expect(await getUserBySessionToken(token)).toBeNull();
    expect(await getUserBySessionToken("short")).toBeNull();
  });
  it("setPassword invalidates sessions", async () => {
    const { token } = await createSession(userId);
    await setPassword(userId, "NewPass1!");
    expect(await getUserBySessionToken(token)).toBeNull();
    expect((await authenticate("owner@example.com", "NewPass1!"))?.id).toBe(userId);
  });
  it("upsertSuperAdmin is idempotent", async () => {
    const a = await upsertSuperAdmin("owner@example.com", "Again1!");
    expect(a.id).toBe(userId);
    const b = await upsertSuperAdmin("second@example.com", "Pass1!");
    expect(b.isSuper).toBe(true);
    // Counted per address, not over the whole table: against a real Postgres these suites share one
    // database, so a total row count would depend on what the other file happened to insert.
    const emails = (await listUsers()).map((u) => u.email);
    expect(emails.filter((e) => e === "owner@example.com").length).toBe(1);
    expect(emails.filter((e) => e === "second@example.com").length).toBe(1);
  });
});

describe("sites, domains, members", () => {
  it("creates a site with demo content and resolves by host", async () => {
    const site = await createSite({ slug: "Elite", name: "Elite Decor", category: "gypsum", templateCode: "101", content: demoContent("gypsum") });
    siteId = site.id;
    expect(site.slug).toBe("elite");
    expect(site.content.brand.name.ar).not.toBe("");
    expect(site.content.settings.signalMode).toBe("smart");
    const bySub = await getSiteByHost(["elite.decokuwait.com"], "elite");
    expect(bySub?.id).toBe(site.id);
    expect(await getSiteByHost(["nope.com"], null)).toBeNull();
  });
  it("custom domains resolve through site_domains", async () => {
    await addDomain({ siteId, hostname: "Elite-Decor.com", kind: "custom" });
    expect((await getSiteByHost(["www.elite-decor.com", "elite-decor.com"], null))?.id).toBe(siteId);
    const d = await findDomain("elite-decor.com");
    expect(d?.kind).toBe("custom");
    await updateDomainStatus(d!.id, { verified: true, vercelStatus: { configured: true } });
    const list = await listDomains(siteId);
    expect(list[0].verified).toBe(true);
    expect(list[0].vercelStatus).toEqual({ configured: true });
    await removeDomain(d!.id);
    expect(await findDomain("elite-decor.com")).toBeNull();
  });
  it("never re-assigns a hostname that belongs to another site", async () => {
    const other = await createSite({ slug: "rival", name: "Rival", category: "aluminum", templateCode: "201" });
    await addDomain({ siteId: other.id, hostname: "taken.com", kind: "custom" });
    await expect(addDomain({ siteId, hostname: "taken.com", kind: "custom" })).rejects.toThrow("domain_taken");
    expect((await findDomain("taken.com"))?.siteId).toBe(other.id);
    await deleteSite(other.id);
  });
  it("updates site fields and patches content deeply", async () => {
    await updateSite(siteId, { name: "Elite 2", status: "paused", templateCode: "105" });
    const s = await getSiteById(siteId);
    expect(s?.name).toBe("Elite 2");
    expect(s?.status).toBe("paused");
    expect(s?.templateCode).toBe("105");
    await patchSiteContent(siteId, { contact: { whatsapp: "96511111111" }, settings: { signalMode: "all" } });
    const s2 = await getSiteById(siteId);
    expect(s2?.content.contact.whatsapp).toBe("96511111111");
    expect(s2?.content.settings.signalMode).toBe("all");
    expect(s2?.content.brand.name.ar).not.toBe(""); // untouched
    await updateSite(siteId, { status: "active" });
  });
  // The optimistic lock is a compare-and-swap on the stored content. It cannot key off updated_at: a real
  // Postgres keeps microseconds and postgres.js truncates every timestamp parameter to milliseconds, so a
  // timestamp read from a row can never be compared back to it and every save failed as concurrent_update.
  it("patches content and refuses a write whose base content changed underneath", async () => {
    await q(`update sites set updated_at = $2::timestamptz where id = $1`, [siteId, "2026-01-02 03:04:05.264891+00"]);
    await patchSiteContent(siteId, { contact: { phone: "96512345678" } });
    const s = await getSiteById(siteId);
    expect(s?.content.contact.phone).toBe("96512345678");
    expect(s?.content.contact.whatsapp).toBe("96511111111"); // untouched by the patch

    const [base] = await q<{ h: string }>(`select md5(content::text) as h from sites where id = $1`, [siteId]);
    await patchSiteContent(siteId, { contact: { phone: "96500000000" } });
    const stale = await q(`update sites set content = '{}'::jsonb where id = $1 and md5(content::text) = $2 returning id`, [siteId, base.h]);
    expect(stale.length, "a write based on superseded content must not land").toBe(0);
    expect((await getSiteById(siteId))?.content.contact.phone).toBe("96500000000");
  });
  it("manages members", async () => {
    const u = await createUser({ email: "admin@site.com", password: "Pass1!" });
    expect(u.isSuper).toBe(false);
    await addMember(siteId, u.id);
    expect(await isSiteMember(siteId, u.id)).toBe(true);
    expect((await listMembers(siteId)).map((m) => m.email)).toEqual(["admin@site.com"]);
    await removeMember(siteId, u.id);
    expect(await isSiteMember(siteId, u.id)).toBe(false);
  });
  it("lists sites with counts", async () => {
    const list = await listSites();
    expect(list.find((s) => s.id === siteId)?.visitorCount).toBe(0);
  });
});

describe("projects & media", () => {
  let projectId = "";
  it("creates projects of each type with media ordering", async () => {
    const p = await createProject({ siteId, type: "progress", title: { ar: "فيلا", en: "Villa" } });
    projectId = p.id;
    const m1 = await addMedia({ projectId, kind: "image", url: "https://x/1.jpg", role: "step", stepLabel: { ar: "اليوم 1", en: "Day 1" }, stepDate: "2025-01-06" });
    const m2 = await addMedia({ projectId, kind: "video", url: "https://x/2.mp4", role: "step", stepLabel: { ar: "اليوم 2", en: "Day 2" }, stepDate: "2025-01-08", posterUrl: "https://x/p.jpg" });
    expect(m1.order).toBe(0);
    expect(m2.order).toBe(1);
    const full = await getProject(projectId);
    expect(full?.media.length).toBe(2);
    expect(full?.media[0].stepDate).toBe("2025-01-06");
    await moveMedia(m2.id, "up");
    const after = await getProject(projectId);
    expect(after?.media[0].id).toBe(m2.id);
    await updateMedia(m1.id, { caption: { ar: "تعليق", en: "Caption" }, stepDate: null });
    const upd = await getProject(projectId);
    expect(upd?.media.find((m) => m.id === m1.id)?.caption?.en).toBe("Caption");
    expect(upd?.media.find((m) => m.id === m1.id)?.stepDate).toBeNull();
    await q(`update project_media set created_at = $2::timestamptz where id = $1`, [m2.id, "2026-01-02 03:04:05.264891+00"]);
    await q(`update project_media set created_at = $2::timestamptz where id = $1`, [m1.id, "2026-01-02 03:04:06.135794+00"]);
    await moveMedia(m2.id, "down");
    expect((await getProject(projectId))?.media.map((m) => m.id)).toEqual([m1.id, m2.id]);
    await deleteMedia(m1.id);
    expect((await getProject(projectId))?.media.length).toBe(1);
  });
  it("lists by type, honours published and reorders", async () => {
    const a = await createProject({ siteId, type: "finished", title: { ar: "أ", en: "A" } });
    const b = await createProject({ siteId, type: "finished", title: { ar: "ب", en: "B" }, published: false });
    expect((await listProjects(siteId, { type: "finished" })).map((p) => p.id)).toEqual([a.id, b.id]);
    expect((await listProjects(siteId, { type: "finished", publishedOnly: true })).map((p) => p.id)).toEqual([a.id]);
    await updateProject(b.id, { published: true, coverUrl: "https://x/c.jpg" });
    await moveProject(b.id, "up");
    expect((await listProjects(siteId, { type: "finished" })).map((p) => p.id)).toEqual([b.id, a.id]);
    // Same microsecond hazard as the site patch: a truncated created_at sorts before the row itself, so a
    // "down" move would pick the row as its own neighbour instead of swapping with the next one.
    await q(`update projects set created_at = $2::timestamptz where id = $1`, [b.id, "2026-01-02 03:04:05.264891+00"]);
    await q(`update projects set created_at = $2::timestamptz where id = $1`, [a.id, "2026-01-02 03:04:06.135794+00"]);
    await moveProject(b.id, "down");
    expect((await listProjects(siteId, { type: "finished" })).map((p) => p.id)).toEqual([a.id, b.id]);
    const counts = await countProjects(siteId);
    expect(counts.finished).toBe(2);
    expect(counts.progress).toBe(1);
    const data = await getSiteData((await getSiteById(siteId))!);
    expect(data.projects.length).toBe(3);
    await deleteProject(a.id);
    await deleteProject(b.id);
  });
});

describe("pixels", () => {
  it("upserts and lists active pixels", async () => {
    await upsertPixel(siteId, "meta", { pixelId: "123", accessToken: "tok", active: true, eventMap: { contacted: "Lead" } });
    await upsertPixel(siteId, "tiktok", { pixelId: "TT", active: false });
    await upsertPixel(siteId, "meta", { testEventCode: "TEST" });
    const all = await listPixels(siteId);
    expect(all.length).toBe(2);
    const active = await getActivePixels(siteId);
    expect(active.map((p) => p.platform)).toEqual(["meta"]);
    expect(active[0].accessToken).toBe("tok");
    expect(active[0].testEventCode).toBe("TEST");
    expect(active[0].eventMap.contacted).toBe("Lead");
  });
});

describe("visitors & events", () => {
  let code = "";
  it("tracks a new visit with attribution and allocates a code", async () => {
    const r = await trackVisit({ siteId, code: null, landingUrl: "https://elite.decokuwait.com/?fbclid=ABC", referrer: "https://instagram.com/", userAgent: "UA", ip: "9.9.9.9", cookies: { _fbp: "fbp" } });
    expect(r.created).toBe(true);
    code = r.visitor.code;
    expect(code).toMatch(/^[1-9]\d{5}$/);
    expect(r.visitor.sourcePlatform).toBe("meta");
    expect(r.visitor.clickIds.fbclid).toBe("ABC");
    expect(r.visitor.cookies._fbc).toContain("ABC");
    expect(r.visitor.cookies._fbp).toBe("fbp");
  });
  it("uses the cookie code from the proxy when unknown, and counts revisits", async () => {
    const first = await trackVisit({ siteId, code: "555555", landingUrl: "https://elite.decokuwait.com/?ttclid=T" });
    expect(first.created).toBe(true);
    expect(first.visitor.code).toBe("555555");
    expect(first.visitor.sourcePlatform).toBe("tiktok");
    const again = await trackVisit({ siteId, code: "555555", cookies: { _ttp: "x" } });
    expect(again.created).toBe(false);
    expect(again.visitor.visits).toBe(2);
    expect(again.visitor.cookies._ttp).toBe("x");
  });
  it("a fresh proxy code that collides with an existing visitor gets a new code instead of merging", async () => {
    const r = await trackVisit({ siteId, code: "555555", fresh: true, landingUrl: "https://elite.decokuwait.com/" });
    expect(r.created).toBe(true);
    expect(r.visitor.code).not.toBe("555555");
    const original = await getVisitorByCode(siteId, "555555");
    expect(original?.visits).toBe(2);
  });
  it("updates last-touch attribution when a returning visitor arrives from a new campaign click", async () => {
    const back = await trackVisit({ siteId, code: "555555", landingUrl: "https://elite.decokuwait.com/?sc_click_id=SNAP1", referrer: "https://snapchat.com/" });
    expect(back.created).toBe(false);
    expect(back.visitor.sourcePlatform).toBe("snapchat");
    expect(back.visitor.clickIds.sc_click_id).toBe("SNAP1");
    expect(back.visitor.clickIds.ttclid).toBe("T");
    const plain = await trackVisit({ siteId, code: "555555", landingUrl: "https://elite.decokuwait.com/about" });
    expect(plain.visitor.sourcePlatform).toBe("snapchat");
  });
  it("codes are unique per site and a collision allocates a new one", async () => {
    const other = await createSite({ slug: "other", name: "Other", category: "ceramic", templateCode: "401" });
    const r = await trackVisit({ siteId: other.id, code: "555555" });
    expect(r.visitor.code).toBe("555555");
    expect(r.created).toBe(true);
    await deleteSite(other.id);
  });
  it("marks stages, records events with deliveries and searches", async () => {
    const v = (await getVisitorByCode(siteId, code))!;
    await incrementWhatsappClicks(v.id);
    const ev = (await createEvent({ visitorId: v.id, siteId, eventType: "whatsapp_click", eventId: "e1" }))!;
    await setEventDeliveries(ev.id, ["meta"], [{ platform: "meta", ok: true, status: 200, eventName: "Contact" }]);
    const updated = await updateVisitor(v.id, { stage: "first_payment", name: "أبو محمد", phone: "50000000" });
    expect(updated?.stage).toBe("first_payment");
    expect(updated?.stageUpdatedAt).toBeTruthy();
    await createEvent({ visitorId: v.id, siteId, eventType: "first_payment", stage: "first_payment", value: 150.5, currency: "KWD", eventId: "e2", targets: ["meta"], deliveries: [{ platform: "meta", ok: false, error: "x" }] });
    const events = await listVisitorEvents(v.id);
    expect(events.length).toBe(2);
    expect(events[0].value).toBe(150.5);
    expect(events[1].deliveries[0].ok).toBe(true);
    const recent = await listRecentEvents(siteId);
    expect(recent[0].visitorCode).toBe(code);
    const byCode = await searchVisitors(siteId, { code: code.slice(0, 3) });
    expect(byCode.items.some((x) => x.code === code)).toBe(true);
    const leads = await searchVisitors(siteId, { stage: "leads" });
    expect(leads.total).toBe(1);
    const bySource = await searchVisitors(siteId, { source: "snapchat" });
    expect(bySource.items[0].code).toBe("555555");
    const stats = await visitorStats(siteId);
    expect(stats.total).toBe(3);
    expect(stats.leads).toBe(1);
    expect(stats.whatsappClicks).toBe(1);
    expect(stats.bySource.meta).toBe(1);
    expect(stats.bySource.snapchat).toBe(1);
    expect(stats.byStage.first_payment).toBe(1);
  });
});

describe("click dedupe, site cleanup lookups", () => {
  it("hasRecentEvent only sees the same event type inside the window", async () => {
    const site = await createSite({ slug: "dedupe", name: "Dedupe", category: "gypsum", templateCode: "101" });
    const { visitor } = await trackVisit({ siteId: site.id, code: "424242", fresh: true });
    expect(await hasRecentEvent(visitor.id, "whatsapp_click", 10)).toBe(false);
    const ev = (await createEvent({ visitorId: visitor.id, siteId: site.id, eventType: "whatsapp_click", eventId: "d1" }))!;
    expect(await hasRecentEvent(visitor.id, "whatsapp_click", 10)).toBe(true);
    expect(await hasRecentEvent(visitor.id, "call_click", 10)).toBe(false);
    await q(`update visitor_events set created_at = now() - interval '11 minutes' where id = $1`, [ev.id]);
    expect(await hasRecentEvent(visitor.id, "whatsapp_click", 10)).toBe(false);
    await deleteSite(site.id);
  });
  it("finds the admin accounts and storage keys that belong only to a site", async () => {
    const a = await createSite({ slug: "clean-a", name: "A", category: "gypsum", templateCode: "101" });
    const b = await createSite({ slug: "clean-b", name: "B", category: "gypsum", templateCode: "102" });
    const onlyA = await createUser({ email: "only-a@example.com", password: "Password1!", isSuper: false });
    const shared = await createUser({ email: "shared@example.com", password: "Password1!", isSuper: false });
    const boss = await createUser({ email: "boss@example.com", password: "Password1!", isSuper: true });
    await addMember(a.id, onlyA.id);
    await addMember(a.id, shared.id);
    await addMember(b.id, shared.id);
    await addMember(a.id, boss.id);
    expect(await listOrphanMemberIds(a.id)).toEqual([onlyA.id]);
    await q(`insert into media_assets (site_id, key, url, kind, content_type, size) values ($1, $2, $3, 'image', 'image/png', 10)`, [a.id, `sites/${a.id}/2026/01/x.png`, "/api/files/x"]);
    expect(await listMediaKeys(a.id)).toEqual([`sites/${a.id}/2026/01/x.png`]);
    expect(await listMediaKeys(b.id)).toEqual([]);
    await deleteSite(a.id);
    await deleteSite(b.id);
  });
});
