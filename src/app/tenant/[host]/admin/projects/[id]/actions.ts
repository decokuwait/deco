"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readLText, readStr } from "@/components/admin/ui";
import { addMedia, deleteMedia, deleteProject, getProject, updateMedia, updateProject } from "@/lib/db/projects";
import type { LText, MediaRole, Project } from "@/lib/types";
import { deleteObject, siteKeyFromUrl } from "@/lib/storage";
import { safeMediaUrl } from "@/lib/safe-url";
import { rowSequence } from "../../content/_lib/spec";
import { UPLOAD_LADDER } from "@/components/admin/image-pipeline";
import { isFocal, reorderMedia, saveMediaExtras, type Focal } from "./media-db";

const ROLES: MediaRole[] = ["gallery", "before", "after", "step"];
function isRole(v: string): v is MediaRole {
  return (ROLES as string[]).includes(v);
}

async function owned(siteId: string, id: string) {
  const p = await getProject(id);
  if (!p || p.siteId !== siteId) redirect("/admin/projects?error=not_found");
  return p;
}

/**
 * Every stored object a media row owns: the file itself, its poster, and the smaller derivatives that
 * were uploaded beside it (`photo@2000w.jpg` also has `photo@480w.jpg` and `photo@1080w.jpg`).
 * Keys are resolved under this site's own prefix only — see the note in `saveProject`.
 */
function storageKeys(siteId: string, urls: Array<string | null | undefined>): string[] {
  const keys: string[] = [];
  for (const url of urls) {
    const key = siteKeyFromUrl(siteId, url);
    if (!key) continue;
    keys.push(key);
    const marked = /^(.+)@(\d{2,5})w(\.[a-z0-9]{1,5})$/i.exec(key);
    if (!marked) continue;
    const [, base, widest, ext] = marked;
    for (const w of UPLOAD_LADDER) if (w < Number(widest)) keys.push(`${base}@${w}w${ext}`);
  }
  return keys;
}

/** Best-effort file cleanup; a storage failure must never stop a database change the owner asked for. */
async function forget(siteId: string, urls: Array<string | null | undefined>) {
  for (const key of storageKeys(siteId, urls)) await deleteObject(key).catch(() => undefined);
}

function readAlt(fd: FormData, prefix: string): LText | null {
  const alt = readLText(fd, `${prefix}.alt`, 300);
  // Empty means "describe it for me": the renderer generates `{title} — {location}` rather than alt="".
  return alt.ar || alt.en ? alt : null;
}

function readFocal(fd: FormData, prefix: string): Focal | null {
  const v = readStr(fd, `${prefix}.focal`, 10);
  return isFocal(v) && v !== "center" ? v : null;
}

/**
 * Applies every media edit in the one submit: field changes, removals and the new order.
 *
 * The rows are identified by the ids rendered into the form, and only ids that are actually this
 * project's are touched — the form is client input like any other.
 */
async function applyMediaEdits(siteId: string, project: Project & { siteId: string }, fd: FormData) {
  const raw = Number(fd.get("media.count"));
  const count = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 0), 500) : 0;
  if (count === 0) return;
  const kept = rowSequence(readStr(fd, "media.order", 8000), readStr(fd, "media.removed", 8000), count);
  const all = rowSequence(readStr(fd, "media.order", 8000), "", count);
  const keptSet = new Set(kept);
  const byId = new Map(project.media.map((m) => [m.id, m]));

  for (const i of all) {
    const prefix = `media.${i}`;
    const media = byId.get(readStr(fd, `${prefix}.id`, 80));
    if (!media) continue;
    if (!keptSet.has(i)) {
      await deleteMedia(media.id);
      await forget(siteId, [media.url, media.posterUrl]);
      continue;
    }
    const role = readStr(fd, `${prefix}.role`, 20);
    await updateMedia(media.id, {
      role: isRole(role) ? role : undefined,
      caption: readLText(fd, `${prefix}.caption`),
      stepLabel: readLText(fd, `${prefix}.stepLabel`),
      stepDate: readStr(fd, `${prefix}.stepDate`, 10) || null,
      posterUrl: media.kind === "video" ? safeMediaUrl(readStr(fd, `${prefix}.posterUrl`, 2000)) || null : undefined,
    });
    await saveMediaExtras(media.id, { alt: readAlt(fd, prefix), focal: readFocal(fd, prefix) });
  }

  const orderedIds = kept.map((i) => readStr(fd, `media.${i}.id`, 80)).filter((mediaId) => byId.has(mediaId));
  await reorderMedia(project.id, orderedIds);
}

/** The project and all of its photos, saved together by the one button on the page. */
export async function saveProject(host: string, id: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const project = await owned(site.id, id);
  const back = `/admin/projects/${id}`;
  const title = readLText(fd, "title");
  if (!title.ar && !title.en) redirect(withQuery(back, { error: "title_required" }));
  try {
    await updateProject(id, {
      title,
      description: readLText(fd, "description"),
      location: readLText(fd, "location"),
      coverUrl: safeMediaUrl(readStr(fd, "coverUrl", 2000)) || null,
      published: readBool(fd, "published"),
    });
    await applyMediaEdits(site.id, project, fd);
  } catch (e) {
    // `redirect()` signals itself by throwing; let Next's own control flow through.
    unstable_rethrow(e);
    console.error(`[projects] saving ${id} failed:`, e);
    redirect(withQuery(back, { error: "save_failed" }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}

export async function deleteProjectAction(host: string, id: string) {
  const { site } = await requireSiteAdmin(host);
  const project = await owned(site.id, id);
  await deleteProject(id);
  // Only keys under this site's own prefix: the URL on a media row is whatever the admin typed, and every
  // tenant's uploads are readable in the HTML of its public site, so an unscoped delete would reach
  // another tenant's files.
  await forget(site.id, project.media.flatMap((m) => [m.url, m.posterUrl]));
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/projects", { saved: "1" }));
}

/**
 * Adds photos or a video from the "add media" card.
 *
 * The image field is a multi-select: twenty photos off a phone are one pick, one queue and one submit,
 * instead of twenty upload-and-submit round trips.
 */
export async function addMediaAction(host: string, id: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  const project = await owned(site.id, id);
  const back = `/admin/projects/${id}`;
  // Media URLs are sanitised on the way in, exactly like the content editor's upload fields, so a
  // `javascript:`/`data:` value can never be stored and every render path sees a plain http(s) URL.
  const imageUrls = fd
    .getAll("imageUrl")
    .map((v) => safeMediaUrl(String(v)))
    .filter(Boolean)
    .slice(0, 50);
  const videoUrl = safeMediaUrl(readStr(fd, "videoUrl", 2000));
  const posterUrl = safeMediaUrl(readStr(fd, "posterUrl", 2000));
  if (!imageUrls.length && !videoUrl) redirect(withQuery(back, { error: "media_required" }));
  const roleRaw = readStr(fd, "role", 20);
  const role: MediaRole = isRole(roleRaw) ? roleRaw : project.type === "progress" ? "step" : project.type === "before_after" ? "before" : "gallery";
  const shared = {
    projectId: id,
    role,
    caption: readLText(fd, "caption"),
    stepLabel: readLText(fd, "stepLabel"),
    stepDate: readStr(fd, "stepDate", 10) || null,
  };
  try {
    // Both fields can be filled in one go: the video is added with its own poster, and every picked
    // photo becomes its own item rather than silently being demoted to the video's thumbnail.
    if (videoUrl) await addMedia({ ...shared, kind: "video", url: videoUrl, posterUrl: posterUrl || null });
    for (const url of imageUrls) await addMedia({ ...shared, kind: "image", url, posterUrl: null });
    if (!project.coverUrl && imageUrls[0]) await updateProject(id, { coverUrl: imageUrls[0] });
  } catch (e) {
    unstable_rethrow(e);
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "media" }) + "#media");
}
