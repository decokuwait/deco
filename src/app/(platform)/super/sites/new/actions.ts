"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../../_lib/guard";
import { readStr } from "@/components/admin/ui";
import { isValidSlug, isValidHostname, normalizeHostname } from "@/lib/tenant";
import { CATEGORIES, type Category } from "@/lib/types";
import { isTemplateCode, getTemplate, defaultTemplateFor } from "@/templates/registry";
import { provisionSite, slugAvailable } from "@/lib/provision";
import { addDomain, updateDomainStatus } from "@/lib/db/domains";
import { addDomainToVercel, vercelConfigured } from "@/lib/vercel";
import { createUser, getUserByEmail } from "@/lib/db/users";
import { addMember } from "@/lib/db/members";

function isCategory(v: string): v is Category {
  return (CATEGORIES as string[]).includes(v);
}

export async function createSiteAction(fd: FormData) {
  await requireSuper();
  const name = readStr(fd, "name", 120);
  const category = readStr(fd, "category", 20);
  const templateCode = readStr(fd, "template", 3);
  const slug = readStr(fd, "slug", 63).toLowerCase();
  const customDomain = normalizeHostname(readStr(fd, "customDomain", 253));
  const whatsapp = readStr(fd, "whatsapp", 20).replace(/[^\d]/g, "");
  const adminEmail = readStr(fd, "adminEmail", 200).toLowerCase();
  const adminPassword = String(fd.get("adminPassword") ?? "");
  const back = withQuery("/super/sites/new", { cat: category, template: templateCode });

  if (!name) redirect(withQuery(back, { error: "required" }));
  if (!isCategory(category)) redirect(withQuery(back, { error: "required" }));
  if (!isValidSlug(slug)) redirect(withQuery(back, { error: "invalid_slug" }));
  if (!(await slugAvailable(slug))) redirect(withQuery(back, { error: "slug_taken" }));
  if (customDomain && !isValidHostname(customDomain)) redirect(withQuery(back, { error: "invalid_domain" }));
  if (adminEmail) {
    const existing = await getUserByEmail(adminEmail);
    if (!existing && adminPassword.length < 8) redirect(withQuery(back, { error: "password_short" }));
  }

  let template = isTemplateCode(templateCode) ? getTemplate(templateCode)! : defaultTemplateFor(category);
  if (template.category !== category) template = defaultTemplateFor(category);

  let siteId = "";
  try {
    const { site } = await provisionSite({ slug, name, category, templateCode: template.code, whatsapp: whatsapp || undefined });
    siteId = site.id;
    if (customDomain) {
      const row = await addDomain({ siteId, hostname: customDomain, kind: "custom" });
      if (vercelConfigured()) {
        const v = await addDomainToVercel(customDomain);
        await updateDomainStatus(row.id, { vercelStatus: v, verified: !!(v.verified && v.configured) });
      }
    }
    if (adminEmail) {
      const user = (await getUserByEmail(adminEmail)) || (await createUser({ email: adminEmail, password: adminPassword, isSuper: false }));
      await addMember(siteId, user.id);
    }
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(`/super/sites/${siteId}`, { saved: "1" }));
}
