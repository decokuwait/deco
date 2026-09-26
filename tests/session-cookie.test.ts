import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// PGlite in memory by default; a real Postgres (CI service, local Supabase) when TEST_DATABASE_URL is set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
if (!process.env.TEST_DATABASE_URL) process.env.PGLITE_MEMORY = "1";

interface SetCookie {
  name: string;
  value: string;
  opts: Record<string, unknown>;
}

const jar = new Map<string, string>();
const written: SetCookie[] = [];
let requestHeaders = new Headers();

// `next/headers` only resolves inside a request; the store is stubbed so the cookie attributes the
// session module chooses can be asserted directly.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts: Record<string, unknown> = {}) => {
      written.push({ name, value, opts });
      if (opts.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
  }),
  headers: async () => requestHeaders,
}));

import { getCurrentUser, signInWithPassword, signOut, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getDb, resetDb } from "@/lib/db/client";
import { createUser } from "@/lib/db/users";
import { sha256Hex } from "@/lib/auth/password";

function lastWrite(name: string) {
  return [...written].reverse().find((c) => c.name === name);
}

describe("session cookie", () => {
  beforeAll(async () => {
    await getDb();
    await createUser({ email: "owner@example.com", password: "Correct-horse-9", isSuper: false });
    requestHeaders = new Headers({ "x-vercel-forwarded-for": "198.51.100.7" });
  });
  afterAll(async () => {
    await resetDb();
  });

  /**
   * `__Host-` is a browser-enforced promise: Secure, Path=/, and no Domain. Without it a page on any
   * `*.decokuwait.com` can set a `Domain=.decokuwait.com` session cookie that the platform cannot tell
   * apart from the real one. `Secure` therefore has to be unconditional, not `IS_PROD` — a `__Host-`
   * cookie without it is dropped without a word.
   */
  it("is named __Host- and carries every attribute that name requires", async () => {
    written.length = 0;
    jar.clear();
    expect(SESSION_COOKIE_NAME).toBe("__Host-dk_session");
    const user = await signInWithPassword("owner@example.com", "Correct-horse-9");
    expect(user?.email).toBe("owner@example.com");
    const set = lastWrite(SESSION_COOKIE_NAME);
    expect(set).toBeTruthy();
    expect(set!.opts.secure).toBe(true);
    expect(set!.opts.httpOnly).toBe(true);
    expect(set!.opts.path).toBe("/");
    expect(set!.opts.sameSite).toBe("lax");
    expect(set!.opts).not.toHaveProperty("domain");
    // The pre-rotation cookie is retired in the same response, or the browser keeps sending both.
    expect(lastWrite("dk_session")?.opts.maxAge).toBe(0);
  });

  // Sessions issued before the rename have to survive the deploy, so the old name is still read.
  it("still accepts a session presented under the pre-rotation name", async () => {
    written.length = 0;
    jar.clear();
    await signInWithPassword("owner@example.com", "Correct-horse-9");
    const token = lastWrite(SESSION_COOKIE_NAME)!.value;
    jar.clear();
    jar.set("dk_session", token);
    expect((await getCurrentUser())?.email).toBe("owner@example.com");
  });

  /**
   * The absolute 30-day expiry was the only limit, so a token copied off a shared machine stayed valid
   * for a month of silence. `last_used_at` is refreshed on every use and expires the session after a week.
   */
  it("expires a session that has been idle for a week, and refreshes the clock on use", async () => {
    written.length = 0;
    jar.clear();
    const user = await signInWithPassword("owner@example.com", "Correct-horse-9");
    const db = await getDb();
    // Earlier tests in this file signed the same user in; only this session is under test.
    const thisToken = lastWrite(SESSION_COOKIE_NAME)!.value;
    await db.query(`delete from sessions where user_id = $1 and token_hash <> $2`, [user!.id, sha256Hex(thisToken)]);
    const usedAt = async () =>
      (await db.query<{ last_used_at: unknown }>(`select last_used_at from sessions where user_id = $1 order by created_at desc limit 1`, [user!.id]))[0]
        ?.last_used_at;

    await db.query(`update sessions set last_used_at = now() - interval '1 hour' where user_id = $1`, [user!.id]);
    const before = new Date(String(await usedAt())).getTime();
    expect((await getCurrentUser())?.id).toBe(user!.id);
    expect(new Date(String(await usedAt())).getTime()).toBeGreaterThan(before);

    await db.query(`update sessions set last_used_at = now() - interval '8 days' where user_id = $1`, [user!.id]);
    expect(await getCurrentUser()).toBeNull();
    // And the row is gone, so the token cannot be revived by a later request.
    const rows = await db.query(`select id from sessions where user_id = $1`, [user!.id]);
    expect(rows.length).toBe(0);
  });

  it("clears both names on sign-out", async () => {
    written.length = 0;
    jar.clear();
    await signInWithPassword("owner@example.com", "Correct-horse-9");
    written.length = 0;
    await signOut();
    expect(lastWrite(SESSION_COOKIE_NAME)?.opts.maxAge).toBe(0);
    expect(lastWrite(SESSION_COOKIE_NAME)?.opts.secure).toBe(true);
    expect(lastWrite("dk_session")?.opts.maxAge).toBe(0);
  });
});
