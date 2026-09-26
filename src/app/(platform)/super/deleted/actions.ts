"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { errMsg, requireSuper, withQuery } from "../_lib/guard";
import { readStr } from "@/components/admin/ui";
import { getSiteById, restoreSite, updateSite } from "@/lib/db/sites";
import { addDomain, findDomain } from "@/lib/db/domains";
import { addDomainToVercel, vercelConfigured } from "@/lib/vercel";
import { subdomainHost } from "@/lib/tenant";
import { ROOT_DOMAIN } from "@/lib/config";

/**
 * Brings a soft-deleted site back.
 *
 * `restoreSite` only clears `deleted_at`; the subdomain row was dropped at delete time because a hostname
 * is a shared resource, so it has to be re-created here or the site comes back unreachable. The hostname
 * can have been claimed in between — by a custom domain on another tenant — and that is reported rather
 * than silently swallowed: the row is restored either way, and the operator is told to pick a new slug.
 *
 * It comes back **paused**. A site that has been gone for three weeks going live the instant somebody
 * clicks restore is a surprise nobody asked for; the operator reviews it and presses activate.
 */
export async function restoreSiteAction(id: string, fd: FormData) {
  await requireSuper();
  const back = "/super/deleted";
  const site = await getSiteById(id, { includeDeleted: true });
  if (!site || !site.deletedAt) redirect(withQuery(back, { error: "not_found" }));
  // Typed confirmation here too: restoring republishes someone's business under its old address.
  if (readStr(fd, "confirm", 80) !== site.slug) redirect(withQuery(back, { error: "confirm_mismatch" }));

  const host = subdomainHost(site.slug, ROOT_DOMAIN);
  let hostTaken = false;
  try {
    await restoreSite(id);
    await updateSite(id, { status: "paused" });
    const clash = await findDomain(host);
    hostTaken = !!clash && clash.siteId !== id;
    if (!clash) {
      await addDomain({ siteId: id, hostname: host, kind: "subdomain", isPrimary: true, verified: true });
      if (vercelConfigured()) await addDomainToVercel(host);
    }
  } catch (e) {
    // The redirect below throws, so it stays outside the try: `redirect()` signals through an exception
    // and catching it here would report the navigation as a database failure.
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(hostTaken ? withQuery(`/super/sites/${id}`, { error: "restore_no_host" }) : withQuery(`/super/sites/${id}`, { saved: "restored" }));
}
