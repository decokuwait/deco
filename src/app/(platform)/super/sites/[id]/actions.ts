"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuper, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { isValidSlug, isValidHostname, normalizeHostname, subdomainHost, isReservedSlug, isPlatformHost } from "@/lib/tenant";
import { CATEGORIES, type Category } from "@/lib/types";
import { getTemplate, isTemplateCode } from "@/templates/registry";
import { getSiteById, getSiteBySlug, softDeleteSite, updateSite, updateSiteBilling } from "@/lib/db/sites";
import { addDomain, findDomain, getDomain, removeDomain, removeSubdomainRows, updateDomainStatus } from "@/lib/db/domains";
import { enqueueDeletion } from "@/lib/db/deletions";
import { addDomainToVercel, getDomainStatus, removeDomainFromVercel, vercelConfigured, verifyDomain } from "@/lib/vercel";
import { addMember, removeMember } from "@/lib/db/members";
import { createUser, getUserByEmail } from "@/lib/db/users";
import { createInvoice, isBillingCycle, isIsoDate, isPlan, kwdToFils, nextPaidUntil, planPriceFils, setupFeeFils } from "@/lib/billing";
import { reportError } from "@/lib/observability";
import { ROOT_DOMAIN, rootUrl } from "@/lib/config";

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

/* ------------------------------------------------------------------ billing */

/**
 * Plan, price, cycle, expiry and invoice reference.
 *
 * The price is typed in dinars and stored in fils, parsed by `kwdToFils` rather than `Number(x) * 1000`:
 * KWD has three decimal places and `25.13 * 1000` is 25129.999999999996. An empty date clears `paid_until`,
 * which is the only way back to "not sold yet" — useful when a site was set up for a demo.
 */
export async function updateBillingAction(id: string, fd: FormData) {
  await requireSuper();
  await ownSite(id);
  const back = `/super/sites/${id}`;
  const plan = readStr(fd, "plan", 10);
  const cycle = readStr(fd, "billingCycle", 10);
  if (!isPlan(plan) || !isBillingCycle(cycle)) redirect(withQuery(back, { error: "required" }));

  // "Use the plan price" is a checkbox rather than a magic empty field: an operator who clears the price
  // box means zero, and zero is a legitimate value (a site given away, a partner's demo).
  const useCatalog = readBool(fd, "useCatalogPrice");
  const typed = readStr(fd, "price", 16);
  const priceFils = useCatalog ? planPriceFils(plan, cycle) : kwdToFils(typed);
  if (priceFils === null) redirect(withQuery(back, { error: "invalid_price" }));

  const paidUntilRaw = readStr(fd, "paidUntil", 10);
  if (paidUntilRaw && !isIsoDate(paidUntilRaw)) redirect(withQuery(back, { error: "invalid_date" }));
  const lastInvoiceRef = readStr(fd, "lastInvoiceRef", 64);

  try {
    await updateSiteBilling(id, {
      plan,
      priceFils,
      billingCycle: cycle,
      paidUntil: paidUntilRaw || null,
      lastInvoiceRef: lastInvoiceRef || null,
    });
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }) + "#billing");
}

/**
 * Records that money arrived and extends the subscription by one cycle.
 *
 * This is the manual/offline path, and it is the default one: cash and KNET transfers are normal in this
 * trade, so the founder types the reference off the receipt and the site's clock moves. A site that was
 * auto-paused for non-payment is re-activated in the same step — the pause is a consequence of the date,
 * so clearing the date has to clear the consequence, otherwise a paid customer stays dark until somebody
 * remembers the second switch.
 */
export async function recordPaymentAction(id: string, fd: FormData) {
  await requireSuper();
  const site = await ownSite(id);
  const back = `/super/sites/${id}`;
  const reference = readStr(fd, "reference", 64);
  const paidUntil = nextPaidUntil(site.paidUntil, site.billingCycle);
  try {
    await updateSiteBilling(id, { paidUntil, ...(reference ? { lastInvoiceRef: reference } : {}) });
    if (site.status === "paused") await updateSite(id, { status: "active" });
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }) + "#billing");
}

/**
 * Produces something to send the customer on WhatsApp: a MyFatoorah invoice link when the API key is set,
 * or a cash reference when it is not. The offline path is not a degraded mode — it is how the first
 * customers will actually pay, and the product had to be sellable before the merchant account existed.
 *
 * The link comes back in the query string and is validated against the provider's domain before the page
 * renders it; the reference is stored on the site so it survives the redirect either way.
 */
export async function generatePaymentLinkAction(id: string, fd: FormData) {
  await requireSuper();
  const site = await ownSite(id);
  const back = `/super/sites/${id}`;
  const withSetup = readBool(fd, "includeSetupFee");
  const amountFils = site.priceFils + (withSetup ? setupFeeFils() : 0);
  const result = await createInvoice({
    siteId: site.id,
    customerName: site.name,
    plan: site.plan,
    cycle: site.billingCycle,
    amountFils,
    whatsapp: site.content.contact.whatsapp || null,
    locale: "ar",
    callbackUrl: rootUrl(`/super/sites/${site.id}?saved=1`),
    errorUrl: rootUrl(`/super/sites/${site.id}?error=payment_provider_failed`),
  });
  if (!result.ok) redirect(withQuery(back, { error: result.error || "payment_provider_failed" }) + "#billing");
  try {
    await updateSiteBilling(id, { lastInvoiceRef: result.reference });
  } catch (e) {
    redirect(withQuery(back, { error: friendlyDbError(errMsg(e)) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, result.url ? { pay: result.url } : { saved: "reference_minted" }) + "#billing");
}

/* ------------------------------------------------------------------ deletion */

/**
 * Soft-deletes a site: it disappears from every lookup, gives up its subdomain, and stays restorable for
 * thirty days before the purge job removes it for good.
 *
 * Two things changed from the version this replaces. The guard is a typed confirmation instead of
 * `window.confirm`, because a confirm dialog is dismissed by the same reflex that clicked the button and
 * this operation used to be an immediate, unrecoverable cascade — there is no R2 versioning and no
 * per-tenant export to restore from. And the external cleanup is *queued* instead of being attempted
 * inline with `.catch(() => undefined)` while still redirecting `?saved=1`: that pattern reported success
 * for a delete that had leaked a Vercel registration or a bucket full of objects, and recorded nothing.
 *
 * Media objects and custom domains are deliberately NOT queued here — they belong to the site while it is
 * restorable, and `purgeDeletedSites` queues them in the same transaction as the real delete. Only the
 * subdomain goes now, because `softDeleteSite` releases the hostname immediately: leaving it registered on
 * Vercel would keep an address resolving to a site every lookup now refuses, which reads as an outage.
 *
 * Admin accounts are no longer deleted along with the site. The old behaviour removed a person's login the
 * moment their only site was deleted, which is unrecoverable and premature while the site itself is not.
 */
export async function deleteSiteAction(id: string, fd: FormData) {
  await requireSuper();
  const site = await ownSite(id);
  const back = `/super/sites/${id}`;
  // Re-checked on the server: the disabled button in `TypedConfirm` is UI, not a guard.
  if (readStr(fd, "confirm", 80) !== site.slug) redirect(withQuery(back, { error: "confirm_mismatch" }) + "#danger");

  const subHost = subdomainHost(site.slug, ROOT_DOMAIN);
  if (!(await softDeleteSite(id))) redirect(withQuery(back, { error: "not_found" }));
  let warning = "";
  if (vercelConfigured()) {
    try {
      await enqueueDeletion("vercel_domain", subHost);
    } catch (e) {
      // The site IS deleted; only the record of the follow-up work failed. Say so rather than pretend.
      await reportError(e, { source: "super-delete-site", fields: { siteId: id, hostname: subHost } });
      warning = "cleanup_queue_failed";
    }
  }
  revalidatePath("/", "layout");
  redirect(withQuery("/super", warning ? { error: warning } : { saved: "soft_deleted" }));
}
