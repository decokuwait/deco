import { requireSuper, sp1, superError, type SearchParams } from "../_lib/guard";
import { SuperPanel } from "../_components/Panel";
import { TypedConfirm } from "../_components/TypedConfirm";
import { Card, PageHeader, Flash, Badge, EmptyState } from "@/components/admin/ui";
import { listDeletedSites } from "@/lib/db/sites";
import { deletionQueueStats } from "@/lib/db/deletions";
import { CATEGORY_LABELS } from "@/lib/types";
import { daysBetween, todayIso } from "@/lib/billing";
import { PURGE_AFTER_DAYS } from "@/app/api/cron/_lib/schedule";
import { restoreSiteAction } from "./actions";

/**
 * The recycle bin: every site waiting out its thirty days, with how long is left, and a way back.
 *
 * Before soft delete there was nothing to show here — deletion was an immediate cascade through rows,
 * storage objects and Vercel registrations, with no R2 versioning and no per-tenant export to restore
 * from, so one mis-click ended a customer. The queue counter at the top is the other half of that story:
 * the external cleanup that used to be swallowed by `.catch(() => undefined)` is now a row somebody can
 * see, including the rows that keep failing.
 */
export default async function DeletedSitesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const [sites, queue] = await Promise.all([listDeletedSites(), deletionQueueStats()]);
  const today = todayIso();

  return (
    <SuperPanel ctx={ctx} active="deleted">
      <PageHeader title={t("deleted_sites")} subtitle={`${sites.length}`} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} translate={superError(t)} />
      <p className="mb-4 text-sm leading-relaxed text-slate-600">{t("deleted_sites_hint")}</p>

      {(queue.pending > 0 || queue.failing > 0) && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <b>{queue.pending}</b> {t("purge_overdue")}
          {queue.failing > 0 && <span className="ms-2 font-bold text-red-700">({queue.failing} ✕)</span>}
        </div>
      )}

      {sites.length === 0 ? (
        <EmptyState title={t("no_deleted_sites")} />
      ) : (
        <ul className="grid gap-3">
          {sites.map((s) => {
            // `deletedAt` is a timestamp; the purge window is counted in whole calendar days from its date.
            const deletedDay = s.deletedAt ? s.deletedAt.slice(0, 10) : today;
            const daysLeft = PURGE_AFTER_DAYS - daysBetween(deletedDay, today);
            return (
              <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-slate-900">{s.name}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500" dir="ltr">
                      {s.slug}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone="violet">{CATEGORY_LABELS[s.category][locale]}</Badge>
                      <Badge tone="slate">
                        {t("deleted_at")} {deletedDay}
                      </Badge>
                      {daysLeft > 0 ? (
                        <Badge tone="amber">
                          {t("purge_in_days")} {daysLeft} {t("days_left")}
                        </Badge>
                      ) : (
                        <Badge tone="red">{t("purge_overdue")}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Card className="mt-3 border-slate-100 bg-slate-50 p-3 shadow-none sm:p-4">
                  <form action={restoreSiteAction.bind(null, s.id)}>
                    <TypedConfirm expected={s.slug} hint={t("type_to_confirm_hint")} placeholderLabel={t("type_to_confirm")} pendingText={t("saving")} tone="neutral">
                      {t("restore")}
                    </TypedConfirm>
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
