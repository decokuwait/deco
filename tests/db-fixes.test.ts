import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";

import { getDb, q, resetDb } from "@/lib/db/client";
import {
  countSites,
  createSite,
  getSiteById,
  getSiteByHost,
  getSiteBySlug,
  hardDeleteSite,
  listDeletedSites,
  listSites,
  listSitesDueForPause,
  listSitesExpiringWithin,
  patchSiteContent,
  purgeDeletedSites,
  restoreSite,
  setSiteContent,
  softDeleteSite,
  updateSite,
  updateSiteBilling,
} from "@/lib/db/sites";
import { addDomain } from "@/lib/db/domains";
import {
  addMedia,
  createProject,
  getProject,
  getProjectBySlug,
  listProjects,
  listPublishedProjects,
  normalizeProjectSlug,
  projectSlugFrom,
  updateMedia,
  updateProject,
} from "@/lib/db/projects";
import { anonymiseOldVisitors, deleteStaleNewVisitors, getVisitorByCode, getVisitorByCodeAndSecret, trackVisit } from "@/lib/db/visitors";
import { createUser, createSession, listUsers, countUsers, pruneExpiredSessions, pruneLoginAttempts } from "@/lib/db/users";
import { deleteDeletionRow, deletionQueueStats, enqueueDeletion, listPendingDeletions, markDeletionFailed } from "@/lib/db/deletions";

/** Unique per run so a shared real Postgres does not collide between suites. */
const tag = Math.random().toString(36).slice(2, 8);
let siteId = "";

beforeAll(async () => {
  await getDb();
  const site = await createSite({ slug: `fixes-${tag}`, name: "Fixes", category: "gypsum", templateCode: "101" });
  siteId = site.id;
});

afterAll(async () => {
  await resetDb();
});

describe("soft delete", () => {
  it("hides the site from every lookup, and a restore brings it back", async () => {
    const s = await createSite({ slug: `gone-${tag}`, name: "Gone", category: "aluminum", templateCode: "201" });
    await addDomain({ siteId: s.id, hostname: `gone-${tag}.example.com`, kind: "custom" });
    expect((await getSiteById(s.id))?.deletedAt).toBeNull();

    expect(await softDeleteSite(s.id)).toBe(true);
    expect(await softDeleteSite(s.id), "a second soft delete is a no-op").toBe(false);

    expect(await getSiteById(s.id)).toBeNull();
    expect(await getSiteBySlug(`gone-${tag}`)).toBeNull();
    expect(await getSiteByHost([`gone-${tag}.example.com`], null)).toBeNull();
    expect(await getSiteByHost([], `gone-${tag}`)).toBeNull();
    expect((await listSites()).some((x) => x.id === s.id)).toBe(false);
    expect((await listSitesDueForPause()).some((x) => x.id === s.id)).toBe(false);
    // Writes refuse it too, so a stale admin tab cannot resurrect content on a deleted tenant.
    expect(await updateSite(s.id, { name: "Zombie" })).toBeNull();
    expect(await setSiteContent(s.id, (await getSiteById(siteId))!.content)).toBeNull();
    expect(await patchSiteContent(s.id, { contact: { phone: "1" } })).toBeNull();

    // The purge job, and only the purge job, can still see it.
    expect((await getSiteById(s.id, { includeDeleted: true }))?.deletedAt).toBeTruthy();
    expect((await listDeletedSites()).some((x) => x.id === s.id)).toBe(true);

    const back = await restoreSite(s.id);
    expect(back?.deletedAt).toBeNull();
    expect((await getSiteById(s.id))?.name).toBe("Gone");
    await hardDeleteSite(s.id);
  });

  it("purges after the window and queues the external cleanup in the same transaction", async () => {
    const s = await createSite({ slug: `purge-${tag}`, name: "Purge", category: "ceramic", templateCode: "301" });
    await addDomain({ siteId: s.id, hostname: `purge-${tag}.example.com`, kind: "custom" });
    await q(`insert into media_assets (site_id, key, url, kind, content_type, size) values ($1, $2, $3, 'image', 'image/png', 10)`, [
      s.id,
      `sites/${s.id}/2026/01/a.png`,
      "/api/files/a",
    ]);
    await softDeleteSite(s.id);

    expect(await purgeDeletedSites(30), "still inside the recovery window").toEqual([]);
    expect(await getSiteById(s.id, { includeDeleted: true })).not.toBeNull();

    expect(await purgeDeletedSites(0)).toContain(s.id);
    expect(await getSiteById(s.id, { includeDeleted: true })).toBeNull();

    const queued = await listPendingDeletions(100);
    expect(queued.some((d) => d.kind === "r2_object" && d.ref === `sites/${s.id}/2026/01/a.png`)).toBe(true);
    expect(queued.some((d) => d.kind === "vercel_domain" && d.ref === `purge-${tag}.example.com`)).toBe(true);
    for (const d of queued) await deleteDeletionRow(d.id);
  });
});

describe("billing", () => {
  it("round-trips every billing field and finds what is due", async () => {
    const s = await createSite({ slug: `bill-${tag}`, name: "Bill", category: "gypsum", templateCode: "101" });
    expect(s.plan).toBe("basic");
    expect(s.priceFils).toBe(0);
    expect(s.billingCycle).toBe("yearly");
    expect(s.paidUntil).toBeNull();
    expect(s.lastInvoiceRef).toBeNull();

    const upd = await updateSiteBilling(s.id, { plan: "pro", priceFils: 149_500, billingCycle: "monthly", paidUntil: "2027-03-01", lastInvoiceRef: "INV-1" });
    expect(upd?.plan).toBe("pro");
    expect(upd?.priceFils).toBe(149_500);
    expect(upd?.billingCycle).toBe("monthly");
    expect(upd?.paidUntil, "a date column must survive as a calendar day, not a shifted timestamp").toBe("2027-03-01");
    expect(upd?.lastInvoiceRef).toBe("INV-1");
    // Re-read, not just the RETURNING row.
    expect((await getSiteById(s.id))?.paidUntil).toBe("2027-03-01");

    // Absent fields keep their value; an explicit null clears.
    const partial = await updateSiteBilling(s.id, { priceFils: 1000 });
    expect(partial?.paidUntil).toBe("2027-03-01");
    expect(partial?.lastInvoiceRef).toBe("INV-1");
    expect((await updateSiteBilling(s.id, { lastInvoiceRef: null }))?.lastInvoiceRef).toBeNull();

    // Money is fils: an integer, never a float.
    await expect(updateSiteBilling(s.id, { priceFils: 1.5 })).rejects.toThrow("invalid_price_fils");
    await expect(updateSiteBilling(s.id, { paidUntil: "01/03/2027" })).rejects.toThrow("invalid_paid_until");

    await q(`update sites set paid_until = current_date - 1 where id = $1`, [s.id]);
    expect((await listSitesDueForPause()).map((x) => x.id)).toContain(s.id);
    expect((await listSitesExpiringWithin(7)).map((x) => x.id), "already lapsed is not 'expiring soon'").not.toContain(s.id);

    await q(`update sites set paid_until = current_date + 3 where id = $1`, [s.id]);
    expect((await listSitesDueForPause()).map((x) => x.id)).not.toContain(s.id);
    expect((await listSitesExpiringWithin(7)).map((x) => x.id)).toContain(s.id);
    expect((await listSitesExpiringWithin(1)).map((x) => x.id)).not.toContain(s.id);

    // A paused site is nobody's problem, and a deleted one even less so.
    await updateSite(s.id, { status: "paused" });
    expect((await listSitesExpiringWithin(7)).map((x) => x.id)).not.toContain(s.id);
    await hardDeleteSite(s.id);
  });
});

describe("listSites / listUsers paging", () => {
  it("pages, counts and never ships the content blob", async () => {
    const before = await countSites();
    const made = [] as string[];
    for (let i = 0; i < 3; i++) {
      const s = await createSite({ slug: `page-${tag}-${i}`, name: `Page ${i}`, category: "gypsum", templateCode: "101" });
      made.push(s.id);
    }
    expect(await countSites()).toBe(before + 3);

    const first = await listSites({ limit: 2, offset: 0 });
    expect(first.length).toBe(2);
    // Newest first, so the last two created come back first.
    expect(first.map((s) => s.id)).toEqual([made[2], made[1]]);
    expect(Object.keys(first[0]), "the list must not carry the content blob").not.toContain("content");
    expect(first[0].visitorCount).toBe(0);
    expect(first[0].plan).toBe("basic");

    const second = await listSites({ limit: 2, offset: 2 });
    expect(second.map((s) => s.id)).not.toContain(made[2]);
    // A hostile query string cannot turn the pager into a full scan or invalid SQL.
    expect((await listSites({ limit: 1e21, offset: -5 })).length).toBeLessThanOrEqual(200);

    const softly = made[0];
    await softDeleteSite(softly);
    expect(await countSites()).toBe(before + 2);
    expect((await listSites({ limit: 200 })).some((s) => s.id === softly)).toBe(false);
    expect((await listSites({ limit: 200, includeDeleted: true })).some((s) => s.id === softly)).toBe(true);
    for (const id of made) await hardDeleteSite(id);
  });

  it("pages users and never returns the password hash", async () => {
    const before = await countUsers();
    await createUser({ email: `page-a-${tag}@example.com`, password: "Password1!" });
    await createUser({ email: `page-b-${tag}@example.com`, password: "Password1!" });
    expect(await countUsers()).toBe(before + 2);
    const page = await listUsers({ limit: 1 });
    expect(page.length).toBe(1);
    expect(Object.keys(page[0])).not.toContain("passwordHash");
    expect(Object.keys(page[0])).not.toContain("password_hash");
  });
});

describe("project slugs", () => {
  it("transliterates, sanitises and never produces an empty segment", () => {
    expect(normalizeProjectSlug("Majlis  Salmiya!")).toBe("majlis-salmiya");
    expect(normalizeProjectSlug("--Café/Décor--")).toBe("cafe-decor");
    expect(normalizeProjectSlug("مجلس السالمية")).toBe("mjls-alsalmya");
    expect(normalizeProjectSlug("١٢٣")).toBe("123");
    expect(normalizeProjectSlug("؟؟؟")).toBe("");
    expect(projectSlugFrom({ ar: "؟", en: "" })).toBe("project");
    expect(projectSlugFrom({ ar: "مجلس", en: "Majlis" }, { ar: "السالمية", en: "Salmiya" })).toBe("majlis-salmiya");
  });

  it("generates one per project, dedupes within the site and allows the same slug in another site", async () => {
    const a = await createProject({ siteId, type: "finished", title: { ar: "مجلس", en: "Majlis" }, location: { ar: "السالمية", en: "Salmiya" } });
    const b = await createProject({ siteId, type: "finished", title: { ar: "مجلس", en: "Majlis" }, location: { ar: "السالمية", en: "Salmiya" } });
    const c = await createProject({ siteId, type: "finished", title: { ar: "مجلس", en: "Majlis" }, location: { ar: "السالمية", en: "Salmiya" } });
    expect(a.slug).toBe("majlis-salmiya");
    expect(b.slug).toBe("majlis-salmiya-2");
    expect(c.slug).toBe("majlis-salmiya-3");

    // Unique per site, not globally: two tenants may both have `majlis-salmiya`.
    const other = await createSite({ slug: `other-${tag}`, name: "Other", category: "gypsum", templateCode: "101" });
    const d = await createProject({ siteId: other.id, type: "finished", title: { ar: "مجلس", en: "Majlis" }, location: { ar: "السالمية", en: "Salmiya" } });
    expect(d.slug).toBe("majlis-salmiya");

    // An author-typed slug is normalised, validated and deduped.
    const e = await createProject({ siteId, type: "finished", title: { ar: "أ", en: "E" }, slug: "My Custom Slug" });
    expect(e.slug).toBe("my-custom-slug");
    await expect(createProject({ siteId, type: "finished", title: { ar: "و", en: "F" }, slug: "؟؟؟" })).rejects.toThrow("invalid_slug");

    await updateProject(e.id, { slug: "renamed" });
    expect((await getProject(e.id))?.slug).toBe("renamed");
    // Renaming to a taken slug gets a suffix rather than a 500 from the unique index.
    await updateProject(e.id, { slug: "majlis-salmiya" });
    expect((await getProject(e.id))?.slug).toBe("majlis-salmiya-4");
    // Re-saving a project with its own slug must not bump it.
    await updateProject(a.id, { slug: "majlis-salmiya" });
    expect((await getProject(a.id))?.slug).toBe("majlis-salmiya");

    // Lookup is scoped to the site, and only published projects are public.
    expect((await getProjectBySlug(siteId, "majlis-salmiya"))?.id).toBe(a.id);
    expect((await getProjectBySlug(other.id, "majlis-salmiya"))?.id).toBe(d.id);
    expect(await getProjectBySlug(siteId, "nope")).toBeNull();
    await updateProject(a.id, { published: false });
    expect(await getProjectBySlug(siteId, "majlis-salmiya")).toBeNull();
    expect((await getProjectBySlug(siteId, "majlis-salmiya", { publishedOnly: false }))?.id).toBe(a.id);
    expect((await listPublishedProjects(siteId)).some((p) => p.id === a.id)).toBe(false);
    expect((await listProjects(siteId)).some((p) => p.id === a.id)).toBe(true);
    await hardDeleteSite(other.id);
  });
});

describe("media alt text", () => {
  it("round-trips alt in both directions", async () => {
    const p = await createProject({ siteId, type: "progress", title: { ar: "ألف", en: "Alt" } });
    const m = await addMedia({ projectId: p.id, kind: "image", url: "https://x/a.jpg", alt: { ar: "صورة", en: "Photo" } });
    expect(m.alt?.en).toBe("Photo");
    expect((await getProject(p.id))?.media[0].alt?.ar).toBe("صورة");
    // listProjects builds the media json server-side; alt has to survive that path too.
    expect((await listProjects(siteId, { type: "progress" })).find((x) => x.id === p.id)?.media[0].alt?.en).toBe("Photo");
    await updateMedia(m.id, { alt: { ar: "جديد", en: "New" } });
    expect((await getProject(p.id))?.media[0].alt?.en).toBe("New");
    await updateMedia(m.id, { caption: { ar: "ت", en: "C" } });
    expect((await getProject(p.id))?.media[0].alt?.en, "an absent alt keeps its value").toBe("New");
    await updateMedia(m.id, { alt: null });
    expect((await getProject(p.id))?.media[0].alt).toBeNull();
  });
});

describe("visitor secret", () => {
  it("issues one on creation and requires it for a public lookup", async () => {
    const { visitor, created, secret } = await trackVisit({ siteId, code: null, landingUrl: "https://x/?fbclid=A" });
    expect(created).toBe(true);
    expect(secret).toMatch(/^[0-9a-f]{32}$/);
    expect((visitor as unknown as Record<string, unknown>).secret, "the secret must never ride along on a Visitor").toBeUndefined();

    expect((await getVisitorByCodeAndSecret(siteId, visitor.code, secret))?.id).toBe(visitor.id);
    expect(await getVisitorByCodeAndSecret(siteId, visitor.code, "0".repeat(32))).toBeNull();
    expect(await getVisitorByCodeAndSecret(siteId, visitor.code, null)).toBeNull();
    expect(await getVisitorByCodeAndSecret(siteId, visitor.code, `${secret}x`), "a length mismatch is a miss, not a throw").toBeNull();

    // A returning visit hands the same secret back so the cookie can be refreshed.
    const again = await trackVisit({ siteId, code: visitor.code });
    expect(again.created).toBe(false);
    expect(again.secret).toBe(secret);

    // A row from before 0005 has no secret, and cannot be authenticated until it gets one.
    await q(`update visitors set secret = null where id = $1`, [visitor.id]);
    expect(await getVisitorByCodeAndSecret(siteId, visitor.code, secret)).toBeNull();
    const backfilled = await trackVisit({ siteId, code: visitor.code });
    expect(backfilled.secret).toMatch(/^[0-9a-f]{32}$/);
    expect((await getVisitorByCodeAndSecret(siteId, visitor.code, backfilled.secret))?.id).toBe(visitor.id);
  });

  it("stores the secret the proxy already put in the cookie, for a trusted caller only", async () => {
    // The proxy mints code+secret together and sets both cookies before the render. If the row got a
    // different secret, the browser's very first /api/track call would fail its own check and be answered
    // with a second visitor row.
    const fromProxy = "a".repeat(32);
    const made = await trackVisit({ siteId, code: "100002", secret: fromProxy, fresh: true });
    expect(made.secret).toBe(fromProxy);
    expect((await getVisitorByCodeAndSecret(siteId, made.visitor.code, fromProxy))?.id).toBe(made.visitor.id);

    // A public caller may present a secret but never choose one.
    const publicCaller = await trackVisit({ siteId, code: null, secret: "b".repeat(32), requireSecret: true });
    expect(publicCaller.secret).not.toBe("b".repeat(32));
    // Junk is ignored rather than stored.
    const junk = await trackVisit({ siteId, code: null, secret: "not-a-secret" });
    expect(junk.secret).toMatch(/^[0-9a-f]{32}$/);
  });

  it("refuses to mint or merge at a caller-chosen code when the caller must prove itself", async () => {
    const mine = await trackVisit({ siteId, code: null });
    const before = mine.visitor.visits;

    // The hole this closes: POST a guessed code and either create a row at it, or get your IP, user agent
    // and attribution merged into a stranger's row.
    const guessed = await trackVisit({ siteId, code: mine.visitor.code, secret: "deadbeef".repeat(4), requireSecret: true, ip: "6.6.6.6" });
    expect(guessed.created).toBe(true);
    expect(guessed.visitor.code).not.toBe(mine.visitor.code);
    expect((await getVisitorByCode(siteId, mine.visitor.code))?.visits).toBe(before);
    expect((await getVisitorByCode(siteId, mine.visitor.code))?.ip).not.toBe("6.6.6.6");

    // A code nobody holds cannot be claimed either: the row lands on a fresh code.
    const minted = await trackVisit({ siteId, code: "100001", requireSecret: true });
    expect(minted.visitor.code).not.toBe("100001");
    expect(await getVisitorByCode(siteId, "100001")).toBeNull();

    // With the right secret the same call is an ordinary returning visit.
    const ok = await trackVisit({ siteId, code: mine.visitor.code, secret: mine.secret, requireSecret: true });
    expect(ok.created).toBe(false);
    expect(ok.visitor.id).toBe(mine.visitor.id);
    expect(ok.visitor.visits).toBe(before + 1);
  });
});

describe("deletion queue", () => {
  it("enqueues, lists, records failures and clears", async () => {
    const row = (await enqueueDeletion("r2_object", `sites/${tag}/x.png`))!;
    expect(row.attempts).toBe(0);
    expect((await listPendingDeletions(100)).some((d) => d.id === row.id)).toBe(true);

    await markDeletionFailed(row.id, new Error("R2 said no"));
    const after = (await listPendingDeletions(100)).find((d) => d.id === row.id)!;
    expect(after.attempts).toBe(1);
    expect(after.lastError).toBe("R2 said no");

    // A row that has exhausted its attempts stops being handed out, but is not silently dropped.
    await q(`update deletion_queue set attempts = 99 where id = $1`, [row.id]);
    expect((await listPendingDeletions(100, 10)).some((d) => d.id === row.id)).toBe(false);
    expect((await deletionQueueStats(10)).failing).toBeGreaterThanOrEqual(1);

    await expect(enqueueDeletion("nonsense" as "user", "x")).rejects.toThrow("invalid_deletion_kind");
    await deleteDeletionRow(row.id);
    expect((await listPendingDeletions(100, 1000)).some((d) => d.id === row.id)).toBe(false);
  });
});

describe("retention", () => {
  it("prunes login attempts and expired sessions, and anonymises stale visitors", async () => {
    await q(`insert into login_attempts (key, failures, first_failure_at, last_failure_at) values ($1, 3, now() - interval '400 days', now() - interval '400 days')`, [
      `ip:scanner-${tag}`,
    ]);
    await q(`insert into login_attempts (key, failures, first_failure_at, last_failure_at) values ($1, 1, now(), now())`, [`ip:today-${tag}`]);
    expect(await pruneLoginAttempts(30)).toBeGreaterThanOrEqual(1);
    const keys = (await q<{ key: string }>(`select key from login_attempts`)).map((r) => r.key);
    expect(keys).not.toContain(`ip:scanner-${tag}`);
    expect(keys, "a live throttling window must survive the prune").toContain(`ip:today-${tag}`);

    const u = await createUser({ email: `retain-${tag}@example.com`, password: "Password1!" });
    const { token } = await createSession(u.id);
    await q(`update sessions set expires_at = now() - interval '1 day' where user_id = $1`, [u.id]);
    expect(await pruneExpiredSessions()).toBeGreaterThanOrEqual(1);
    expect((await q(`select id from sessions where user_id = $1`, [u.id])).length).toBe(0);
    expect(token.length).toBeGreaterThan(0);

    const old = await trackVisit({ siteId, code: null, ip: "1.2.3.4", userAgent: "UA", referrer: "https://r/", landingUrl: "https://l/" });
    await q(`update visitors set last_seen_at = now() - interval '30 months' where id = $1`, [old.visitor.id]);
    expect(await anonymiseOldVisitors(18)).toBeGreaterThanOrEqual(1);
    const scrubbed = (await getVisitorByCode(siteId, old.visitor.code))!;
    expect(scrubbed.ip).toBeNull();
    expect(scrubbed.userAgent).toBeNull();
    expect(scrubbed.referrer).toBeNull();
    expect(scrubbed.landingUrl).toBeNull();
    expect(scrubbed.code, "the funnel record survives; only the personal half goes").toBe(old.visitor.code);

    // A bounce that nobody ever touched is deleted outright; a lead is kept whatever its age.
    const lead = await trackVisit({ siteId, code: null });
    await q(`update visitors set last_seen_at = now() - interval '40 months', stage = 'ordered' where id = $1`, [lead.visitor.id]);
    expect(await deleteStaleNewVisitors(24)).toBeGreaterThanOrEqual(1);
    expect(await getVisitorByCode(siteId, old.visitor.code)).toBeNull();
    expect((await getVisitorByCode(siteId, lead.visitor.code))?.id).toBe(lead.visitor.id);
  });
});
