import { q, one, iso, isoOrNull, isUuid } from "./client";
import { hashPassword, verifyPassword, randomToken, sha256Hex } from "@/lib/auth/password";
import { SESSION_MAX_AGE } from "@/lib/config";

export interface User {
  id: string;
  email: string;
  name: string | null;
  isSuper: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  is_super: boolean;
  created_at: unknown;
  last_login_at: unknown;
  password_hash?: string;
}

function mapUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    isSuper: !!r.is_super,
    createdAt: iso(r.created_at),
    lastLoginAt: isoOrNull(r.last_login_at),
  };
}

/**
 * Explicit column list, never `select *`.
 *
 * `password_hash` is *not* in it. Only `getUserByEmail` asks for the hash, because only authentication can
 * use it. `getUserBySessionToken` runs on every authenticated request and used to select `u.*`, so the
 * scrypt hash of the logged-in operator sat in the function heap for the life of every request — one heap
 * snapshot, one over-eager log of a row, one future `JSON.stringify(user)` and it is out.
 */
const USER_COLS = ["id", "email", "name", "is_super", "created_at", "last_login_at"];
function userCols(alias = "u") {
  return USER_COLS.map((c) => `${alias}.${c}`).join(", ");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

/** The one read that includes the password hash, because verifying a password is the one thing that needs it. */
export async function getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const r = await one<UserRow>(`select ${userCols("u")}, u.password_hash from users u where u.email = $1`, [normalizeEmail(email)]);
  if (!r) return null;
  return { ...mapUser(r), passwordHash: r.password_hash || "" };
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const r = await one<UserRow>(`select ${userCols("u")} from users u where u.id = $1`, [id]);
  return r ? mapUser(r) : null;
}

export interface UserListOptions {
  limit?: number;
  offset?: number;
}

export const USERS_PAGE_SIZE = 50;

/** Clamps a page size/offset that came from a query string to a safe integer (NaN and 1e20 included). */
function clampInt(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** One page of accounts, newest first. Paginated for the same reason as listSites: it had no LIMIT at all. */
export async function listUsers(opts: UserListOptions = {}): Promise<User[]> {
  const limit = clampInt(opts.limit, USERS_PAGE_SIZE, 1, 200);
  const offset = clampInt(opts.offset, 0, 0, 1_000_000);
  const rows = await q<UserRow>(`select ${userCols("u")} from users u order by u.created_at desc limit $1 offset $2`, [limit, offset]);
  return rows.map(mapUser);
}

/** Total for the users pager. */
export async function countUsers(): Promise<number> {
  const r = await one<{ n: unknown }>(`select count(*) as n from users`);
  return Number(r?.n ?? 0);
}

/** Whether any account exists. Used by the first-login bootstrap, which ran on every super login. */
export async function hasAnyUser(): Promise<boolean> {
  return !!(await one(`select 1 as ok from users limit 1`));
}

export async function createUser(input: { email: string; password: string; name?: string; isSuper?: boolean }): Promise<User> {
  const email = normalizeEmail(input.email);
  const isSuper = input.isSuper ?? superAdminEmails().includes(email);
  const r = await one<UserRow>(
    `insert into users (email, password_hash, name, is_super) values ($1, $2, $3, $4) returning ${userCols("users")}`,
    [email, hashPassword(input.password), input.name ?? null, isSuper],
  );
  return mapUser(r!);
}

export async function upsertSuperAdmin(email: string, password: string, name?: string): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) {
    const r = await one<UserRow>(
      `update users set is_super = true, password_hash = $2, name = coalesce($3, name) where id = $1 returning ${userCols("users")}`,
      [existing.id, hashPassword(password), name ?? null],
    );
    return mapUser(r!);
  }
  return createUser({ email, password, name, isSuper: true });
}

export async function setPassword(userId: string, password: string) {
  await q(`update users set password_hash = $2 where id = $1`, [userId, hashPassword(password)]);
  await q(`delete from sessions where user_id = $1`, [userId]);
}

export async function setSuper(userId: string, isSuper: boolean) {
  await q(`update users set is_super = $2 where id = $1`, [userId, isSuper]);
}

export async function deleteUser(userId: string) {
  await q(`delete from users where id = $1`, [userId]);
}

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MIN = 15;
// Constant-time-ish fallback so a missing account costs the same as a wrong password.
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export class TooManyAttemptsError extends Error {
  constructor() {
    super("too_many_attempts");
    this.name = "TooManyAttemptsError";
  }
}

async function attemptsFor(key: string): Promise<number> {
  const r = await one<{ failures: number; first_failure_at: unknown }>(`select failures, first_failure_at from login_attempts where key = $1`, [key]);
  if (!r) return 0;
  const first = new Date(iso(r.first_failure_at)).getTime();
  if (Date.now() - first > FAILURE_WINDOW_MIN * 60 * 1000) return 0;
  return Number(r.failures);
}

async function recordFailure(key: string) {
  await q(
    `insert into login_attempts (key, failures, first_failure_at, last_failure_at) values ($1, 1, now(), now())
     on conflict (key) do update set
       failures = case when login_attempts.first_failure_at < now() - interval '${FAILURE_WINDOW_MIN} minutes' then 1 else login_attempts.failures + 1 end,
       first_failure_at = case when login_attempts.first_failure_at < now() - interval '${FAILURE_WINDOW_MIN} minutes' then now() else login_attempts.first_failure_at end,
       last_failure_at = now()`,
    [key],
  );
}

async function clearFailures(keys: string[]) {
  await q(`delete from login_attempts where key = any($1::text[])`, [keys]);
}

/**
 * Verifies credentials. Throws TooManyAttemptsError after MAX_FAILURES failed attempts within
 * FAILURE_WINDOW_MIN minutes for the same email or the same client IP.
 */
export async function authenticate(email: string, password: string, ip?: string | null): Promise<User | null> {
  const keys = [`email:${normalizeEmail(email)}`, ...(ip ? [`ip:${ip}`] : [])];
  for (const k of keys) if ((await attemptsFor(k)) >= MAX_FAILURES) throw new TooManyAttemptsError();
  const u = await getUserByEmail(email);
  const ok = u ? verifyPassword(password, u.passwordHash) : (verifyPassword(password, DUMMY_HASH), false);
  if (!u || !ok) {
    for (const k of keys) await recordFailure(k);
    return null;
  }
  await clearFailures(keys);
  await q(`update users set last_login_at = now() where id = $1`, [u.id]);
  const { passwordHash: _ph, ...user } = u;
  void _ph;
  return user;
}

/** Creates a session and returns the raw token to put in the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  // Opportunistic housekeeping so the sessions table cannot grow without bound.
  await q(`delete from sessions where expires_at < now() - interval '1 day'`).catch(() => undefined);
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await q(`insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)`, [userId, sha256Hex(token), expiresAt.toISOString()]);
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string | undefined | null): Promise<User | null> {
  if (!token || token.length < 32) return null;
  // Explicit columns: this runs on EVERY authenticated request, and `u.*` put the operator's scrypt
  // password hash into the function heap on all of them for no reason at all.
  const r = await one<UserRow>(
    `select ${userCols("u")} from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()`,
    [sha256Hex(token)],
  );
  return r ? mapUser(r) : null;
}

export async function deleteSession(token: string | undefined | null) {
  if (!token) return;
  await q(`delete from sessions where token_hash = $1`, [sha256Hex(token)]);
}

/**
 * Retention, for the cron.
 *
 * `login_attempts` was never cleaned: `clearFailures` only runs after a *successful* login, so every
 * credential-stuffing scanner that guessed at an address nobody owns left a row behind for ever, keyed by
 * that address or by its IP. The rows are also personal data (an email, an IP) with no purpose once the
 * 15-minute throttling window has passed, so they go on a schedule rather than on a lucky login.
 */
export async function pruneLoginAttempts(olderThanDays = 30): Promise<number> {
  const days = Math.min(Math.max(Math.trunc(Number(olderThanDays)) || 30, 0), 3650);
  const rows = await q<{ key: string }>(`delete from login_attempts where last_failure_at < now() - ($1::int * interval '1 day') returning key`, [days]);
  return rows.length;
}

/** Expired sessions. `createSession` already sweeps opportunistically, but only when somebody logs in. */
export async function pruneExpiredSessions(): Promise<number> {
  const rows = await q<{ id: string }>(`delete from sessions where expires_at < now() returning id`);
  return rows.length;
}
