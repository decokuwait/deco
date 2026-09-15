import { afterAll, describe, expect, it } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";

import { classifyDbError, getDb, pendingMigrations, q, resetDb, runMigrations } from "@/lib/db/client";

const withCode = (message: string, code: string) => Object.assign(new Error(message), { code });

afterAll(async () => {
  await resetDb();
});

describe("classifyDbError", () => {
  it("maps SQLSTATE, Node network codes and our own config error to an operator-facing category", () => {
    expect(classifyDbError(withCode("relation \"users\" does not exist", "42P01"))).toBe("schema");
    expect(classifyDbError(withCode("column x does not exist", "42703"))).toBe("schema");
    expect(classifyDbError(withCode("password authentication failed", "28P01"))).toBe("auth");
    expect(classifyDbError(withCode("database \"nope\" does not exist", "3D000"))).toBe("auth");
    expect(classifyDbError(withCode("connect ECONNREFUSED", "ECONNREFUSED"))).toBe("unreachable");
    expect(classifyDbError(withCode("connect ENETUNREACH", "ENETUNREACH"))).toBe("unreachable"); // IPv6-only direct host from Vercel
    expect(classifyDbError(withCode("getaddrinfo ENOTFOUND", "ENOTFOUND"))).toBe("unreachable");
    expect(classifyDbError(withCode("write CONNECT_TIMEOUT", "CONNECT_TIMEOUT"))).toBe("unreachable");
    expect(classifyDbError(Object.assign(new TypeError("Invalid URL"), { code: "ERR_INVALID_URL" }))).toBe("config");
    expect(classifyDbError(withCode("DATABASE_URL is not set", "DB_NOT_CONFIGURED"))).toBe("config");
  });
  it("falls back to the message when a driver reports no code", () => {
    expect(classifyDbError(new Error("Tenant or user not found"))).toBe("auth"); // Supabase pooler, wrong user/project ref
    expect(classifyDbError(new Error("FATAL: password authentication failed for user"))).toBe("auth");
    expect(classifyDbError(new Error("relation \"login_attempts\" does not exist"))).toBe("schema");
    expect(classifyDbError(new Error("Connection terminated due to connection timeout"))).toBe("unreachable");
  });
  it("leaves application errors alone", () => {
    expect(classifyDbError(withCode("duplicate key value", "23505"))).toBeNull();
    expect(classifyDbError(new Error("boom"))).toBeNull();
    expect(classifyDbError("boom")).toBeNull();
    expect(classifyDbError(undefined)).toBeNull();
  });
  it("recognises a real missing-table error from the database", async () => {
    await getDb();
    const err: unknown = await q(`select * from table_that_does_not_exist`).catch((e) => e);
    expect(classifyDbError(err)).toBe("schema");
  });
  it("refuses the embedded database on Vercel with a config error", async () => {
    await resetDb();
    const prev = { url: process.env.DATABASE_URL, vercel: process.env.VERCEL };
    process.env.DATABASE_URL = "";
    process.env.VERCEL = "1";
    try {
      const err: unknown = await getDb().catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(classifyDbError(err)).toBe("config");
    } finally {
      process.env.DATABASE_URL = prev.url;
      if (prev.vercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prev.vercel;
    }
  });
});

describe("pendingMigrations", () => {
  it("reports nothing pending once the migrations ran", async () => {
    const db = await getDb();
    expect(await pendingMigrations(db)).toEqual([]);
  });
  // Runs on a real Postgres too: applying the files is the step that differs between the backends, because
  // postgres.js rejects a BEGIN it did not issue itself. Migrations are idempotent, so a repeat is harmless.
  it("lists every file when the bookkeeping table is missing, and runMigrations settles it", async () => {
    const db = await getDb();
    await db.exec(`drop table _migrations`);
    const pending = await pendingMigrations(db);
    expect(pending.length).toBeGreaterThanOrEqual(3);
    expect(pending[0]).toBe("0001_init.sql");
    expect(await runMigrations(db)).toEqual(pending);
    expect(await pendingMigrations(db)).toEqual([]);
  });
});
