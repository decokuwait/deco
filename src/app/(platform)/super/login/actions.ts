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
    await upsertSuperAdmin(email, password, "Owner");
  }
  const user = await signInWithPassword(email, password);
  if (!user) redirect("/super/login?error=invalid");
  if (!user.isSuper) {
    await signOut();
    redirect("/super/login?error=not_super");
  }
  redirect("/super");
}
