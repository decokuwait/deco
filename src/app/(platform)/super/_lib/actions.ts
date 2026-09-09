"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/session";

export async function superLogout() {
  await signOut();
  redirect("/super/login");
}
