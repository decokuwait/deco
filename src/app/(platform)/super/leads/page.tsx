import Link from "next/link";
import { requireSuper, sp1, superError, type SearchParams } from "../_lib/guard";
import { SuperPanel } from "../_components/Panel";
import { Card, PageHeader, Flash, Badge, Field, Input, Select, EmptyState, LinkButton } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { LEAD_STATUSES, isLeadStatus, leadCounts, listLeads, type LeadStatus } from "@/app/(platform)/pricing/_lib/leads";
import { CATEGORY_LABELS, isCategory } from "@/lib/types";
import type { SuperUiKey } from "@/lib/i18n/super";
import { deleteLeadAction, updateLeadAction } from "./actions";

/**
 * The inbox for the "اطلب موقعك" form.
 *
 * This exists instead of an email notification, on purpose. There is no transactional email anywhere in
 * this product, and adding a mail provider to deliver one form would buy a dependency, a DKIM/SPF chore and
 * a monthly bill in exchange for a message that can bounce or be spam-foldered. A row here cannot go
 * missing, survives a phone change, and the founder gets a WhatsApp link he can tap.
 */

const STATUS_LABEL: Record<LeadStatus, SuperUiKey> = {
  new: "lead_new",
  contacted: "lead_contacted",
  won: "lead_won",
  lost: "lead_lost",
  spam: "lead_spam",
};

const STATUS_TONE: Record<LeadStatus, "green" | "amber" | "blue" | "slate" | "red"> = {
  new: "amber",
  contacted: "blue",
  won: "green",
  lost: "slate",
  spam: "red",
};

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const filter = sp1(sp.status);
  const status = isLeadStatus(filter) ? filter : undefined;
  const [leads, counts] = await Promise.all([listLeads({ status }), leadCounts()]);
  const total = LEAD_STATUSES.reduce((n, s) => n + counts[s], 0);

  return (
    <SuperPanel ctx={ctx} active="leads">
      <PageHeader title={t("lead_inbox")} subtitle={`${counts.new} / ${total}`} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} translate={superError(t)} />

      <nav className="mb-4 flex flex-wrap gap-1.5 text-sm font-bold">
        <Link
          href="/super/leads"
          aria-current={status ? undefined : "page"}
          className={`rounded-full px-3 py-1.5 ${status ? "border border-slate-300 bg-white text-slate-700" : "bg-slate-900 text-white"}`}
        >
          {t("all")} ({total})
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/super/leads?status=${s}`}
            aria-current={status === s ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ${status === s ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {t(STATUS_LABEL[s])} ({counts[s]})
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <EmptyState title={t("no_leads")} hint={t("no_leads_hint")} />
      ) : (
        <ul className="grid gap-3">
          {leads.map((lead) => {
            const trade = isCategory(lead.trade) ? CATEGORY_LABELS[lead.trade][locale] : lead.trade || "—";
            // The number is stored in international digits precisely so this link needs no cleanup.
            const wa = `https://wa.me/${lead.whatsapp}`;
            return (
              <li key={lead.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black text-slate-900">{lead.name}</p>
                      <p className="mt-0.5 font-mono text-sm text-slate-600" dir="ltr">
                        +{lead.whatsapp}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge tone={STATUS_TONE[lead.status]}>{t(STATUS_LABEL[lead.status])}</Badge>
                        <Badge tone="violet">
                          {t("lead_trade")}: {trade}
                        </Badge>
                        {lead.area && (
                          <Badge tone="slate">
                            {t("lead_area")}: {lead.area}
                          </Badge>
                        )}
                        <Badge tone="slate">
                          {t("lead_source")}: {lead.source || "—"}
                        </Badge>
                        <Badge tone="slate">{lead.createdAt.slice(0, 16).replace("T", " ")}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <LinkButton href={wa} variant="primary" className="px-3 py-2 text-xs">
                        {t("lead_open_whatsapp")}
                      </LinkButton>
                      <LinkButton href="/super/sites/new" className="px-3 py-2 text-xs">
                        {t("create_site_from_lead")}
                      </LinkButton>
                    </div>
                  </div>

                  {lead.message && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</p>}

                  <form action={updateLeadAction.bind(null, lead.id)} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                    <Field label={t("status")}>
                      <Select name="status" defaultValue={lead.status}>
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(STATUS_LABEL[s])}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("lead_note")}>
                      <Input name="notes" defaultValue={lead.notes ?? ""} placeholder={t("optional")} />
                    </Field>
                    <div className="flex gap-1.5">
                      <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
                      <ConfirmButton message={t("confirm_delete")} formAction={deleteLeadAction.bind(null, lead.id)}>
                        {t("delete")}
                      </ConfirmButton>
                    </div>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </SuperPanel>
  );
}
