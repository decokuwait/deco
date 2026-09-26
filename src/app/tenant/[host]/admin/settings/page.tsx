import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel, dirtyLabels } from "../_components/Panel";
import { DirtyGuard } from "@/components/admin/DirtyGuard";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { getTemplate, templatesFor } from "@/templates/registry";
import { rootUrl, siteUrl } from "@/lib/config";
import { changePassword, saveSettings, switchTemplate } from "./actions";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, user, locale } = ctx;
  const s = site.content.settings;
  const template = getTemplate(site.templateCode);
  const error = sp1(sp.error);
  const save = saveSettings.bind(null, host);
  const pw = changePassword.bind(null, host);

  return (
    <Panel ctx={ctx} active="settings">
      <PageHeader title={t("settings")} subtitle={`${t("signed_in_as")} ${user.email}`} />
      <Flash saved={sp1(sp.saved)} error={error} savedText={t("saved")} errorText={t("error")} locale={locale} />
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
            <div className="flex flex-wrap items-center gap-3">
              {/* Not the password form below: warning someone away from a half-typed password field is
                  noise, and there is nothing there worth keeping. */}
              <DirtyGuard labels={dirtyLabels(t)} />
              <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
            </div>
          </form>
        </Card>
        <Card title={t("choose_template")}>
          <p className="mb-3 text-sm text-slate-600">{t("template_switch_hint")}</p>
          <form action={switchTemplate.bind(null, host)} className="grid gap-3">
            <Field label={t("template")}>
              <Select name="template" defaultValue={site.templateCode}>
                {templatesFor(site.category).map((tpl) => (
                  <option key={tpl.code} value={tpl.code}>
                    {tpl.code} — {tpl.name[locale]} · {tpl.description[locale]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
              <a href={siteUrl(host)} className="text-sm font-bold text-emerald-700 underline" target="_blank" rel="noreferrer">
                {t("open_site")} ↗
              </a>
              {template && (
                <a href={`${rootUrl(`/template/${template.code}`)}`} className="text-sm font-bold text-slate-600 underline" target="_blank" rel="noreferrer">
                  {t("preview")} ↗
                </a>
              )}
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
