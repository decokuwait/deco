import { notFound } from "next/navigation";
import { requireSuper, sp1, superError, type SearchParams } from "../../_lib/guard";
import { SuperPanel, TemplatePicker } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle, Badge, LinkButton, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { TypedConfirm } from "../../_components/TypedConfirm";
import { BillingBadge } from "../../_components/Billing";
import { getSiteById } from "@/lib/db/sites";
import { listDomains } from "@/lib/db/domains";
import { listMembers } from "@/lib/db/members";
import { CATEGORIES, CATEGORY_LABELS, PLANS } from "@/lib/types";
import { cycleLabel, filsToKwd, formatFils, isPaymentUrl, nextPaidUntil, paymentMode, planLabel, planPriceFils, setupFeeFils, todayIso } from "@/lib/billing";
import { recommendedRecords, vercelConfigured } from "@/lib/vercel";
import { ROOT_DOMAIN, rootPort, siteUrl } from "@/lib/config";
import {
  addCustomDomainAction,
  addMemberAction,
  checkDomainAction,
  deleteSiteAction,
  generatePaymentLinkAction,
  recordPaymentAction,
  removeDomainAction,
  removeMemberAction,
  updateBillingAction,
  updateSiteAction,
} from "./actions";

export default async function EditSitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const site = await getSiteById(id);
  if (!site) notFound();
  const [domains, members] = await Promise.all([listDomains(id), listMembers(id)]);
  const error = sp1(sp.error);
  const saved = sp1(sp.saved);
  const savedText =
    saved === "attached"
      ? t("saved_attached")
      : saved === "created"
        ? t("saved_created")
        : saved === "reference_minted"
          ? t("reference_minted")
          : saved === "restored"
            ? t("restored")
            : t("saved");
  const today = todayIso();
  const mode = paymentMode();
  // The generated link arrives in the query string, so it is checked against the payment provider's own
  // domain before it is rendered. Anything else is dropped: an arbitrary URL rendered as "your payment
  // link" inside the owner's trusted panel is a phishing vector, exactly like an untranslated error code.
  const rawPay = sp1(sp.pay);
  const payUrl = rawPay && isPaymentUrl(rawPay) ? rawPay : "";
  const port = rootPort();
  const primary = domains.find((d) => d.kind === "subdomain") ?? domains[0];
  const host = primary ? `${primary.hostname}${port}` : null;
  const root = ROOT_DOMAIN.replace(/:\d+$/, "");

  return (
    <SuperPanel ctx={ctx} active="sites">
      <PageHeader
        title={site.name}
        subtitle={host ?? ""}
        actions={
          host ? (
            <>
              <LinkButton href={siteUrl(host)} variant="primary">
                {t("open_site")}
              </LinkButton>
              <LinkButton href={siteUrl(host, "/admin")}>{t("open_admin")}</LinkButton>
            </>
          ) : undefined
        }
      />
      <Flash saved={saved} error={error} savedText={savedText} errorText={t("error")} translate={superError(t)} />

      <form action={updateSiteAction.bind(null, id)} className="grid gap-5">
        <Card title={t("site_name")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("site_name")}>
              <Input name="name" defaultValue={site.name} required />
            </Field>
            <Field label={t("category")}>
              <Select name="category" defaultValue={site.category}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c][locale]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("slug")} hint={`${t("changing_slug_hint")} — <slug>.${root}`}>
              <Input name="slug" defaultValue={site.slug} required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" dir="ltr" />
            </Field>
            <Field label={t("status")}>
              <Select name="status" defaultValue={site.status}>
                <option value="active">{t("active")}</option>
                <option value="paused">{t("paused")}</option>
              </Select>
            </Field>
          </div>
        </Card>
        <Card title={`${t("template")} — ${site.templateCode}`}>
          <p className="mb-3 text-sm text-slate-600">{t("change_template_hint")}</p>
          <TemplatePicker name="template" value={site.templateCode} locale={locale} previewLabel={t("preview")} />
        </Card>
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[160px]">
            {t("save")}
          </SubmitButton>
        </div>
      </form>

      <div id="domains" className="mt-8 scroll-mt-20">
        <Card title={t("domains")}>
          <p className="mb-3 text-sm text-slate-600">{t("subdomain_auto")}</p>
          {!vercelConfigured() && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{t("vercel_missing")}</div>}
          <ul className="divide-y divide-slate-100">
            {domains.map((d) => {
              const ok = d.verified;
              const vs = d.vercelStatus as { verification?: { type: string; domain: string; value: string }[]; recommended?: { type: string; name: string; value: string }[]; error?: string } | null;
              // Routing records (A/CNAME) are always needed; Vercel's TXT ownership challenge is shown in addition when present.
              const recs = [...(vs?.recommended?.length ? vs.recommended : recommendedRecords(d.hostname)), ...(vs?.verification ?? []).map((v) => ({ type: v.type, name: v.domain, value: v.value }))];
              return (
                <li key={d.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold" dir="ltr">
                        {d.hostname}
                      </span>
                      <Badge tone={d.kind === "subdomain" ? "blue" : "violet"}>{d.kind === "subdomain" ? t("subdomain") : t("custom")}</Badge>
                      <Badge tone={ok ? "green" : "amber"}>{ok ? t("verified") : t("pending_dns")}</Badge>
                    </div>
                    <div className="flex gap-1.5">
                      <form action={checkDomainAction.bind(null, id, d.id)}>
                        <SubmitButton variant="ghost" pendingText="..." className="px-2.5 py-1.5 text-xs">
                          {t("check_status")}
                        </SubmitButton>
                      </form>
                      {d.kind === "custom" && (
                        <form action={removeDomainAction.bind(null, id, d.id)}>
                          <ConfirmButton message={t("confirm_delete")}>{t("remove")}</ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                  {d.kind === "custom" && !ok && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="mb-1 font-bold text-slate-700">{t("dns_instructions")}</div>
                      <table className="w-full text-start font-mono" dir="ltr">
                        <tbody>
                          {recs.map((r, i) => (
                            <tr key={i}>
                              <td className="pe-3 py-0.5 font-bold">{r.type}</td>
                              <td className="pe-3 py-0.5">{r.name}</td>
                              <td className="py-0.5 break-all">{r.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!!vs?.verification?.length && <div className="mt-2 font-sans text-slate-600">{t("dns_verify_hint")}</div>}
                      {vs?.error && <div className="mt-1 text-red-700">{vs.error}</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <form action={addCustomDomainAction.bind(null, id)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={t("add_domain")} className="flex-1">
              <Input name="hostname" dir="ltr" placeholder="company.com" required />
            </Field>
            <SubmitButton pendingText={t("saving")}>{t("add_domain")}</SubmitButton>
          </form>
        </Card>
      </div>

      <div id="members" className="mt-5 scroll-mt-20">
        <Card title={t("members")}>
          {members.length === 0 ? (
            <EmptyState title={t("none")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-bold text-slate-900" dir="ltr">
                      {m.email}
                    </div>
                    <div className="text-xs text-slate-500">
                      {m.name || ""} {m.isSuper ? `· ${t("is_super")}` : ""}
                    </div>
                  </div>
                  <form action={removeMemberAction.bind(null, id, m.id)}>
                    <ConfirmButton message={t("confirm_delete")}>{t("remove")}</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addMemberAction.bind(null, id)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t("admin_email")}>
              <Input name="email" type="email" dir="ltr" required />
            </Field>
            <Field label={t("admin_password")} hint={t("member_password_hint")}>
              <Input name="password" type="password" autoComplete="new-password" dir="ltr" />
            </Field>
            <SubmitButton pendingText={t("saving")}>{t("add_member")}</SubmitButton>
          </form>
        </Card>
      </div>

      <div id="billing" className="mt-5 scroll-mt-20">
        <Card
          title={t("billing")}
          actions={
            <span className="flex flex-wrap items-center gap-1.5">
              <BillingBadge paidUntil={site.paidUntil} t={t} today={today} />
              <Badge tone={site.status === "active" ? "green" : "amber"}>{site.status === "active" ? t("active") : t("paused")}</Badge>
            </span>
          }
        >
          <form action={updateBillingAction.bind(null, id)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("plan")}>
                <Select name="plan" defaultValue={site.plan}>
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {planLabel(p, locale)} — {formatFils(planPriceFils(p, site.billingCycle), locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("billing_cycle")}>
                <Select name="billingCycle" defaultValue={site.billingCycle}>
                  <option value="yearly">{t("yearly")}</option>
                  <option value="monthly">{t("monthly")}</option>
                </Select>
              </Field>
              <Field label={t("price")} hint={t("price_hint")}>
                <Input name="price" defaultValue={filsToKwd(site.priceFils)} inputMode="decimal" dir="ltr" />
              </Field>
              <Field label={t("paid_until")} hint={t("paid_until_hint")}>
                <Input name="paidUntil" type="date" defaultValue={site.paidUntil ?? ""} dir="ltr" />
              </Field>
              <Field label={t("last_invoice_ref")} className="sm:col-span-2">
                <Input name="lastInvoiceRef" defaultValue={site.lastInvoiceRef ?? ""} dir="ltr" placeholder="MF-123456 / CASH-260922-4F2A" />
              </Field>
            </div>
            <Toggle name="useCatalogPrice" label={t("use_plan_price")} hint={`${formatFils(planPriceFils(site.plan, site.billingCycle), locale)} — ${cycleLabel(site.billingCycle, locale)}`} />
            <div className="flex justify-end">
              <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
            </div>
          </form>

          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
            <form action={recordPaymentAction.bind(null, id)} className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <h3 className="text-sm font-black text-slate-900">{t("record_payment")}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{t("record_payment_hint")}</p>
              <p className="text-xs font-bold text-emerald-800" dir="ltr">
                {site.paidUntil ?? "—"} → {nextPaidUntil(site.paidUntil, site.billingCycle, today)}
              </p>
              <Field label={t("last_invoice_ref")}>
                <Input name="reference" dir="ltr" defaultValue="" placeholder={t("optional")} />
              </Field>
              <SubmitButton pendingText={t("saving")}>{t("record_payment")}</SubmitButton>
            </form>

            <form action={generatePaymentLinkAction.bind(null, id)} className="grid gap-3 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-black text-slate-900">{t("payment_link")}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{mode === "manual" ? t("payment_link_manual") : t("payment_link_live")}</p>
              <Toggle name="includeSetupFee" label={t("include_setup_fee")} hint={formatFils(setupFeeFils(), locale)} />
              <p className="text-xs text-slate-600">
                {t("total")}: <b dir="ltr">{formatFils(site.priceFils, locale)}</b> (+ {t("setup_fee")} {formatFils(setupFeeFils(), locale)})
              </p>
              <SubmitButton pendingText={t("saving")} variant="secondary">
                {t("payment_link")}
              </SubmitButton>
              {payUrl && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-bold text-emerald-800">{t("payment_link_ready")}</p>
                  <a href={payUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-xs text-emerald-900 underline" dir="ltr">
                    {payUrl}
                  </a>
                </div>
              )}
            </form>
          </div>
        </Card>
      </div>

      <div id="danger" className="mt-5 scroll-mt-20">
        <Card title={t("danger")} className="border-red-200">
          <p className="mb-2 text-sm text-slate-600">{t("delete_site_warning")}</p>
          <p className="mb-4 text-sm text-slate-600">{t("deleted_sites_hint")}</p>
          <form action={deleteSiteAction.bind(null, id)}>
            <TypedConfirm expected={site.slug} hint={t("type_to_confirm_hint")} placeholderLabel={t("type_to_confirm")} pendingText={t("saving")}>
              {t("delete")}
            </TypedConfirm>
          </form>
        </Card>
      </div>
    </SuperPanel>
  );
}
