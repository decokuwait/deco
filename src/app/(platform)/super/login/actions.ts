"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, signOut } from "@/lib/auth/session";
import { listUsers, superAdminEmails, upsertSuperAdmin, normalizeEmail } from "@/lib/db/users";
import { readStr } from "@/components/admin/ui";
import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Super admin login. Bootstrap: when no user exists yet, the email is listed in SUPER_ADMIN_EMAILS and
 * the submitted password equals SUPER_ADMIN_PASSWORD, the owner account is created.
 */
export async function superLogin(fd: FormData) {
  const email = normalizeEmail(readStr(fd, "email", 200));
  const password = String(fd.get("password") ?? "");
  if (!email || !password) redirect("/super/login?error=invalid");

  const users = await listUsers();
  if (users.length === 0 && superAdminEmails().includes(email) && password.length >= 8) {
    // Bootstrap requires the password configured in the environment: an empty database must never be
    // claimable by a stranger who only knows the owner's email address.
    const expected = process.env.SUPER_ADMIN_PASSWORD?.trim() || "";
    if (!expected) console.error("super admin bootstrap refused: SUPER_ADMIN_PASSWORD is not set");
    else if (safeEqual(expected, password)) await upsertSuperAdmin(email, password, "Owner");
  }
  let user: Awaited<ReturnType<typeof signInWithPassword>> = null;
  try {
    user = await signInWithPassword(email, password);
  } catch (e) {
    if (e instanceof Error && e.name === "TooManyAttemptsError") redirect("/super/login?error=too_many");
    throw e;
  }
  if (!user) redirect("/super/login?error=invalid");
  if (!user.isSuper) {
    await signOut();
    redirect("/super/login?error=not_super");
  }
  redirect("/super");
}
