import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, IS_PROD } from "@/lib/config";
import { authenticate, createSession, deleteSession, getUserBySessionToken, type User } from "@/lib/db/users";
import { isSiteMember } from "@/lib/db/members";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
}

export async function signInWithPassword(email: string, password: string): Promise<User | null> {
  const user = await authenticate(email, password);
  if (!user) return null;
  const { token, expiresAt } = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE,
  });
  return user;
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  await deleteSession(token);
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
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
