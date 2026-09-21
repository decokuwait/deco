import Link from "next/link";
import { requireSuper, sp1, superError, type SearchParams } from "../../_lib/guard";
import { SuperPanel, TemplatePicker } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { getTemplate } from "@/templates/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import { createSiteAction } from "./actions";

export default async function NewSitePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const ctx = await requireSuper();
  const { t, locale } = ctx;
  const catRaw = sp1(sp.cat);
  const preset = getTemplate(sp1(sp.template));
  const category: Category | undefined = (CATEGORIES as string[]).includes(catRaw) ? (catRaw as Category) : preset?.category;
  const error = sp1(sp.error);
  // Values typed before a validation error come back through the query string (never the password).
  const prev = { name: sp1(sp.name), slug: sp1(sp.slug), customDomain: sp1(sp.customDomain), whatsapp: sp1(sp.whatsapp), adminEmail: sp1(sp.adminEmail) };
  const seedDemo = sp1(sp.seedDemo) === "" ? true : sp1(sp.seedDemo) === "1";
  const startPaused = sp1(sp.startPaused) === "1";
  const root = ROOT_DOMAIN.replace(/:\d+$/, "");

  return (
    <SuperPanel ctx={ctx} active="new">
      <PageHeader title={t("new_site")} />
      <Flash error={error} savedText={t("saved")} errorText={t("error")} translate={superError(t)} />
      <form action={createSiteAction} className="grid gap-5">
        <Card title={t("site_name")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("site_name")}>
              <Input name="name" required defaultValue={prev.name} />
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
              <Input name="slug" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" dir="ltr" placeholder="elite-decor" defaultValue={prev.slug} />
            </Field>
            <Field label={t("custom_domain")} hint={t("custom_domain_hint")}>
              <Input name="customDomain" dir="ltr" placeholder="company.com" defaultValue={prev.customDomain} />
            </Field>
            <Field label={t("whatsapp")}>
              <Input name="whatsapp" dir="ltr" placeholder="96550000000" required defaultValue={prev.whatsapp} />
            </Field>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle name="seedDemo" defaultChecked={seedDemo} label={t("seed_demo")} />
            <Toggle name="startPaused" defaultChecked={startPaused} label={t("start_paused")} />
          </div>
        </Card>
        <Card title={t("admin_user")}>
          <p className="mb-3 text-sm text-slate-600">{t("admin_user_hint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("admin_email")}>
              <Input name="adminEmail" type="email" dir="ltr" defaultValue={prev.adminEmail} />
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
              <Link href="/super/sites/new" className={`inline-flex min-h-11 items-center rounded-full border px-3 font-bold ${!category ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                {t("all")}
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c} href={`/super/sites/new?cat=${c}`} className={`inline-flex min-h-11 items-center rounded-full border px-3 font-bold ${category === c ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                  {CATEGORY_LABELS[c][locale]}
                </Link>
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
