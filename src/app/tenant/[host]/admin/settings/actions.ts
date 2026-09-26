"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { patchSiteContent, updateSite } from "@/lib/db/sites";
import { getTemplate } from "@/templates/registry";
import { setPassword, authenticate } from "@/lib/db/users";
import { signOut } from "@/lib/auth/session";

export async function saveSettings(host: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  try {
    await patchSiteContent(site.id, {
      settings: {
        defaultLocale: readStr(fd, "defaultLocale", 2) === "en" ? "en" : "ar",
        showLangToggle: readBool(fd, "showLangToggle"),
        floatingWhatsapp: readBool(fd, "floatingWhatsapp"),
      },
    });
  } catch (e) {
    redirect(withQuery("/admin/settings", { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/settings", { saved: "1" }));
}

/** Site admins may switch between templates of their own trade; content and theme overrides are kept. */
export async function switchTemplate(host: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const code = readStr(fd, "template", 3);
  const tpl = getTemplate(code);
  if (!tpl || tpl.category !== site.category) redirect(withQuery("/admin/settings", { error: "invalid_template" }));
  await updateSite(site.id, { templateCode: tpl.code });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/settings", { saved: "1" }));
}

export async function changePassword(host: string, fd: FormData) {
  const { user } = await requireSiteAdmin(host);
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (next.length < 8) redirect(withQuery("/admin/settings", { error: "password_short" }));
  if (next !== confirm) redirect(withQuery("/admin/settings", { error: "password_mismatch" }));
  // `authenticate` throws once the email or the client IP is throttled, and an owner who mistyped their
  // current password a few times then got an unhandled 500 on their own settings page — the same
  // outcome as the site being down, for something that is working exactly as designed.
  let ok = false;
  try {
    ok = !!(await authenticate(user.email, current));
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Error && e.name === "TooManyAttemptsError") redirect(withQuery("/admin/settings", { error: "too_many" }));
    throw e;
  }
  if (!ok) redirect(withQuery("/admin/settings", { error: "invalid_login" }));
  await setPassword(user.id, next);
  await signOut();
  redirect("/admin/login?changed=1");
}
