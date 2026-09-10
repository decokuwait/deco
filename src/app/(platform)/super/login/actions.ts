"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, signOut } from "@/lib/auth/session";
import { listUsers, superAdminEmails, upsertSuperAdmin, normalizeEmail } from "@/lib/db/users";
import { readStr } from "@/components/admin/ui";

/**
 * Super admin login. Bootstrap: when no user exists yet and the email is listed in
 * SUPER_ADMIN_EMAILS, the owner account is created with the submitted password.
 */
export async function superLogin(fd: FormData) {
  const email = normalizeEmail(readStr(fd, "email", 200));
  const password = String(fd.get("password") ?? "");
  if (!email || !password) redirect("/super/login?error=invalid");

  const users = await listUsers();
  if (users.length === 0 && superAdminEmails().includes(email) && password.length >= 8) {
    // Bootstrap is only allowed with the password configured in the environment (when one is set),
    // so the empty-database window cannot be claimed by a stranger who knows the owner's email.
    const expected = process.env.SUPER_ADMIN_PASSWORD?.trim();
    if (!expected || expected === password) await upsertSuperAdmin(email, password, "Owner");
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
