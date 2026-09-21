"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, signOut } from "@/lib/auth/session";
import { hasAnyUser, superAdminEmails, upsertSuperAdmin, normalizeEmail } from "@/lib/db/users";
import { classifyDbError } from "@/lib/db/client";
import { readStr } from "@/components/admin/ui";
import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Result of a login attempt; everything but "ok" is an `?error=` code the login page explains. */
type Outcome = "ok" | "invalid" | "too_many" | "not_super" | "bootstrap" | "db_config" | "db_unreachable" | "db_auth" | "db_schema" | "server";

/**
 * Bootstrap: when no user exists yet, the email is listed in SUPER_ADMIN_EMAILS and the submitted
 * password equals SUPER_ADMIN_PASSWORD, the owner account is created. An empty database must never be
 * claimable by a stranger who only knows the owner's email address, so the environment password is
 * required. Returns "bootstrap" when the database is empty but those variables are missing or too short,
 * so a first deploy explains itself instead of answering "invalid credentials".
 */
async function bootstrapOwner(email: string, password: string): Promise<"bootstrap" | null> {
  // A bounded existence check, not a full table read: this runs on every super-login attempt.
  if (await hasAnyUser()) return null;
  const emails = superAdminEmails();
  const expected = process.env.SUPER_ADMIN_PASSWORD?.trim() || "";
  const missing = !emails.length ? "SUPER_ADMIN_EMAILS is not set" : !expected ? "SUPER_ADMIN_PASSWORD is not set" : expected.length < 8 ? "SUPER_ADMIN_PASSWORD is shorter than 8 characters" : "";
  if (missing) {
    console.error(`[super-login] bootstrap refused: ${missing} (on Vercel, environment changes apply to the next deployment only)`);
    return "bootstrap";
  }
  if (emails.includes(email) && safeEqual(expected, password)) await upsertSuperAdmin(email, password, "Owner");
  return null;
}

async function attempt(email: string, password: string): Promise<Outcome> {
  try {
    const refused = await bootstrapOwner(email, password);
    if (refused) return refused;
    const user = await signInWithPassword(email, password);
    if (!user) return "invalid";
    if (!user.isSuper) {
      await signOut();
      return "not_super";
    }
    return "ok";
  } catch (e) {
    if (e instanceof Error && e.name === "TooManyAttemptsError") return "too_many";
    // The raw error only reaches the function logs; the page shows the category so the operator knows
    // whether to fix DATABASE_URL, run the migrations, or read the logs — instead of a blank server error.
    const db = classifyDbError(e);
    console.error(`[super-login] ${db ? `database ${db}` : "unexpected error"}:`, e);
    return db ? `db_${db}` : "server";
  }
}

export async function superLogin(fd: FormData) {
  const email = normalizeEmail(readStr(fd, "email", 200));
  const password = String(fd.get("password") ?? "");
  const outcome = !email || !password ? "invalid" : await attempt(email, password);
  // redirect() throws internally, so it stays outside the try above.
  redirect(outcome === "ok" ? "/super" : `/super/login?error=${outcome}`);
}
