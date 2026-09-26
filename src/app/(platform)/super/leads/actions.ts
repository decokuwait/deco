"use server";

import { redirect } from "next/navigation";
import { requireSuper, errMsg, withQuery } from "../_lib/guard";
import { readStr } from "@/components/admin/ui";
import { deleteLead, isLeadStatus, updateLead } from "@/app/(platform)/pricing/_lib/leads";

const BACK = "/super/leads";

/** Moves a request along the pipeline, and stores the founder's own note about the conversation. */
export async function updateLeadAction(id: string, fd: FormData) {
  await requireSuper();
  const status = readStr(fd, "status", 16);
  const notes = readStr(fd, "notes", 2000);
  if (!isLeadStatus(status)) redirect(withQuery(BACK, { error: "required" }));
  try {
    await updateLead(id, { status, notes: notes || null });
  } catch (e) {
    redirect(withQuery(BACK, { error: errMsg(e) }));
  }
  redirect(withQuery(BACK, { saved: "1" }));
}

/**
 * Deletes a request outright. Unlike a site this is genuinely small and genuinely disposable — it is one
 * spam row — so it keeps a plain confirm rather than a typed one; the typed confirmation is reserved for
 * the operation that used to be an unrecoverable cascade.
 */
export async function deleteLeadAction(id: string) {
  await requireSuper();
  await deleteLead(id);
  redirect(withQuery(BACK, { saved: "1" }));
}
