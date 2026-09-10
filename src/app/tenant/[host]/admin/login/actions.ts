"use server";

import { redirect } from "next/navigation";
import { getRequestSite } from "@/lib/site-request";
import { signInWithPassword, signOut } from "@/lib/auth/session";
import { isSiteMember } from "@/lib/db/members";
import { readStr } from "@/components/admin/ui";

export async function loginAction(host: string, fd: FormData) {
  const site = await getRequestSite(host);
  if (!site) redirect("/admin/login?error=no_site");
  const email = readStr(fd, "email", 200);
  const password = String(fd.get("password") ?? "");
  if (!email || !password) redirect("/admin/login?error=invalid");

  let user: Awaited<ReturnType<typeof signInWithPassword>> = null;
  try {
    user = await signInWithPassword(email, password);
  } catch (e) {
    if (e instanceof Error && e.name === "TooManyAttemptsError") redirect("/admin/login?error=too_many");
    throw e;
  }
  if (!user) redirect("/admin/login?error=invalid");

  const allowed = user.isSuper || (await isSiteMember(site.id, user.id));
  if (!allowed) {
    await signOut();
    redirect("/admin/login?error=no_access");
  }
  redirect("/admin");
}
