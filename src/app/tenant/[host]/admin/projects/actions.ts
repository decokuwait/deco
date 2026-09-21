"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../_lib/guard";
import { readBool, readLText, readStr } from "@/components/admin/ui";
import { patchSiteContent } from "@/lib/db/sites";
import { createProject, deleteProject, getProject, moveProject, updateProject } from "@/lib/db/projects";
import { isProjectType, type ProjectType } from "@/lib/types";
import { safeMediaUrl } from "@/lib/safe-url";

const CONTENT_KEY: Record<ProjectType, "finished" | "beforeAfter" | "progress"> = { finished: "finished", before_after: "beforeAfter", progress: "progress" };

/** Enable/disable a project type on the public site and edit its section title/subtitle. */
export async function saveProjectType(host: string, type: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  if (!isProjectType(type)) redirect("/admin/projects?error=bad_type");
  try {
    await patchSiteContent(site.id, {
      projects: {
        title: readLText(fd, "sectionTitle"),
        subtitle: readLText(fd, "sectionSubtitle"),
        [CONTENT_KEY[type]]: { enabled: readBool(fd, "enabled"), title: readLText(fd, "title"), subtitle: readLText(fd, "subtitle") },
      },
    });
  } catch (e) {
    redirect(withQuery("/admin/projects", { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/projects", { saved: "1" }));
}

export async function createProjectAction(host: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const type = readStr(fd, "type", 20);
  if (!isProjectType(type)) redirect("/admin/projects?error=bad_type");
  const title = readLText(fd, "title");
  if (!title.ar && !title.en) redirect(withQuery(`/admin/projects/new`, { type, error: "title_required" }));
  let id = "";
  try {
    const p = await createProject({
      siteId: site.id,
      type,
      title,
      description: readLText(fd, "description"),
      location: readLText(fd, "location"),
      coverUrl: safeMediaUrl(readStr(fd, "coverUrl", 2000)) || null,
      published: readBool(fd, "published"),
    });
    id = p.id;
  } catch (e) {
    redirect(withQuery(`/admin/projects/new`, { type, error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${id}`, { saved: "created" }));
}

async function ownedProject(siteId: string, id: string) {
  const p = await getProject(id);
  if (!p || p.siteId !== siteId) redirect("/admin/projects?error=not_found");
  return p;
}

export async function moveProjectAction(host: string, id: string, dir: "up" | "down") {
  const { site } = await requireSiteAdmin(host);
  await ownedProject(site.id, id);
  await moveProject(id, dir);
  revalidatePath("/", "layout");
  redirect("/admin/projects");
}

export async function deleteProjectAction(host: string, id: string) {
  const { site } = await requireSiteAdmin(host);
  await ownedProject(site.id, id);
  await deleteProject(id);
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/projects", { saved: "1" }));
}

export async function togglePublished(host: string, id: string, published: boolean) {
  const { site } = await requireSiteAdmin(host);
  await ownedProject(site.id, id);
  await updateProject(id, { published });
  revalidatePath("/", "layout");
  redirect("/admin/projects");
}
