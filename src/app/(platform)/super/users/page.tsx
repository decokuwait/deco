import { requireSuper, sp1, superError, type SearchParams } from "../_lib/guard";
import { SuperPanel } from "../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Toggle, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { listUsers } from "@/lib/db/users";
import { createUserAction, deleteUserAction, resetPasswordAction, toggleSuperAction } from "./actions";

function fmt(iso: string | null, locale: "ar" | "en") {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" }).format(new Date(iso));
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale, user: me } = ctx;
  const users = await listUsers();
  const error = sp1(sp.error);
  return (
    <SuperPanel ctx={ctx} active="users">
      <PageHeader title={t("users")} subtitle={`${users.length}`} />
      <Flash saved={sp1(sp.saved)} error={error} savedText={t("saved")} errorText={t("error")} translate={superError(t)} />
      <Card title={t("create_user")} className="mb-5">
        <form action={createUserAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label={t("email")}>
            <Input name="email" type="email" dir="ltr" required />
          </Field>
          <Field label={t("name")}>
            <Input name="name" />
          </Field>
          <Field label={t("password")} hint={t("password_short")}>
            <Input name="password" type="password" autoComplete="new-password" dir="ltr" required minLength={8} />
          </Field>
          <div className="grid gap-2">
            <Toggle name="isSuper" label={t("is_super")} />
            <SubmitButton pendingText={t("saving")}>{t("create")}</SubmitButton>
          </div>
        </form>
      </Card>
      <Card title={t("users")}>
        <ul className="divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="grid gap-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900" dir="ltr">
                    {u.email}
                  </span>
                  {u.isSuper && <Badge tone="amber">{t("is_super")}</Badge>}
                  {u.id === me.id && <Badge tone="green">{t("this_is_you")}</Badge>}
                </div>
                <div className="text-xs text-slate-500">
                  {u.name || ""} · {t("created")}: {fmt(u.createdAt, locale)} · {t("last_login")}: {fmt(u.lastLoginAt, locale)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <form action={resetPasswordAction.bind(null, u.id)} className="flex items-center gap-1.5">
                  <Input name="password" type="password" autoComplete="new-password" dir="ltr" placeholder={t("new_password")} minLength={8} required className="max-w-[180px] py-1.5 text-xs" />
                  <SubmitButton variant="ghost" pendingText="..." className="px-2.5 py-1.5 text-xs">
                    {t("reset_password")}
                  </SubmitButton>
                </form>
                <form action={toggleSuperAction.bind(null, u.id, !u.isSuper)}>
                  <SubmitButton variant="ghost" pendingText="..." className="px-2.5 py-1.5 text-xs">
                    {u.isSuper ? t("revoke_super") : t("make_super")}
                  </SubmitButton>
                </form>
                {u.id !== me.id && (
                  <form action={deleteUserAction.bind(null, u.id)}>
                    <ConfirmButton message={t("confirm_delete")}>{t("delete")}</ConfirmButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </SuperPanel>
  );
}
