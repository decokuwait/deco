"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, errMsg, withQuery } from "../../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { patchSiteContent } from "@/lib/db/sites";
import { isContentSection, parseSectionForm, SPECS } from "../_lib/spec";
import { isFontKey } from "@/templates/fonts";
import { PATTERN_KEYS } from "@/templates/decor/patterns";
import { DEFAULT_ORDER } from "@/templates/types";
import { whatsappDigits } from "@/lib/content/defaults";

const HEX = /^#[0-9a-f]{6}$/i;
const RADII = ["none", "sm", "md", "lg", "xl", "full"];
const BUTTONS = ["solid", "outline", "pill", "square", "glow", "underline"];

export async function saveSection(host: string, section: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  if (!isContentSection(section)) redirect("/admin/content?error=unknown_section");
  const back = `/admin/content/${section}`;
  try {
    let patch: Record<string, unknown>;
    if (section === "theme") {
      const theme: Record<string, string> = {};
      for (const k of ["primary", "secondary", "accent", "bg", "surface", "text"] as const) {
        const v = readStr(fd, k, 7).toLowerCase();
        const use = readBool(fd, `${k}_custom`);
        theme[k] = use && HEX.test(v) ? v : "";
      }
      const hf = readStr(fd, "headingFont", 40);
      const bf = readStr(fd, "bodyFont", 40);
      theme.headingFont = isFontKey(hf) ? hf : "";
      theme.bodyFont = isFontKey(bf) ? bf : "";
      const radius = readStr(fd, "radius", 10);
      const button = readStr(fd, "buttonStyle", 12);
      const pattern = readStr(fd, "pattern", 20);
      theme.radius = RADII.includes(radius) ? radius : "";
      theme.buttonStyle = BUTTONS.includes(button) ? button : "";
      theme.pattern = (PATTERN_KEYS as string[]).includes(pattern) ? pattern : "";
      patch = { theme };
    } else if (section === "sections") {
      const order = readStr(fd, "order", 500)
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is (typeof DEFAULT_ORDER)[number] => (DEFAULT_ORDER as string[]).includes(s));
      patch = {
        sections: {
          about: readBool(fd, "about"),
          services: readBool(fd, "services"),
          stats: readBool(fd, "stats"),
          process: readBool(fd, "process"),
          testimonials: readBool(fd, "testimonials"),
          faq: readBool(fd, "faq"),
          cta: readBool(fd, "cta"),
          order: order.length === DEFAULT_ORDER.length && new Set(order).size === DEFAULT_ORDER.length ? order : [],
        },
      };
    } else {
      const op = readStr(fd, "op", 40) || undefined;
      patch = parseSectionForm(fd, SPECS[section], site.content, op);
      if (section === "general") {
        const contact = (patch.contact ?? {}) as Record<string, unknown>;
        const digits = whatsappDigits(String(contact.whatsapp ?? ""));
        const normalized = digits.length === 8 ? `965${digits}` : digits;
        if (!/^\d{8,15}$/.test(normalized)) redirect(withQuery(back, { error: "invalid_whatsapp" }));
        contact.whatsapp = normalized;
        if (typeof contact.phone === "string" && contact.phone) contact.phone = whatsappDigits(contact.phone);
        patch.contact = contact;
      }
    }
    await patchSiteContent(site.id, patch);
  } catch (e) {
    const msg = errMsg(e);
    if (msg.includes("NEXT_REDIRECT")) throw e;
    redirect(withQuery(back, { error: msg }));
  }
  revalidatePath("/", "layout");
  redirect(withQuery(back, { saved: "1" }));
}

/** Clears every theme override so the site returns to the template's own design. */
export async function resetTheme(host: string) {
  const { site } = await requireSiteAdmin(host);
  await patchSiteContent(site.id, { theme: { primary: "", secondary: "", accent: "", bg: "", surface: "", text: "", headingFont: "", bodyFont: "", radius: "", buttonStyle: "", pattern: "" } });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/content/theme", { saved: "1" }));
}

/** Moves a section one step in the site order (creates a custom order from the template order first). */
export async function moveSection(host: string, currentOrder: string[], key: string, dir: "up" | "down") {
  const { site } = await requireSiteAdmin(host);
  const order = [...currentOrder];
  const i = order.indexOf(key);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i >= 0 && j >= 0 && j < order.length) [order[i], order[j]] = [order[j], order[i]];
  await patchSiteContent(site.id, { sections: { order } });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/content/sections", { saved: "1" }));
}

export async function resetOrder(host: string) {
  const { site } = await requireSiteAdmin(host);
  await patchSiteContent(site.id, { sections: { order: [] } });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/content/sections", { saved: "1" }));
}
