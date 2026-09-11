"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { isValidSlug, isValidHostname, normalizeHostname, isReservedSlug, isPlatformHost } from "@/lib/tenant";
import { CATEGORIES, type Category } from "@/lib/types";
import { isTemplateCode, getTemplate } from "@/templates/registry";
import { provisionSite, slugAvailable } from "@/lib/provision";
import { addDomain, findDomain, updateDomainStatus } from "@/lib/db/domains";
import { addDomainToVercel, vercelConfigured } from "@/lib/vercel";
import { createUser, getUserByEmail } from "@/lib/db/users";
import { addMember } from "@/lib/db/members";
import { ROOT_DOMAIN } from "@/lib/config";

function isCategory(v: string): v is Category {
  return (CATEGORIES as string[]).includes(v);
}

function bounce(back: string, error: string): never {
  redirect(withQuery(back, { error }));
}

/** Postgres unique violations surface as `slug_taken` / `domain_taken` instead of a raw constraint message. */
function friendlyDbError(msg: string): string {
  if (/sites_slug_key|duplicate key.*slug/i.test(msg)) return "slug_taken";
  if (/site_domains_hostname_key|duplicate key.*hostname/i.test(msg)) return "domain_taken";
  if (/users_email_key|duplicate key.*email/i.test(msg)) return "user_exists";
  return msg;
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
  const seedDemo = readBool(fd, "seedDemo");
  const startPaused = readBool(fd, "startPaused");
  // Everything the operator typed (except the password) survives a validation round-trip.
  const back = withQuery("/super/sites/new", {
    cat: category,
    template: templateCode,
    name,
    slug,
    customDomain,
    whatsapp,
    adminEmail,
    seedDemo: seedDemo ? "1" : "0",
    startPaused: startPaused ? "1" : "0",
  });
  if (!name) bounce(back, "required");
  if (!isCategory(category)) bounce(back, "required");
  if (!isTemplateCode(templateCode)) bounce(back, "invalid_template");
  const template = getTemplate(templateCode)!;
  if (template.category !== category) bounce(back, "template_category_mismatch");
  if (!isValidSlug(slug)) bounce(back, "invalid_slug");
  if (isReservedSlug(slug)) bounce(back, "reserved_slug");
  if (!(await slugAvailable(slug))) bounce(back, "slug_taken");
  if (customDomain) {
    if (!isValidHostname(customDomain) || isPlatformHost(customDomain, ROOT_DOMAIN)) bounce(back, "invalid_domain");
    if ((await findDomain(customDomain)) || (await findDomain(`www.${customDomain}`))) bounce(back, "domain_taken");
  }
  let existingAdmin: Awaited<ReturnType<typeof getUserByEmail>> = null;
  if (adminEmail) {
    existingAdmin = await getUserByEmail(adminEmail);
    // Attaching an existing account must be a conscious choice: a typed password would otherwise be silently ignored.
    if (existingAdmin && adminPassword) bounce(back, "user_exists_attach");
    if (!existingAdmin && adminPassword.length < 8) bounce(back, "password_short");
  }

  let siteId = "";
  try {
    const { site } = await provisionSite({
      slug,
      name,
      category,
      templateCode: template.code,
      whatsapp: whatsapp || undefined,
      seedProjects: seedDemo,
      demoContent: seedDemo,
      status: startPaused ? "paused" : "active",
    });
    siteId = site.id;
  } catch (e) {
    bounce(back, friendlyDbError(errMsg(e)));
  }

  // The site exists from here on: any later problem is reported on the site's own page, where the
  // operator can retry the domain or member step without re-creating anything.
  let warning = "";
  try {
    if (customDomain) {
      const row = await addDomain({ siteId, hostname: customDomain, kind: "custom" });
      if (vercelConfigured()) {
        const v = await addDomainToVercel(customDomain);
        await updateDomainStatus(row.id, { vercelStatus: v, verified: !!(v.verified && v.configured) });
      }
    }
  } catch (e) {
    warning = friendlyDbError(errMsg(e));
  }
  let savedAs = "1";
  try {
    if (adminEmail) {
      const user = existingAdmin ?? (await createUser({ email: adminEmail, password: adminPassword, isSuper: false }));
      await addMember(siteId, user.id);
      savedAs = existingAdmin ? "attached" : "created";
    }
  } catch (e) {
    warning = warning || friendlyDbError(errMsg(e));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(`/super/sites/${siteId}`, warning ? { error: warning } : { saved: savedAs }));
}
