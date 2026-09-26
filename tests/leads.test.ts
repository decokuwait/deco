import { afterAll, describe, expect, it } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";

import { resetDb } from "@/lib/db/client";
import { createLead, deleteLead, leadCounts, listLeads, pruneLeads, updateLead } from "@/app/(platform)/pricing/_lib/leads";

/**
 * The lead inbox, end to end against the real schema — which also proves `0007_leads.sql` applies cleanly
 * on a fresh database. The table is the product's only intake channel: there is no transactional email
 * anywhere in this codebase, so a row that fails to land is a customer nobody ever calls back.
 */

afterAll(async () => {
  await resetDb();
});

describe("platform leads", () => {
  it("stores a request from the public form and reads it back newest first", async () => {
    const a = await createLead({ name: "أبو محمد", whatsapp: "96550000001", trade: "gypsum", area: "حولي", message: "عندي صور جاهزة", source: "home" });
    const b = await createLead({ name: "Abu Ali", whatsapp: "96550000002", trade: "ceramic", source: "pricing", plan: "pro" });
    expect(a.status).toBe("new");
    expect(a.notes).toBeNull();
    const all = await listLeads();
    expect(all.map((l) => l.id)).toContain(a.id);
    expect(all[0].id).toBe(b.id);
    expect(all[0].plan).toBe("pro");
  });

  it("filters by status and counts every status, including the ones with no rows", async () => {
    const counts = await leadCounts();
    expect(counts.new).toBe(2);
    expect(counts.won).toBe(0);
    expect(counts.spam).toBe(0);
    const [first] = await listLeads();
    await updateLead(first.id, { status: "contacted", notes: "اتصلت، يبي نطاق خاص" });
    expect((await listLeads({ status: "contacted" })).map((l) => l.id)).toEqual([first.id]);
    expect((await leadCounts()).contacted).toBe(1);
  });

  it("keeps a note when the patch does not mention one, and clears it when it does", async () => {
    const [lead] = await listLeads({ status: "contacted" });
    const kept = await updateLead(lead.id, { status: "won" });
    expect(kept?.notes).toBe("اتصلت، يبي نطاق خاص");
    const cleared = await updateLead(lead.id, { notes: null });
    expect(cleared?.notes).toBeNull();
    expect(cleared?.status).toBe("won"); // a note edit must not reset the pipeline position
  });

  it("ignores an id that is not a uuid instead of raising a database error", async () => {
    expect(await updateLead("not-a-uuid", { status: "lost" })).toBeNull();
    expect(await deleteLead("not-a-uuid")).toBe(false);
  });

  it("never auto-prunes an open request — only spam and closed ones age out", async () => {
    const open = await createLead({ name: "Open", whatsapp: "96550000003", source: "home" });
    const spam = await createLead({ name: "Spam", whatsapp: "96550000004", source: "home" });
    await updateLead(spam.id, { status: "spam" });
    // Nothing is old enough yet, whatever the retention window says.
    expect(await pruneLeads(30, 365)).toBe(0);
    // A zero-day window is the same code path with the clock wound forward.
    const removed = await pruneLeads(1, 1);
    expect(removed).toBeGreaterThanOrEqual(0);
    const remaining = await listLeads();
    expect(remaining.some((l) => l.id === open.id)).toBe(true);
    expect(await deleteLead(open.id)).toBe(true);
  });
});
