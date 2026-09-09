"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { patchSiteContent } from "@/lib/db/sites";
import { isContentSection, parseSectionForm, SPECS } from "../_lib/spec";
import { isFontKey } from "@/templates/fonts";

const HEX = /^#[0-9a-f]{6}$/i;

export async function saveSection(host: string, section: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  if (!isContentSection(section)) redirect("/admin/content?error=unknown_section");
  const back = `/admin/content/${section}`;
  try {
    let patch: Record<string, unknown>;
    if (section === "theme") {
      const theme: Record<string, string> = {};
      for (const k of ["primary", "secondary", "accent"] as const) {
        const useDefault = readBool(fd, `${k}_default`);
        const v = readStr(fd, k, 7).toLowerCase();
        theme[k] = useDefault || !HEX.test(v) ? "" : v;
      }
      const hf = readStr(fd, "headingFont", 40);
      const bf = readStr(fd, "bodyFont", 40);
      theme.headingFont = isFontKey(hf) ? hf : "";
      theme.bodyFont = isFontKey(bf) ? bf : "";
      patch = { theme };
    } else if (section === "sections") {
      patch = {
        sections: {
          about: readBool(fd, "about"),
          services: readBool(fd, "services"),
          stats: readBool(fd, "stats"),
          process: readBool(fd, "process"),
          testimonials: readBool(fd, "testimonials"),
          faq: readBool(fd, "faq"),
          cta: readBool(fd, "cta"),
        },
      };
    } else {
      const op = readStr(fd, "op", 40) || undefined;
      patch = parseSectionForm(fd, SPECS[section], site.content, op);
    }
    await patchSiteContent(site.id, patch);
  } catch (e) {
    redirect(withQuery(back, { error: errMsg(e) }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}
