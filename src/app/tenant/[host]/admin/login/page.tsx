import { notFound, redirect } from "next/navigation";
import { getRequestSite } from "@/lib/site-request";
import { getSiteAccess } from "@/lib/auth/session";
import { getAdminLocale } from "@/components/admin/admin-locale";
import { ta } from "@/lib/i18n/admin";
import { AdminLangToggle } from "@/components/admin/AdminLangToggle";
import { Field, Input } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { loginAction } from "./actions";
import { sp1, type SearchParams } from "../_lib/guard";

export default async function LoginPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const site = await getRequestSite(host);
  if (!site) notFound();
  // Already signed in with access: go straight to the dashboard.
  if (await getSiteAccess(site.id)) redirect("/admin");

  const locale = await getAdminLocale();
  const t = (k: Parameters<typeof ta>[1]) => ta(locale, k);
  const error = sp1(sp.error);
  const changed = sp1(sp.changed);
  const errorText = error === "no_access" ? t("no_access") : error === "invalid" ? t("invalid_login") : error ? t("error") : "";
  const action = loginAction.bind(null, host);

  return (
    <div className="admin flex min-h-dvh flex-col" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <div className="flex items-center justify-end px-4 py-3">
        <AdminLangToggle locale={locale} />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
              {site.name.slice(0, 1).toUpperCase()}
            </div>
            <h1 className="text-2xl font-black text-slate-900">{site.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("admin_panel")} · <span dir="ltr">{host}</span>
            </p>
          </div>
          <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm text-slate-600">{t("login_hint")}</p>
            {errorText && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{errorText}</div>}
            {changed && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{t("password_changed")}</div>}
            <div className="flex flex-col gap-4">
              <Field label={t("email")}>
                <Input name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" required autoFocus />
              </Field>
              <Field label={t("password")}>
                <Input name="password" type="password" autoComplete="current-password" dir="ltr" required />
              </Field>
              <SubmitButton pendingText={t("logging_in")} className="w-full py-3 text-base">
                {t("login")}
              </SubmitButton>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
