"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../../_lib/guard";
import { readStr } from "@/components/admin/ui";
import { isValidSlug, isValidHostname, normalizeHostname, subdomainHost, isReservedSlug, isPlatformHost } from "@/lib/tenant";
import { CATEGORIES, type Category } from "@/lib/types";
import { getTemplate, isTemplateCode } from "@/templates/registry";
import { deleteSite, getSiteById, getSiteBySlug, updateSite } from "@/lib/db/sites";
import { addDomain, findDomain, getDomain, listDomains, removeDomain, removeSubdomainRows, updateDomainStatus } from "@/lib/db/domains";
import { addDomainToVercel, getDomainStatus, removeDomainFromVercel, vercelConfigured, verifyDomain } from "@/lib/vercel";
import { addMember, listOrphanMemberIds, removeMember } from "@/lib/db/members";
import { createUser, deleteUser, getUserByEmail } from "@/lib/db/users";
import { listMediaKeys } from "@/lib/db/media";
import { deleteObject } from "@/lib/storage";
import { ROOT_DOMAIN } from "@/lib/config";

async function ownSite(id: string) {
  const site = await getSiteById(id);
  if (!site) redirect("/super?error=not_found");
  return site;
}

function friendlyDbError(msg: string): string {
  if (/sites_slug_key|duplicate key.*slug/i.test(msg)) return "slug_taken";
  if (/site_domains_hostname_key|duplicate key.*hostname/i.test(msg)) return "domain_taken";
  if (/users_email_key|duplicate key.*email/i.test(msg)) return "user_exists";
  return msg;
}

export async function updateSiteAction(id: string, fd: FormData) {
  await requireSuper();
  const site = await ownSite(id);
  const back = `/super/sites/${id}`;
  const name = readStr(fd, "name", 120);
  const category = readStr(fd, "category", 20);
  const templateCode = readStr(fd, "template", 3);
  const status = readStr(fd, "status", 10) === "paused" ? "paused" : "active";
  const slug = readStr(fd, "slug", 63).toLowerCase();
  if (!name || !(CATEGORIES as string[]).includes(category)) redirect(withQuery(back, { error: "required" }));
  if (!isTemplateCode(templateCode)) redirect(withQuery(back, { error: "invalid_template" }));
  if (getTemplate(templateCode)?.category !== category) redirect(withQuery(back, { error: "template_category_mismatch" }));
  if (!isValidSlug(slug)) redirect(withQuery(back, { error: "invalid_slug" }));
  const newHost = subdomainHost(slug, ROOT_DOMAIN);
  if (slug !== site.slug) {
    if (isReservedSlug(slug)) redirect(withQuery(back, { error: "reserved_slug" }));
    const other = await getSiteBySlug(slug);
    if (other && other.id !== id) redirect(withQuery(back, { error: "slug_taken" }));
    // The new hostname must be free before anything is written (a custom row could already hold it).
    const clash = await findDomain(newHost);
    if (clash && clash.siteId !== id) redirect(withQuery(back, { error: "domain_taken" }));
  }
  let warning = "";
  try {
    await updateSite(id, { name, category: category as Category, templateCode, status, slug });
    if (slug !== site.slug) {
      await removeSubdomainRows(id);
      const row = await addDomain({ siteId: id, hostname: newHost, kind: "subdomain", isPrimary: true, verified: true });
      if (vercelConfigured()) {
        // Register the new address first; the old one is only released once the new one is accepted.
        const v = await addDomainToVercel(newHost);
        await updateDomainStatus(row.id, { vercelStatus: v });
        if (v.ok) await removeDomainFromVercel(subdomainHost(site.slug, ROOT_DOMAIN));
        else warning = v.error?.startsWith("vercel_unreachable") ? "vercel_unreachable" : v.error || "vercel_error";
      }
    }
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, warning ? { error: warning } : { saved: "1" }));
}

export async function addCustomDomainAction(id: string, fd: FormData) {
  await requireSuper();
  await ownSite(id);
  const back = `/super/sites/${id}`;
  const hostname = normalizeHostname(readStr(fd, "hostname", 253));
  if (!isValidHostname(hostname) || isPlatformHost(hostname, ROOT_DOMAIN)) redirect(withQuery(back, { error: "invalid_domain" }));
  const twin = await findDomain(`www.${hostname}`);
  if (twin && twin.siteId !== id) redirect(withQuery(back, { error: "domain_taken" }));
  let warning = "";
  try {
    const row = await addDomain({ siteId: id, hostname, kind: "custom" });
    if (vercelConfigured()) {
      const v = await addDomainToVercel(hostname);
      await updateDomainStatus(row.id, { vercelStatus: v, verified: !!(v.verified && v.configured) });
      if (v.error?.startsWith("vercel_unreachable")) warning = "vercel_unreachable";
    }
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, warning ? { error: warning } : { saved: "1" }) + "#domains");
}

export async function checkDomainAction(id: string, domainId: string) {
  await requireSuper();
  await ownSite(id);
  const d = await getDomain(domainId);
  if (!d || d.siteId !== id) redirect(`/super/sites/${id}?error=not_found`);
  let warning = "";
  if (vercelConfigured()) {
    try {
      let v = await getDomainStatus(d.hostname);
      if (v.ok && !v.verified) v = await verifyDomain(d.hostname);
      if (v.error?.startsWith("vercel_unreachable")) warning = "vercel_unreachable";
      else await updateDomainStatus(domainId, { vercelStatus: v, verified: !!(v.verified && v.configured) });
    } catch (e) {
      warning = errMsg(e);
    }
  }
  revalidatePath("/", "layout");
  redirect(withQuery(`/super/sites/${id}`, warning ? { error: warning } : { saved: "1" }) + "#domains");
}

export async function removeDomainAction(id: string, domainId: string) {
  await requireSuper();
  await ownSite(id);
  const d = await getDomain(domainId);
  if (!d || d.siteId !== id) redirect(`/super/sites/${id}?error=not_found`);
  await removeDomain(domainId);
  if (vercelConfigured()) await removeDomainFromVercel(d.hostname).catch(() => false);
  revalidatePath("/", "layout");
  redirect(`/super/sites/${id}?saved=1#domains`);
}

export async function addMemberAction(id: string, fd: FormData) {
  await requireSuper();
  await ownSite(id);
  const back = `/super/sites/${id}`;
  const email = readStr(fd, "email", 200).toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email) redirect(withQuery(back, { error: "required" }));
  const existing = await getUserByEmail(email);
  // Attaching an account that already exists must be explicit: a typed password is never silently ignored.
  if (existing && password) redirect(withQuery(back, { error: "user_exists_attach" }));
  if (!existing && password.length < 8) redirect(withQuery(back, { error: "password_short" }));
  try {
    const user = existing ?? (await createUser({ email, password, isSuper: false }));
    await addMember(id, user.id);
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: existing ? "attached" : "created" }) + "#members");
}

export async function removeMemberAction(id: string, userId: string) {
  await requireSuper();
  await ownSite(id);
  await removeMember(id, userId);
  revalidatePath("/", "layout");
  redirect(`/super/sites/${id}?saved=1#members`);
}

/**
 * Deletes a site with everything that belongs to it: database rows (cascade), uploaded files in storage,
 * Vercel domain registrations, and admin accounts whose only site this was.
 */
export async function deleteSiteAction(id: string) {
  await requireSuper();
  const site = await ownSite(id);
  const [domains, keys, orphans] = await Promise.all([listDomains(site.id), listMediaKeys(site.id), listOrphanMemberIds(site.id)]);
  await deleteSite(id);
  for (const k of keys) await deleteObject(k).catch(() => undefined);
  for (const userId of orphans) await deleteUser(userId).catch(() => undefined);
  if (vercelConfigured()) for (const d of domains) await removeDomainFromVercel(d.hostname).catch(() => false);
  revalidatePath("/", "layout");
  redirect("/super?saved=1");
}
