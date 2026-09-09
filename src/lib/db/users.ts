import { q, one, iso, isoOrNull } from "./client";
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

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export async function getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const r = await one<UserRow>(`select * from users where email = $1`, [normalizeEmail(email)]);
  if (!r) return null;
  return { ...mapUser(r), passwordHash: r.password_hash || "" };
}

export async function getUserById(id: string): Promise<User | null> {
  const r = await one<UserRow>(`select * from users where id = $1`, [id]);
  return r ? mapUser(r) : null;
}

export async function listUsers(): Promise<User[]> {
  const rows = await q<UserRow>(`select * from users order by created_at desc`);
  return rows.map(mapUser);
}

export async function createUser(input: { email: string; password: string; name?: string; isSuper?: boolean }): Promise<User> {
  const email = normalizeEmail(input.email);
  const isSuper = input.isSuper ?? superAdminEmails().includes(email);
  const r = await one<UserRow>(
    `insert into users (email, password_hash, name, is_super) values ($1, $2, $3, $4) returning *`,
    [email, hashPassword(input.password), input.name ?? null, isSuper],
  );
  return mapUser(r!);
}

export async function upsertSuperAdmin(email: string, password: string, name?: string): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) {
    const r = await one<UserRow>(`update users set is_super = true, password_hash = $2, name = coalesce($3, name) where id = $1 returning *`, [
      existing.id,
      hashPassword(password),
      name ?? null,
    ]);
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

export async function authenticate(email: string, password: string): Promise<User | null> {
  const u = await getUserByEmail(email);
  if (!u) return null;
  if (!verifyPassword(password, u.passwordHash)) return null;
  await q(`update users set last_login_at = now() where id = $1`, [u.id]);
  const { passwordHash: _ph, ...user } = u;
  void _ph;
  return user;
}

/** Creates a session and returns the raw token to put in the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await q(`insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)`, [userId, sha256Hex(token), expiresAt.toISOString()]);
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string | undefined | null): Promise<User | null> {
  if (!token || token.length < 32) return null;
  const r = await one<UserRow>(
    `select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()`,
    [sha256Hex(token)],
  );
  return r ? mapUser(r) : null;
}

export async function deleteSession(token: string | undefined | null) {
  if (!token) return;
  await q(`delete from sessions where token_hash = $1`, [sha256Hex(token)]);
}
