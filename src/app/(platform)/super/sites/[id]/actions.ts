"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../../_lib/guard";
import { readStr } from "@/components/admin/ui";
import { isValidSlug, isValidHostname, normalizeHostname, subdomainHost } from "@/lib/tenant";
import { CATEGORIES, type Category } from "@/lib/types";
import { isTemplateCode } from "@/templates/registry";
import { deleteSite, getSiteById, getSiteBySlug, updateSite } from "@/lib/db/sites";
import { addDomain, getDomain, listDomains, removeDomain, removeSubdomainRows, updateDomainStatus } from "@/lib/db/domains";
import { addDomainToVercel, getDomainStatus, removeDomainFromVercel, vercelConfigured, verifyDomain } from "@/lib/vercel";
import { addMember, removeMember } from "@/lib/db/members";
import { createUser, getUserByEmail } from "@/lib/db/users";
import { ROOT_DOMAIN } from "@/lib/config";

async function ownSite(id: string) {
  const site = await getSiteById(id);
  if (!site) redirect("/super?error=not_found");
  return site;
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
  if (!isValidSlug(slug)) redirect(withQuery(back, { error: "invalid_slug" }));
  if (slug !== site.slug) {
    const other = await getSiteBySlug(slug);
    if (other && other.id !== id) redirect(withQuery(back, { error: "slug_taken" }));
  }
  try {
    await updateSite(id, { name, category: category as Category, templateCode, status, slug });
    if (slug !== site.slug) {
      await removeSubdomainRows(id);
      const hostname = subdomainHost(slug, ROOT_DOMAIN);
      const row = await addDomain({ siteId: id, hostname, kind: "subdomain", isPrimary: true, verified: true });
      if (vercelConfigured()) {
        await removeDomainFromVercel(subdomainHost(site.slug, ROOT_DOMAIN)).catch(() => false);
        const v = await addDomainToVercel(hostname);
        await updateDomainStatus(row.id, { vercelStatus: v });
      }
    }
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}

export async function addCustomDomainAction(id: string, fd: FormData) {
  await requireSuper();
  await ownSite(id);
  const back = `/super/sites/${id}`;
  const hostname = normalizeHostname(readStr(fd, "hostname", 253));
  if (!isValidHostname(hostname)) redirect(withQuery(back, { error: "invalid_domain" }));
  try {
    const row = await addDomain({ siteId: id, hostname, kind: "custom" });
    if (vercelConfigured()) {
      const v = await addDomainToVercel(hostname);
      await updateDomainStatus(row.id, { vercelStatus: v, verified: !!(v.verified && v.configured) });
    }
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }) + "#domains");
}

export async function checkDomainAction(id: string, domainId: string) {
  await requireSuper();
  await ownSite(id);
  const d = await getDomain(domainId);
  if (!d || d.siteId !== id) redirect(`/super/sites/${id}?error=not_found`);
  if (vercelConfigured()) {
    let v = await getDomainStatus(d.hostname);
    if (!v.verified) v = await verifyDomain(d.hostname);
    await updateDomainStatus(domainId, { vercelStatus: v, verified: !!(v.verified && v.configured) });
  }
  revalidatePath("/", "layout");
  redirect(`/super/sites/${id}?saved=1#domains`);
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
  try {
    let user = await getUserByEmail(email);
    if (!user) {
      if (password.length < 8) redirect(withQuery(back, { error: "password_short" }));
      const created = await createUser({ email, password, isSuper: false });
      await addMember(id, created.id);
    } else {
      await addMember(id, user.id);
    }
    user = null;
  } catch (e) {
    const msg = errMsg(e);
    if (msg.includes("NEXT_REDIRECT")) throw e;
    redirect(withQuery(back, { error: msg }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }) + "#members");
}

export async function removeMemberAction(id: string, userId: string) {
  await requireSuper();
  await ownSite(id);
  await removeMember(id, userId);
  revalidatePath("/", "layout");
  redirect(`/super/sites/${id}?saved=1#members`);
}

export async function deleteSiteAction(id: string) {
  await requireSuper();
  const site = await ownSite(id);
  const domains = await listDomains(site.id);
  await deleteSite(id);
  if (vercelConfigured()) for (const d of domains) await removeDomainFromVercel(d.hostname).catch(() => false);
  revalidatePath("/", "layout");
  redirect("/super?saved=1");
}
