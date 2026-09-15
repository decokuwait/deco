import { redirect } from "next/navigation";
import { getSuperAccess } from "@/lib/auth/session";
import { getAdminLocale } from "@/components/admin/admin-locale";
import { ts, type SuperUiKey } from "@/lib/i18n/super";
import { AdminLangToggle } from "@/components/admin/AdminLangToggle";
import { Field, Input } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { superLogin } from "./actions";
import { sp1, type SearchParams } from "../_lib/guard";
import { APP_NAME } from "@/lib/config";

/** `?error=` codes produced by superLogin; anything else reads as invalid credentials. */
const LOGIN_ERRORS: Record<string, SuperUiKey> = {
  not_super: "not_super",
  too_many: "too_many",
  bootstrap: "bootstrap",
  db_config: "db_config",
  db_unreachable: "db_unreachable",
  db_auth: "db_auth",
  db_schema: "db_schema",
  server: "server_error",
};

export default async function SuperLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  if (await getSuperAccess()) redirect("/super");
  const locale = await getAdminLocale();
  const t = (k: Parameters<typeof ts>[1]) => ts(locale, k);
  const error = sp1(sp.error);
  const errorText = error ? t(LOGIN_ERRORS[error] ?? "invalid_login") : "";
  return (
    <div className="admin flex min-h-dvh flex-col" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <div className="flex items-center justify-between px-4 py-3">
        <a href="/" className="text-sm font-black text-slate-700">
          {APP_NAME}
        </a>
        <AdminLangToggle locale={locale} />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-amber-400">S</div>
            <h1 className="text-2xl font-black text-slate-900">{t("title")}</h1>
          </div>
          <form action={superLogin} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {errorText && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{errorText}</div>}
            <div className="flex flex-col gap-4">
              <Field label={t("email")}>
                <Input name="email" type="email" autoComplete="email" dir="ltr" required autoFocus />
              </Field>
              <Field label={t("password")}>
                <Input name="password" type="password" autoComplete="current-password" dir="ltr" required />
              </Field>
              <SubmitButton variant="secondary" pendingText="..." className="w-full py-3 text-base">
                {t("login")}
              </SubmitButton>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">{t("login_hint")}</p>
          </form>
        </div>
      </main>
    </div>
  );
}
