"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readLText, readStr } from "@/components/admin/ui";
import { addMedia, deleteMedia, deleteProject, getMedia, getProject, moveMedia, updateMedia, updateProject } from "@/lib/db/projects";
import type { MediaRole } from "@/lib/types";

const ROLES: MediaRole[] = ["gallery", "before", "after", "step"];
function isRole(v: string): v is MediaRole {
  return (ROLES as string[]).includes(v);
}

async function owned(siteId: string, id: string) {
  const p = await getProject(id);
  if (!p || p.siteId !== siteId) redirect("/admin/projects?error=not_found");
  return p;
}

export async function saveProject(host: string, id: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  await owned(site.id, id);
  const back = `/admin/projects/${id}`;
  const title = readLText(fd, "title");
  if (!title.ar && !title.en) redirect(withQuery(back, { error: "title_required" }));
  try {
    await updateProject(id, {
      title,
      description: readLText(fd, "description"),
      location: readLText(fd, "location"),
      coverUrl: readStr(fd, "coverUrl", 2000) || null,
      published: readBool(fd, "published"),
    });
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}

export async function deleteProjectAction(host: string, id: string) {
  const { site } = await requireSiteAdmin(host);
  await owned(site.id, id);
  await deleteProject(id);
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/projects", { saved: "1" }));
}

/** Adds an image or a video (with optional poster) from the "add media" form. */
export async function addMediaAction(host: string, id: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const project = await owned(site.id, id);
  const back = `/admin/projects/${id}`;
  const imageUrl = readStr(fd, "imageUrl", 2000);
  const videoUrl = readStr(fd, "videoUrl", 2000);
  const posterUrl = readStr(fd, "posterUrl", 2000);
  if (!imageUrl && !videoUrl) redirect(withQuery(back, { error: "media_required" }));
  const roleRaw = readStr(fd, "role", 20);
  const role: MediaRole = isRole(roleRaw) ? roleRaw : project.type === "progress" ? "step" : project.type === "before_after" ? "before" : "gallery";
  try {
    await addMedia({
      projectId: id,
      kind: videoUrl ? "video" : "image",
      url: videoUrl || imageUrl,
      posterUrl: videoUrl ? posterUrl || imageUrl || null : null,
      role,
      caption: readLText(fd, "caption"),
      stepLabel: readLText(fd, "stepLabel"),
      stepDate: readStr(fd, "stepDate", 10) || null,
    });
    if (!project.coverUrl && imageUrl) await updateProject(id, { coverUrl: imageUrl });
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "media" }) + "#media");
}

export async function saveMediaAction(host: string, id: string, mediaId: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  await owned(site.id, id);
  const m = await getMedia(mediaId);
  if (!m || m.projectId !== id) redirect(`/admin/projects/${id}?error=not_found`);
  const op = readStr(fd, "op", 20);
  try {
    if (op === "delete") {
      await deleteMedia(mediaId);
    } else if (op === "up" || op === "down") {
      await moveMedia(mediaId, op);
    } else {
      const roleRaw = readStr(fd, "role", 20);
      await updateMedia(mediaId, {
        role: isRole(roleRaw) ? roleRaw : undefined,
        caption: readLText(fd, "caption"),
        stepLabel: readLText(fd, "stepLabel"),
        stepDate: readStr(fd, "stepDate", 10) || null,
        posterUrl: m.kind === "video" ? readStr(fd, "posterUrl", 2000) || null : undefined,
      });
    }
  } catch (e) {
    redirect(withQuery(`/admin/projects/${id}`, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(`/admin/projects/${id}`, { saved: "media" }) + "#media");
}
