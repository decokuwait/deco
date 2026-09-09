"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/session";

export async function logoutAction() {
  await signOut();
  redirect("/admin/login");
}
