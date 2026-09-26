import { requireSiteAdmin, sp1, type SearchParams } from "../_lib/guard";
import { Panel } from "../_components/Panel";
import { Card, PageHeader, Flash, Toggle, BilingualInput, Badge, LinkButton, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { listProjects } from "@/lib/db/projects";
import { PROJECT_TYPES, type ProjectType } from "@/lib/types";
import { deleteProjectAction, moveProjectAction, saveProjectType, togglePublished } from "./actions";

const KEY: Record<ProjectType, "finished" | "beforeAfter" | "progress"> = { finished: "finished", before_after: "beforeAfter", progress: "progress" };
const LABEL: Record<ProjectType, "finished" | "before_after" | "progress"> = { finished: "finished", before_after: "before_after", progress: "progress" };
const HINT: Record<ProjectType, "finished_hint" | "before_after_hint" | "progress_hint"> = { finished: "finished_hint", before_after: "before_after_hint", progress: "progress_hint" };

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const all = await listProjects(site.id);
  const pc = site.content.projects;

  return (
    <Panel ctx={ctx} active="projects">
      <PageHeader title={t("projects")} subtitle={t("enabled_hint")} />
      <Flash saved={sp1(sp.saved)} error={sp1(sp.error)} savedText={t("saved")} errorText={t("error")} locale={locale} />
      <div className="grid gap-6">
        {PROJECT_TYPES.map((type) => {
          const cfg = pc[KEY[type]];
          const items = all.filter((p) => p.type === type);
          const save = saveProjectType.bind(null, host, type);
          return (
            <Card
              key={type}
              title={
                <span className="flex items-center gap-2">
                  {t(LABEL[type])}
                  <Badge tone={cfg.enabled ? "green" : "slate"}>{cfg.enabled ? t("active") : t("inactive")}</Badge>
                  <Badge tone="blue">{items.length}</Badge>
                </span>
              }
              actions={
                <LinkButton href={`/admin/projects/new?type=${type}`} variant="primary">
                  + {t("new_project")}
                </LinkButton>
              }
            >
              <p className="mb-4 text-sm text-slate-600">{t(HINT[type])}</p>
              <form action={save} className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Toggle name="enabled" defaultChecked={cfg.enabled} label={t("enabled_on_site")} hint={t("enabled_hint")} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <BilingualInput name="title" value={cfg.title} label={t("section_header")} />
                  <BilingualInput name="subtitle" value={cfg.subtitle} label={t("subtitle")} />
                </div>
                {type === "finished" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <BilingualInput name="sectionTitle" value={pc.title} label={`${t("projects")} — ${t("section_header")}`} />
                    <BilingualInput name="sectionSubtitle" value={pc.subtitle} label={`${t("projects")} — ${t("subtitle")}`} />
                  </div>
                )}
                {type !== "finished" && (
                  <>
                    <input type="hidden" name="sectionTitle.ar" value={pc.title.ar} />
                    <input type="hidden" name="sectionTitle.en" value={pc.title.en} />
                    <input type="hidden" name="sectionSubtitle.ar" value={pc.subtitle.ar} />
                    <input type="hidden" name="sectionSubtitle.en" value={pc.subtitle.en} />
                  </>
                )}
                <div>
                  <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
                </div>
              </form>

              {items.length === 0 ? (
                <EmptyState title={t("no_projects")} action={<LinkButton href={`/admin/projects/new?type=${type}`} variant="primary">{t("new_project")}</LinkButton>} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((p, i) => (
                    <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      <a href={`/admin/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {p.coverUrl || p.media[0] ? (
                          <img src={p.coverUrl || p.media[0].posterUrl || p.media[0].url} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="h-16 w-20 shrink-0 rounded-lg bg-slate-100" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-slate-900">{p.title[locale] || p.title.ar || p.title.en}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <Badge tone={p.published ? "green" : "amber"}>{p.published ? t("published") : t("draft")}</Badge>
                            {type === "before_after" && !(p.media.some((m) => m.role === "before") && p.media.some((m) => m.role === "after")) && <Badge tone="red">{t("incomplete_before_after")}</Badge>}
                            {type === "progress" && !p.media.some((m) => m.role === "step") && <Badge tone="red">{t("no_steps")}</Badge>}
                            <span>
                              {p.media.length} {t("media")}
                            </span>
                            {p.location && (p.location.ar || p.location.en) && <span>· {p.location[locale] || p.location.ar}</span>}
                          </span>
                        </span>
                      </a>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <form action={moveProjectAction.bind(null, host, p.id, "up")}>
                          <button type="submit" disabled={i === 0} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">
                            ↑
                          </button>
                        </form>
                        <form action={moveProjectAction.bind(null, host, p.id, "down")}>
                          <button type="submit" disabled={i === items.length - 1} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">
                            ↓
                          </button>
                        </form>
                        <form action={togglePublished.bind(null, host, p.id, !p.published)}>
                          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold">
                            {p.published ? t("draft") : t("published")}
                          </button>
                        </form>
                        <LinkButton href={`/admin/projects/${p.id}`} className="px-2.5 py-1.5 text-xs">
                          {t("edit")}
                        </LinkButton>
                        <form action={deleteProjectAction.bind(null, host, p.id)}>
                          <ConfirmButton
                            message={t("confirm_delete_project")}
                            detail={p.title[locale] || p.title.ar || p.title.en}
                            labels={{ title: t("confirm_title"), confirm: t("delete"), cancel: t("cancel") }}
                            // Deleting a project with photos also deletes the files; typing its name is
                            // the difference between a decision and a mis-tap on a phone.
                            requireText={p.media.length > 0 ? p.title[locale] || p.title.ar || p.title.en : undefined}
                            requireHint={t("type_name_to_confirm")}
                          >
                            {t("delete")}
                          </ConfirmButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}
