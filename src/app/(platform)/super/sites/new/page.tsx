import { requireSuper, sp1, type SearchParams } from "../../_lib/guard";
import { SuperPanel, TemplatePicker } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { getTemplate } from "@/templates/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import { createSiteAction } from "./actions";
import type { SuperUiKey } from "@/lib/i18n/super";

export default async function NewSitePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const catRaw = sp1(sp.cat);
  const preset = getTemplate(sp1(sp.template));
  const category: Category | undefined = (CATEGORIES as string[]).includes(catRaw) ? (catRaw as Category) : preset?.category;
  const error = sp1(sp.error);
  const known: SuperUiKey[] = ["required", "invalid_slug", "slug_taken", "invalid_domain", "password_short", "invalid_template", "template_category_mismatch", "domain_taken"];
  const errorText = (known as string[]).includes(error) ? t(error as SuperUiKey) : error;
  const root = ROOT_DOMAIN.replace(/:\d+$/, "");

  return (
    <SuperPanel ctx={ctx} active="new">
      <PageHeader title={t("new_site")} />
      <Flash error={errorText} savedText={t("saved")} errorText={t("error")} />
      <form action={createSiteAction} className="grid gap-5">
        <Card title={t("site_name")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("site_name")}>
              <Input name="name" required />
            </Field>
            <Field label={t("category")}>
              <Select name="category" defaultValue={category ?? "gypsum"}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c][locale]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("slug")} hint={`${t("slug_hint")} <slug>.${root}`}>
              <Input name="slug" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" dir="ltr" placeholder="elite-decor" />
            </Field>
            <Field label={t("custom_domain")} hint={t("custom_domain_hint")}>
              <Input name="customDomain" dir="ltr" placeholder="company.com" />
            </Field>
            <Field label={t("whatsapp")}>
              <Input name="whatsapp" dir="ltr" placeholder="96550000000" required />
            </Field>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle name="seedDemo" defaultChecked label={t("seed_demo")} />
            <Toggle name="startPaused" label={t("start_paused")} />
          </div>
        </Card>
        <Card title={t("admin_user")}>
          <p className="mb-3 text-sm text-slate-600">{t("admin_user_hint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin_email")}>
              <Input name="adminEmail" type="email" dir="ltr" />
            </Field>
            <Field label={t("admin_password")}>
              <Input name="adminPassword" type="password" autoComplete="new-password" dir="ltr" />
            </Field>
          </div>
        </Card>
        <Card
          title={t("template")}
          actions={
            <div className="flex flex-wrap gap-1.5 text-xs">
              <a href="/super/sites/new" className={`rounded-full border px-3 py-1 font-bold ${!category ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                {t("all")}
              </a>
              {CATEGORIES.map((c) => (
                <a key={c} href={`/super/sites/new?cat=${c}`} className={`rounded-full border px-3 py-1 font-bold ${category === c ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                  {CATEGORY_LABELS[c][locale]}
                </a>
              ))}
            </div>
          }
        >
          <TemplatePicker name="template" value={preset?.code} category={category} locale={locale} previewLabel={t("preview")} />
        </Card>
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[180px]">
            {t("create")}
          </SubmitButton>
        </div>
      </form>
    </SuperPanel>
  );
}
