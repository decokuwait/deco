import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getTemplate } from "@/templates/registry";
import { siteUrl } from "@/lib/config";
import { changePassword, saveSettings } from "./actions";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, user, locale } = ctx;
  const s = site.content.settings;
  const template = getTemplate(site.templateCode);
  const error = sp1(sp.error);
  const errorText = error === "password_short" ? t("password_short") : error === "password_mismatch" ? t("password_mismatch") : error === "invalid_login" ? t("invalid_login") : error;
  const save = saveSettings.bind(null, host);
  const pw = changePassword.bind(null, host);

  return (
    <Panel ctx={ctx} active="settings">
      <PageHeader title={t("settings")} subtitle={`${t("signed_in_as")} ${user.email}`} />
      <Flash saved={sp1(sp.saved)} error={errorText} savedText={t("saved")} errorText={t("error")} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("site_settings")}>
          <form action={save} className="grid gap-3">
            <Field label={t("default_language")}>
              <Select name="defaultLocale" defaultValue={s.defaultLocale}>
                <option value="ar">{t("arabic")}</option>
                <option value="en">{t("english")}</option>
              </Select>
            </Field>
            <Toggle name="showLangToggle" defaultChecked={s.showLangToggle} label={t("show_lang_toggle")} />
            <Toggle name="floatingWhatsapp" defaultChecked={s.floatingWhatsapp} label={t("floating_whatsapp")} />
            <Toggle name="showVisitorId" defaultChecked={s.showVisitorId} label={t("show_visitor_id")} hint={t("whatsapp_id_hint")} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <span className="font-bold">{t("template")}:</span> {template ? `${template.code} — ${template.name[locale]}` : site.templateCode}
              </div>
              <div className="text-xs text-slate-500">{t("template_note")}</div>
              <div className="mt-2">
                <a href={siteUrl(host)} className="font-bold text-emerald-700 underline" target="_blank" rel="noreferrer">
                  {t("open_site")} ↗
                </a>
              </div>
            </div>
            <div>
              <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
            </div>
          </form>
        </Card>
        <Card title={t("change_password")}>
          <form action={pw} className="grid gap-3">
            <Field label={t("password")}>
              <Input name="current" type="password" autoComplete="current-password" dir="ltr" required />
            </Field>
            <Field label={t("new_password")} hint={t("password_short")}>
              <Input name="password" type="password" autoComplete="new-password" dir="ltr" required minLength={8} />
            </Field>
            <Field label={t("confirm_password")}>
              <Input name="confirm" type="password" autoComplete="new-password" dir="ltr" required minLength={8} />
            </Field>
            <div>
              <SubmitButton variant="secondary" pendingText={t("saving")}>
                {t("change_password")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </Panel>
  );
}
