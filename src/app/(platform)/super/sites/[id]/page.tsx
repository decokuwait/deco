import { notFound } from "next/navigation";
import { requireSuper, sp1, type SearchParams } from "../../_lib/guard";
import { SuperPanel, TemplatePicker } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Badge, LinkButton, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { getSiteById } from "@/lib/db/sites";
import { listDomains } from "@/lib/db/domains";
import { listMembers } from "@/lib/db/members";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { recommendedRecords, vercelConfigured } from "@/lib/vercel";
import { ROOT_DOMAIN, rootPort, siteUrl } from "@/lib/config";
import type { SuperUiKey } from "@/lib/i18n/super";
import { addCustomDomainAction, addMemberAction, checkDomainAction, deleteSiteAction, removeDomainAction, removeMemberAction, updateSiteAction } from "./actions";

export default async function EditSitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const site = await getSiteById(id);
  if (!site) notFound();
  const [domains, members] = await Promise.all([listDomains(id), listMembers(id)]);
  const error = sp1(sp.error);
  const known: SuperUiKey[] = ["required", "invalid_slug", "slug_taken", "invalid_domain", "password_short", "invalid_template", "not_found", "domain_taken", "template_category_mismatch"];
  const errorText = (known as string[]).includes(error) ? t(error as SuperUiKey) : error;
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
      <Flash saved={sp1(sp.saved)} error={errorText} savedText={t("saved")} errorText={t("error")} />

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
              const recs = recommendedRecords(d.hostname);
              const vs = d.vercelStatus as { verification?: { type: string; domain: string; value: string }[]; error?: string } | null;
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
                          {(vs?.verification?.length ? vs.verification.map((v) => ({ type: v.type, name: v.domain, value: v.value })) : recs).map((r, i) => (
                            <tr key={i}>
                              <td className="pe-3 py-0.5 font-bold">{r.type}</td>
                              <td className="pe-3 py-0.5">{r.name}</td>
                              <td className="py-0.5 break-all">{r.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

      <Card title={t("danger")} className="mt-5 border-red-200">
        <p className="mb-3 text-sm text-slate-600">{t("delete_site_hint")}</p>
        <form action={deleteSiteAction.bind(null, id)}>
          <ConfirmButton message={t("confirm_delete")}>{t("delete")}</ConfirmButton>
        </form>
      </Card>
    </SuperPanel>
  );
}
