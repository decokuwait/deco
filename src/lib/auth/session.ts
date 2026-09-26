import { cookies, headers } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/config";
import { authenticate, createSession, deleteSession, getUserBySessionToken, type User } from "@/lib/db/users";
import { isSiteMember } from "@/lib/db/members";
import { q } from "@/lib/db/client";
import { sha256Hex } from "@/lib/auth/password";
import { clientIp } from "@/lib/site-request";

/**
 * Session cookie name.
 *
 * `__Host-` is a browser-enforced promise about the cookie: it must be `Secure`, it must be `Path=/`, and
 * it must carry no `Domain` attribute. The last one is what matters on a platform like this. Without the
 * prefix a page on any `*.decokuwait.com` — including a tenant site whose content its own owner writes —
 * can set a `Domain=.decokuwait.com` session cookie that the browser then sends to the platform and to
 * every other tenant, and neither the server nor the panel can tell it apart from the real one. With the
 * prefix the browser refuses to store such a cookie under this name at all.
 *
 * The order here is load-bearing: `Secure` must be set unconditionally, because a `__Host-` cookie without
 * it is silently dropped. That is safe in development too — browsers treat `http://localhost` (and hosts
 * under `.localhost`) as trustworthy origins and accept `Secure` cookies from them.
 */
export const SESSION_COOKIE_NAME = `__Host-${SESSION_COOKIE}`;

/**
 * The previous, unprefixed name. Still read so sessions created before this change survive the deploy,
 * still cleared on sign-out. Delete both this constant and its two uses after one rotation
 * (SESSION_MAX_AGE is 30 days, so any time after that is safe).
 */
const LEGACY_SESSION_COOKIE = SESSION_COOKIE;

/**
 * A session is dead after this long without being used, independently of the 30-day absolute expiry.
 * A token copied off a shared or stolen machine was otherwise good for a month of silence.
 */
const IDLE_TIMEOUT_DAYS = 7;

/**
 * Enforces the idle timeout and refreshes `last_used_at` in the same statement, so there is no window
 * between the check and the refresh. Returns false when the row is gone or has been idle too long.
 *
 * This is the one hand-written `sessions` query outside the db layer; it is worth folding
 * into `getUserBySessionToken`, at which point this can go.
 */
async function touchSession(tokenHash: string): Promise<boolean> {
  const rows = await q<{ id: string }>(
    `update sessions set last_used_at = now()
     where token_hash = $1 and expires_at > now() and coalesce(last_used_at, created_at) > now() - interval '${IDLE_TIMEOUT_DAYS} days'
     returning id`,
    [tokenHash],
  );
  return rows.length > 0;
}

/** Reads the session cookie, preferring the `__Host-` name and falling back to the pre-rotation one. */
async function sessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? store.get(LEGACY_SESSION_COOKIE)?.value;
}

/**
 * The signed-in user, or null.
 *
 * Cached per request: the admin layout, the page and each guard all ask for it, and without this that is
 * three database round trips (now three *writes*, because of the idle-timeout refresh) for one render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const user = await getUserBySessionToken(token);
  if (!user) return null;
  if (!(await touchSession(sha256Hex(token)))) {
    // Idle too long. Drop the row so the token cannot be revived by a later request.
    await deleteSession(token).catch(() => undefined);
    return null;
  }
  return user;
});

/** Signs in with email/password. Throws TooManyAttemptsError when the email or client IP is throttled. */
export async function signInWithPassword(email: string, password: string): Promise<User | null> {
  const h = await headers();
  // Not the first X-Forwarded-For entry: that one is whatever the caller typed, which let an attacker
  // pick a fresh "IP" for every guess and sidestep the per-IP lockout entirely.
  const ip = clientIp(h);
  const user = await authenticate(email, password, ip);
  if (!user) return null;
  const { token, expiresAt } = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Unconditional, and set before the name is used: `__Host-` requires it, and a browser drops the
    // cookie without a word when it is missing.
    secure: true,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
  });
  // Retire any pre-rotation cookie in the same response, or the browser keeps sending both.
  store.set(LEGACY_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return user;
}

export async function signOut() {
  const store = await cookies();
  const token = await sessionToken();
  await deleteSession(token);
  store.set(SESSION_COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  store.set(LEGACY_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export interface SiteAccess {
  user: User;
  isSuper: boolean;
}

/** Returns the user if they may administer the given site (super admin or member), else null. */
export async function getSiteAccess(siteId: string): Promise<SiteAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isSuper) return { user, isSuper: true };
  const member = await isSiteMember(siteId, user.id);
  return member ? { user, isSuper: false } : null;
}

export async function getSuperAccess(): Promise<User | null> {
  const user = await getCurrentUser();
  return user && user.isSuper ? user : null;
}
