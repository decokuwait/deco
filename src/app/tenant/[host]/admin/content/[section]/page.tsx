import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, SaveBar, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Select, Toggle } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FlatFields, ListEditor } from "../../_components/editors";
import { isContentSection, SPECS } from "../_lib/spec";
import { moveSection, resetOrder, resetTheme, saveSection } from "./actions";
import { ColorPick } from "./ColorPick";
import { ContrastCheck } from "./ContrastCheck";
import { HoursEditor } from "./HoursEditor";
import { HOURS_DAYS, HOURS_DAY_LABELS, spreadHours, type HoursDay } from "../_lib/hours";
import { contentVersion, VERSION_FIELD } from "../../_lib/version";
import { siteUrl } from "@/lib/config";
import { getTemplate } from "@/templates/registry";
import { FONTS, FONT_KEYS } from "@/templates/fonts";
import { PATTERN_KEYS } from "@/templates/decor/patterns";
import { DEFAULT_ORDER, type SectionKey } from "@/templates/types";
import type { AdminUiKey } from "@/lib/i18n/admin";

const RADII = ["none", "sm", "md", "lg", "xl", "full"];
const BUTTONS = ["solid", "outline", "pill", "square", "glow", "underline"];
const SECTION_LABEL: Record<SectionKey, AdminUiKey> = {
  hero: "hero",
  about: "about",
  services: "services",
  stats: "stats",
  process: "process",
  finished: "finished",
  beforeAfter: "before_after",
  progress: "progress",
  testimonials: "testimonials",
  faq: "faq",
  cta: "cta",
  contact: "contact",
};

export default async function ContentSectionPage({ params, searchParams }: { params: Promise<{ host: string; section: string }>; searchParams: SearchParams }) {
  const { host, section } = await params;
  const sp = await searchParams;
  if (!isContentSection(section)) notFound();
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const spec = SPECS[section];
  const action = saveSection.bind(null, host, section);
  const c = site.content;
  const template = getTemplate(site.templateCode);
  const error = sp1(sp.error);
  // A list section labels its flat fields "section header"; `general` has a list (areas served) but its
  // flat fields are the whole contact card, so it opts out with `flatTitle: null`.
  const flatTitle = spec.flatTitle === null ? undefined : (spec.flatTitle ?? (spec.list ? ("section_header" as const) : undefined));
  const currentOrder: SectionKey[] = (() => {
    const custom = (c.sections.order || []).filter((k): k is SectionKey => (DEFAULT_ORDER as string[]).includes(k));
    if (custom.length === DEFAULT_ORDER.length && new Set(custom).size === DEFAULT_ORDER.length) return custom;
    return template?.layout.order ?? DEFAULT_ORDER;
  })();

  return (
    <Panel ctx={ctx} active="content">
      <BackLink href="/admin/content" label={t("content")} />
      <PageHeader
        title={t(spec.title)}
        subtitle={t(spec.hint)}
        actions={
          // A theme or a headline is only judged on the site itself; without this the owner saves and
          // guesses. `noreferrer` keeps the panel out of the tenant site's referrer log.
          <a
            href={siteUrl(host)}
            target="_blank"
            rel="noreferrer"
            title={t("view_my_site_hint")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            {t("view_my_site")} ↗
          </a>
        }
      />
      <Flash saved={sp1(sp.saved)} error={error} savedText={t("saved")} errorText={t("error")} locale={locale} />
      {section === "sections" && (
        <Card title={t("section_order")} className="mb-5">
          <p className="mb-3 text-sm text-slate-600">{t("section_order_hint")}</p>
          <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {currentOrder.map((key, i) => (
              <li key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">{i + 1}</span>
                  {t(SECTION_LABEL[key])}
                </span>
                <span className="flex gap-1">
                  <form action={moveSection.bind(null, host, currentOrder, key, "up")}>
                    <button type="submit" disabled={i === 0} aria-label={t("move_up")} className="min-h-10 min-w-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-bold disabled:opacity-40">
                      ↑
                    </button>
                  </form>
                  <form action={moveSection.bind(null, host, currentOrder, key, "down")}>
                    <button type="submit" disabled={i === currentOrder.length - 1} aria-label={t("move_down")} className="min-h-10 min-w-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-bold disabled:opacity-40">
                      ↓
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ol>
          {c.sections.order?.length > 0 && (
            <form action={resetOrder.bind(null, host)} className="mt-3">
              <SubmitButton variant="ghost" pendingText={t("saving")} className="text-xs">
                {t("reset_order")}
              </SubmitButton>
            </form>
          )}
        </Card>
      )}
      <form action={action}>
        {/* What this form was built from. The action refuses a save whose version is not the current one,
            which is the only place a second tab's silent overwrite can be caught — see _lib/version.ts. */}
        <input type="hidden" name={VERSION_FIELD} value={contentVersion(c)} />
        {section === "theme" ? (
          <Card>
            <p className="mb-4 text-sm text-slate-600">{t("theme_colors_hint")}</p>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <span className="font-bold">{t("template")}:</span> {template ? `${template.code} — ${template.name[ctx.locale]}` : site.templateCode}
              <span className="block text-xs text-slate-500">{t("template_switch_hint")}</span>
              <Link href="/admin/settings" className="mt-1 inline-block text-xs font-bold text-emerald-700 underline">
                {t("choose_template")}
              </Link>
            </div>
            <ContrastCheck
              labels={{
                title: t("contrast_title"),
                ok: t("contrast_ok"),
                warning: t("contrast_warn"),
                fgText: t("contrast_fg_text"),
                fgPrimary: t("contrast_fg_primary"),
                fgAccent: t("contrast_fg_accent"),
                onBg: t("contrast_on_bg"),
                onSurface: t("contrast_on_surface"),
              }}
              fallback={{
                primary: template?.tokens.primary ?? "#0f766e",
                accent: template?.tokens.accent ?? "#d4a017",
                bg: template?.tokens.bg ?? "#ffffff",
                surface: template?.tokens.surface ?? template?.tokens.bg ?? "#ffffff",
                text: template?.tokens.text ?? "#0f172a",
              }}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {(["primary", "secondary", "accent", "bg", "surface", "text"] as const).map((k) => {
                const labelKey: AdminUiKey = k === "primary" ? "primary_color" : k === "secondary" ? "secondary_color" : k === "accent" ? "accent_color" : k === "bg" ? "background_color" : k === "surface" ? "surface_color" : "text_color";
                return <ColorPick key={k} name={k} label={t(labelKey)} templateValue={template?.tokens[k] ?? "#000000"} value={c.theme[k] && /^#[0-9a-f]{6}$/i.test(c.theme[k]!) ? c.theme[k]! : ""} customLabel={t("custom_color")} />;
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
              <Field label={t("radius")}>
                <Select name="radius" defaultValue={c.theme.radius ?? ""}>
                  <option value="">
                    {t("template_default")} ({template?.tokens.radius})
                  </option>
                  {RADII.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("button_style")}>
                <Select name="buttonStyle" defaultValue={c.theme.buttonStyle ?? ""}>
                  <option value="">
                    {t("template_default")} ({template?.tokens.buttonStyle})
                  </option>
                  {BUTTONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("pattern")}>
                <Select name="pattern" defaultValue={c.theme.pattern ?? ""}>
                  <option value="">
                    {t("template_default")} ({template?.tokens.pattern})
                  </option>
                  {PATTERN_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-5">
              <SubmitButton variant="ghost" formAction={resetTheme.bind(null, host)} pendingText={t("saving")} className="text-xs">
                {t("reset_theme")}
              </SubmitButton>
            </div>
          </Card>
        ) : section === "sections" ? (
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["about", "services", "stats", "process", "testimonials", "faq", "cta"] as const).map((k) => (
                <Toggle key={k} name={k} defaultChecked={c.sections[k]} label={t(k)} hint={t("enabled_on_site")} />
              ))}
            </div>
            <input type="hidden" name="order" value={(c.sections.order || []).join(",")} />
            <p className="mt-4 text-xs text-slate-500">
              {t("projects")}: <Link href="/admin/projects" className="font-bold text-emerald-700 underline">{t("edit")}</Link>
            </p>
          </Card>
        ) : (
          <div className="grid gap-5">
            {spec.fields.length > 0 && (
              <Card title={flatTitle ? t(flatTitle) : undefined}>
                <FlatFields spec={spec} content={c} t={t} siteId={site.id} />
              </Card>
            )}
            {section === "general" && (
              <Card title={t("hours_spec")}>
                <p className="mb-3 text-sm text-slate-600">{t("hours_spec_hint")}</p>
                <HoursEditor
                  value={spreadHours(c.contact.hoursSpec)}
                  labels={{
                    days: Object.fromEntries(HOURS_DAYS.map((d) => [d, t(HOURS_DAY_LABELS[d])])) as Record<HoursDay, string>,
                    closed: t("closed_day"),
                    shiftOne: t("shift_one"),
                    shiftTwo: t("shift_two"),
                    from: t("opens_at"),
                    to: t("closes_at"),
                    applyAll: t("copy_to_all_days"),
                  }}
                />
              </Card>
            )}
            {spec.list && (
              <Card title={t(spec.listTitle ?? spec.title)}>
                {spec.listTitle === "areas_served" && <p className="mb-3 text-sm text-slate-600">{t("areas_served_hint")}</p>}
                <ListEditor spec={spec} content={c} t={t} siteId={site.id} />
              </Card>
            )}
          </div>
        )}
        <SaveBar t={t} back={{ href: "/admin/content", label: t("content") }}>
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[160px]">
            {t("save")}
          </SubmitButton>
        </SaveBar>
      </form>
    </Panel>
  );
}
