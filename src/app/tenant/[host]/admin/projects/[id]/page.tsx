import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, SaveBar, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle, BilingualInput, Badge, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Uploader } from "@/components/admin/Uploader";
import { uploadErrorLabels } from "@/lib/i18n/admin";
import { getProject } from "@/lib/db/projects";
import type { MediaRole, ProjectType } from "@/lib/types";
import { addMediaAction, deleteProjectAction, saveMediaAction, saveProject } from "./actions";

const LABEL: Record<ProjectType, "finished" | "before_after" | "progress"> = { finished: "finished", before_after: "before_after", progress: "progress" };
const HINT: Record<ProjectType, "finished_hint" | "before_after_hint" | "progress_hint"> = { finished: "finished_hint", before_after: "before_after_hint", progress: "progress_hint" };

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ host: string; id: string }>; searchParams: SearchParams }) {
  const { host, id } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const project = await getProject(id);
  if (!project || project.siteId !== site.id) notFound();
  const save = saveProject.bind(null, host, id);
  const addMedia = addMediaAction.bind(null, host, id);
  const del = deleteProjectAction.bind(null, host, id);
  const roleLabel = (r: MediaRole) => (r === "gallery" ? t("gallery") : r === "before" ? t("before") : r === "after" ? t("after") : t("step"));
  // Only roles that make sense for the project type are offered.
  const roles: MediaRole[] = project.type === "progress" ? ["step"] : project.type === "before_after" ? ["before", "after"] : ["gallery"];
  const isProgress = project.type === "progress";
  const defaultRole: MediaRole = project.type === "progress" ? "step" : project.type === "before_after" ? (project.media.some((m) => m.role === "before") ? "after" : "before") : "gallery";
  const hasBefore = project.media.some((m) => m.role === "before");
  const hasAfter = project.media.some((m) => m.role === "after");
  const warning = project.type === "before_after" && !(hasBefore && hasAfter) ? t("incomplete_before_after") : project.type === "progress" && !project.media.some((m) => m.role === "step") ? t("no_steps") : "";
  const error = sp1(sp.error);

  return (
    <Panel ctx={ctx} active="projects">
      <BackLink href="/admin/projects" label={t("projects")} />
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("edit_project")} <Badge tone="violet">{t(LABEL[project.type])}</Badge>
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {t(HINT[project.type])}
            {warning && <Badge tone="amber">{warning}</Badge>}
          </span>
        }
        actions={
          <form action={del}>
            <ConfirmButton message={t("confirm_delete")}>{t("delete")}</ConfirmButton>
          </form>
        }
      />
      <Flash saved={sp1(sp.saved)} error={error} savedText={t("saved")} errorText={t("error")} locale={locale} />

      <form action={save}>
        <Card title={t("title")}>
          <div className="grid gap-4">
            <BilingualInput name="title" value={project.title} label={t("title")} required />
            <BilingualInput name="description" value={project.description} label={t("description")} textarea />
            <BilingualInput name="location" value={project.location ?? null} label={t("location")} />
            <Field label={t("cover")}>
              <Uploader name="coverUrl" siteId={site.id} value={project.coverUrl ?? ""} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
            </Field>
            <Toggle name="published" defaultChecked={project.published} label={t("published")} hint={t("published_hint")} />
          </div>
        </Card>
        <SaveBar>
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[160px]">
            {t("save")}
          </SubmitButton>
        </SaveBar>
      </form>

      <div id="media" className="mt-8">
        <Card title={`${t("media")} (${project.media.length})`}>
          <p className="mb-4 text-sm text-slate-600">{t("media_upload_hint")}</p>
          {project.media.length === 0 ? (
            <EmptyState title={t("media_empty")} />
          ) : (
            <ul className="grid gap-4">
              {project.media.map((m, i) => {
                const act = saveMediaAction.bind(null, host, id, m.id);
                return (
                  <li key={m.id}>
                    <form action={act} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[112px_1fr]">
                      <div>
                        {m.kind === "video" ? (
                          <video src={m.url} poster={m.posterUrl || undefined} className="h-24 w-28 rounded-lg bg-black object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <img src={m.url} alt="" className="h-24 w-28 rounded-lg object-cover" />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge tone={m.kind === "video" ? "violet" : "blue"}>{m.kind === "video" ? t("video") : t("image")}</Badge>
                          <Badge tone="slate">#{i + 1}</Badge>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label={t("role")}>
                            <Select name="role" defaultValue={roles.includes(m.role) ? m.role : roles[0]}>
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          {isProgress && (
                            <Field label={t("step_date")}>
                              <Input name="stepDate" type="date" defaultValue={m.stepDate ?? ""} dir="ltr" />
                            </Field>
                          )}
                          {m.kind === "video" && (
                            <Field label={t("poster")}>
                              <Uploader name="posterUrl" siteId={site.id} value={m.posterUrl ?? ""} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
                            </Field>
                          )}
                        </div>
                        {isProgress && <BilingualInput name="stepLabel" value={m.stepLabel ?? null} label={t("step_label")} />}
                        <BilingualInput name="caption" value={m.caption ?? null} label={t("caption")} />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SubmitButton pendingText={t("saving")} className="px-3 py-1.5 text-xs">
                            {t("save")}
                          </SubmitButton>
                          <button type="submit" name="op" value="up" disabled={i === 0} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">
                            ↑ {t("move_up")}
                          </button>
                          <button type="submit" name="op" value="down" disabled={i === project.media.length - 1} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold disabled:opacity-40">
                            ↓ {t("move_down")}
                          </button>
                          <button type="submit" name="op" value="delete" className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700">
                            {t("delete")}
                          </button>
                        </div>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`+ ${t("add_media")}`} className="mt-5">
          <form action={addMedia} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("image")}>
                <Uploader name="imageUrl" siteId={site.id} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
              </Field>
              <Field label={t("video")} hint={t("poster")}>
                <Uploader name="videoUrl" siteId={site.id} kind="video" accept="video/*" label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("poster")} hint={t("optional")}>
                <Uploader name="posterUrl" siteId={site.id} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
              </Field>
              <div className="grid gap-3">
                <Field label={t("role")}>
                  <Select name="role" defaultValue={defaultRole}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {isProgress && (
                  <Field label={t("step_date")}>
                    <Input name="stepDate" type="date" dir="ltr" />
                  </Field>
                )}
              </div>
            </div>
            {isProgress && <BilingualInput name="stepLabel" label={t("step_label")} placeholderAr={locale === "ar" ? "اليوم الأول" : undefined} placeholderEn="Day 1" />}
            <BilingualInput name="caption" label={t("caption")} />
            <div>
              <SubmitButton pendingText={t("saving")}>{t("add")}</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </Panel>
  );
}
