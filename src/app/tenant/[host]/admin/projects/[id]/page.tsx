import { notFound } from "next/navigation";
import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, SaveBar, BackLink } from "../../_components/Panel";
import { ReorderRows } from "../../_components/ReorderRows";
import { Card, PageHeader, Flash, Field, Input, Select, Toggle, BilingualInput, Badge, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Uploader } from "@/components/admin/Uploader";
import { uploadErrorLabels } from "@/lib/i18n/admin";
import { getProject } from "@/lib/db/projects";
import { siteUrl } from "@/lib/config";
import type { LText, MediaRole, ProjectType } from "@/lib/types";
import { addMediaAction, deleteProjectAction, saveProject } from "./actions";
import { readFocals } from "./media-db";

const LABEL: Record<ProjectType, "finished" | "before_after" | "progress"> = { finished: "finished", before_after: "before_after", progress: "progress" };
const HINT: Record<ProjectType, "finished_hint" | "before_after_hint" | "progress_hint"> = { finished: "finished_hint", before_after: "before_after_hint", progress: "progress_hint" };
const FOCALS = ["top", "center", "bottom"] as const;

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ host: string; id: string }>; searchParams: SearchParams }) {
  const { host, id } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site, locale } = ctx;
  const project = await getProject(id);
  if (!project || project.siteId !== site.id) notFound();
  const focals = await readFocals(id);
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
  const projectName = project.title[locale] || project.title.ar || project.title.en;
  // What the site will say about a photo the owner leaves undescribed; shown as the placeholder so the
  // field can stay empty without ever producing alt="".
  const generatedAlt = (l: "ar" | "en"): string => [project.title[l] || project.title.ar || project.title.en, project.location?.[l] || ""].filter(Boolean).join(" — ");

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
          <>
            <a
              href={siteUrl(host)}
              target="_blank"
              rel="noreferrer"
              title={t("view_my_site_hint")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              {t("view_my_site")} ↗
            </a>
            <form action={del}>
              <ConfirmButton
                message={t("confirm_delete_project")}
                detail={projectName}
                labels={{ title: t("confirm_title"), confirm: t("delete"), cancel: t("cancel") }}
                // Once a project has photos on it, deleting it also deletes the uploaded files: there is
                // no undo and no copy. That is worth more than one tap, so the owner types its name.
                requireText={project.media.length > 0 ? projectName : undefined}
                requireHint={t("type_name_to_confirm")}
              >
                {t("delete")}
              </ConfirmButton>
            </form>
          </>
        }
      />
      <Flash saved={sp1(sp.saved)} error={error} savedText={t("saved")} errorText={t("error")} locale={locale} />

      {/*
        One form, one Save. The photos used to sit in a form each, with their own button also labelled
        "حفظ": three or four Saves on one screen, each saving something different, is unusable for
        someone who is not a developer. Editing, reordering and removing now all happen here and land in
        a single submit.
      */}
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

        <div id="media" className="mt-5">
          <Card title={`${t("media")} (${project.media.length})`}>
            <p className="mb-4 text-sm text-slate-600">{t("media_upload_hint")}</p>
            <input type="hidden" name="media.count" value={project.media.length} />
            {project.media.length === 0 ? (
              <EmptyState title={t("media_empty")} />
            ) : (
              <ReorderRows
                prefix="media"
                count={project.media.length}
                labels={{ up: t("move_up"), down: t("move_down"), remove: t("remove_media"), undo: t("undo"), willBeDeleted: t("will_be_deleted") }}
              >
                {project.media.map((m, i) => {
                  const prefix = `media.${i}`;
                  return (
                    <div key={m.id} className="grid gap-3 sm:grid-cols-[112px_1fr]">
                      <input type="hidden" name={`${prefix}.id`} value={m.id} />
                      <div>
                        {m.kind === "video" ? (
                          <video src={m.url} poster={m.posterUrl || undefined} className="h-24 w-28 rounded-lg bg-black object-cover" muted playsInline preload="metadata" />
                        ) : (
                          <img src={m.url} alt="" className="h-24 w-28 rounded-lg object-cover" />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge tone={m.kind === "video" ? "violet" : "blue"}>{m.kind === "video" ? t("video") : t("image")}</Badge>
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label={t("role")}>
                            <Select name={`${prefix}.role`} defaultValue={roles.includes(m.role) ? m.role : roles[0]}>
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {roleLabel(r)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          {isProgress && (
                            <Field label={t("step_date")}>
                              <Input name={`${prefix}.stepDate`} type="date" defaultValue={m.stepDate ?? ""} dir="ltr" />
                            </Field>
                          )}
                          {m.kind === "video" && (
                            <Field label={t("poster")}>
                              <Uploader name={`${prefix}.posterUrl`} siteId={site.id} value={m.posterUrl ?? ""} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
                            </Field>
                          )}
                        </div>
                        {m.kind === "image" && (
                          <Field label={t("focal")} hint={t("focal_hint")}>
                            {/* Plain radios: a segmented control that needs no JavaScript and no new state. */}
                            <div className="flex overflow-hidden rounded-xl border border-slate-300">
                              {FOCALS.map((f) => (
                                <label key={f} className="flex-1 cursor-pointer border-e border-slate-200 text-center last:border-e-0 has-[:checked]:bg-emerald-600 has-[:checked]:text-white">
                                  <input type="radio" name={`${prefix}.focal`} value={f} defaultChecked={(focals[m.id] ?? "center") === f} className="sr-only" />
                                  <span className="block px-2 py-2.5 text-xs font-bold">{f === "top" ? t("focal_top") : f === "center" ? t("focal_center") : t("focal_bottom")}</span>
                                </label>
                              ))}
                            </div>
                          </Field>
                        )}
                        {isProgress && <BilingualInput name={`${prefix}.stepLabel`} value={m.stepLabel ?? null} label={t("step_label")} />}
                        <BilingualInput name={`${prefix}.caption`} value={m.caption ?? null} label={t("caption")} />
                        <BilingualInput
                          name={`${prefix}.alt`}
                          value={(m.alt as LText | null) ?? null}
                          label={t("alt_text")}
                          placeholderAr={generatedAlt("ar")}
                          placeholderEn={generatedAlt("en")}
                        />
                        <p className="text-xs text-slate-500">{t("alt_hint")}</p>
                      </div>
                    </div>
                  );
                })}
              </ReorderRows>
            )}
          </Card>
        </div>

        <SaveBar t={t}>
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[180px]">
            {t("save_all")}
          </SubmitButton>
        </SaveBar>
      </form>

      {/* Adding is a separate step with its own verb, so no two buttons on this page say "Save". */}
      <Card title={`+ ${t("add_media")}`} className="mt-5">
        <form action={addMedia} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("image")} hint={t("add_photos_hint")}>
              <Uploader name="imageUrl" siteId={site.id} multiple label={t("add_photos")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
            </Field>
            <Field label={t("video")} hint={t("poster")}>
              <Uploader name="videoUrl" siteId={site.id} kind="video" label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
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
    </Panel>
  );
}
