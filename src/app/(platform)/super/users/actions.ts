"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { createUser, deleteUser, getUserByEmail, setPassword, setSuper } from "@/lib/db/users";

export async function createUserAction(fd: FormData) {
  await requireSuper();
  const email = readStr(fd, "email", 200).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const name = readStr(fd, "name", 120);
  if (!email) redirect(withQuery("/super/users", { error: "required" }));
  if (password.length < 8) redirect(withQuery("/super/users", { error: "password_short" }));
  if (await getUserByEmail(email)) redirect(withQuery("/super/users", { error: "user_exists" }));
  try {
    await createUser({ email, password, name: name || undefined, isSuper: readBool(fd, "isSuper") });
  } catch (e) {
    redirect(withQuery("/super/users", { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery("/super/users", { saved: "1" }));
}

export async function resetPasswordAction(userId: string, fd: FormData) {
  await requireSuper();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirect(withQuery("/super/users", { error: "password_short" }));
  await setPassword(userId, password);
  revalidatePath("/", "layout");
  redirect(withQuery("/super/users", { saved: "1" }));
}

export async function toggleSuperAction(userId: string, isSuper: boolean) {
  const { user } = await requireSuper();
  if (user.id === userId && !isSuper) redirect(withQuery("/super/users", { error: "cannot_delete_self" }));
  await setSuper(userId, isSuper);
  revalidatePath("/", "layout");
  redirect(withQuery("/super/users", { saved: "1" }));
}

export async function deleteUserAction(userId: string) {
  const { user } = await requireSuper();
  if (user.id === userId) redirect(withQuery("/super/users", { error: "cannot_delete_self" }));
  await deleteUser(userId);
  revalidatePath("/", "layout");
  redirect(withQuery("/super/users", { saved: "1" }));
}
