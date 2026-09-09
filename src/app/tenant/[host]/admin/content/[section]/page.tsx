import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, SaveBar, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FlatFields, ListEditor } from "../../_components/editors";
import { isContentSection, SPECS } from "../_lib/spec";
import { saveSection } from "./actions";
import { getTemplate } from "@/templates/registry";
import { FONTS, FONT_KEYS } from "@/templates/fonts";

export default async function ContentSectionPage({ params, searchParams }: { params: Promise<{ host: string; section: string }>; searchParams: SearchParams }) {
  const { host, section } = await params;
  const sp = await searchParams;
  if (!isContentSection(section)) notFound();
  const ctx = await requireSiteAdmin(host);
  const { t, site } = ctx;
  const spec = SPECS[section];
  const action = saveSection.bind(null, host, section);
  const c = site.content;
  const template = getTemplate(site.templateCode);

  return (
    <Panel ctx={ctx} active="content">
      <BackLink href="/admin/content" label={t("content")} />
      <PageHeader title={t(spec.title)} subtitle={t(spec.hint)} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} />
      <form action={action}>
        {section === "theme" ? (
          <Card>
            <p className="mb-4 text-sm text-slate-600">{t("theme_colors_hint")}</p>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-bold">{t("template")}:</span> {template ? `${template.code} — ${template.name[ctx.locale]}` : site.templateCode}
              <span className="block text-xs text-slate-500">{t("template_note")}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["primary", "secondary", "accent"] as const).map((k) => {
                const custom = c.theme[k] && /^#[0-9a-f]{6}$/i.test(c.theme[k]!);
                const label = k === "primary" ? t("primary_color") : k === "secondary" ? t("secondary_color") : t("accent_color");
                return (
                  <div key={k} className="rounded-xl border border-slate-200 p-3">
                    <Field label={label}>
                      <div className="flex items-center gap-3">
                        <input type="color" name={k} defaultValue={custom ? c.theme[k] : (template?.tokens[k] ?? "#000000")} className="h-11 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
                        <span className="font-mono text-xs text-slate-500" dir="ltr">
                          {template?.tokens[k]}
                        </span>
                      </div>
                    </Field>
                    <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input type="checkbox" name={`${k}_default`} defaultChecked={!custom} className="h-4 w-4" />
                      {t("template_default")}
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(["headingFont", "bodyFont"] as const).map((k) => (
                <Field key={k} label={k === "headingFont" ? t("heading_font") : t("body_font")}>
                  <Select name={k} defaultValue={c.theme[k] ?? ""}>
                    <option value="">
                      {t("template_default")} ({template ? FONTS[template.tokens[k]].family : ""})
                    </option>
                    {FONT_KEYS.map((f) => (
                      <option key={f} value={f}>
                        {FONTS[f].family}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </Card>
        ) : section === "sections" ? (
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["about", "services", "stats", "process", "testimonials", "faq", "cta"] as const).map((k) => (
                <Toggle key={k} name={k} defaultChecked={c.sections[k]} label={t(k)} hint={t("enabled_on_site")} />
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {t("projects")}: <a href="/admin/projects" className="font-bold text-emerald-700 underline">{t("edit")}</a>
            </p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {spec.fields.length > 0 && (
              <Card title={spec.list ? t("section_header") : undefined}>
                <FlatFields spec={spec} content={c} t={t} siteId={site.id} />
              </Card>
            )}
            {spec.list && (
              <Card title={t(spec.title)}>
                <ListEditor spec={spec} content={c} t={t} siteId={site.id} />
              </Card>
            )}
            {section === "general" && <input type="hidden" name="_section" value="general" />}
          </div>
        )}
        <SaveBar>
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[160px]">
            {t("save")}
          </SubmitButton>
        </SaveBar>
      </form>
    </Panel>
  );
}
