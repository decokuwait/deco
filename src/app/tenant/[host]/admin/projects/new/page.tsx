import { requireSiteAdmin, sp1, type SearchParams } from "../../_lib/guard";
import { Panel, SaveBar, BackLink } from "../../_components/Panel";
import { Card, PageHeader, Flash, Field, Select, Toggle, BilingualInput } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Uploader } from "@/components/admin/Uploader";
import { uploadErrorLabels } from "@/lib/i18n/admin";
import { PROJECT_TYPES, isProjectType, type ProjectType } from "@/lib/types";
import { createProjectAction } from "../actions";

const LABEL: Record<ProjectType, "finished" | "before_after" | "progress"> = { finished: "finished", before_after: "before_after", progress: "progress" };

export default async function NewProjectPage({ params, searchParams }: { params: Promise<{ host: string }>; searchParams: SearchParams }) {
  const { host } = await params;
  const sp = await searchParams;
  const ctx = await requireSiteAdmin(host);
  const { t, site } = ctx;
  const typeRaw = sp1(sp.type);
  const type: ProjectType = isProjectType(typeRaw) ? typeRaw : "finished";
  const action = createProjectAction.bind(null, host);
  const error = sp1(sp.error);
  return (
    <Panel ctx={ctx} active="projects">
      <BackLink href="/admin/projects" label={t("projects")} />
      <PageHeader title={t("new_project")} subtitle={t("project_saved_hint")} />
      <Flash error={error === "title_required" ? t("required") : error} savedText={t("saved")} errorText={t("error")} />
      <form action={action}>
        <Card>
          <div className="grid gap-4">
            <Field label={t("project_type")}>
              <Select name="type" defaultValue={type}>
                {PROJECT_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {t(LABEL[p])}
                  </option>
                ))}
              </Select>
            </Field>
            <BilingualInput name="title" label={t("title")} required />
            <BilingualInput name="description" label={t("description")} textarea />
            <BilingualInput name="location" label={t("location")} />
            <Field label={t("cover")}>
              <Uploader name="coverUrl" siteId={site.id} label={t("upload")} uploadingLabel={t("uploading")} removeLabel={t("remove")} errorLabels={uploadErrorLabels(t)} />
            </Field>
            <Toggle name="published" defaultChecked label={t("published")} hint={t("published_hint")} />
          </div>
        </Card>
        <SaveBar t={t} back={{ href: "/admin/projects", label: t("projects") }}>
          <SubmitButton pendingText={t("saving")} className="w-full sm:w-auto sm:min-w-[160px]">
            {t("create")}
          </SubmitButton>
        </SaveBar>
      </form>
    </Panel>
  );
}
