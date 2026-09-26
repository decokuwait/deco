"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSiteAdmin, withQuery } from "../../_lib/guard";
import { readBool, readStr } from "@/components/admin/ui";
import { patchSiteContent } from "@/lib/db/sites";
import { isContentSection, parseSectionForm, SPECS } from "../_lib/spec";
import { isFontKey } from "@/templates/fonts";
import { PATTERN_KEYS } from "@/templates/decor/patterns";
import { DEFAULT_ORDER } from "@/templates/types";
import { internationalDigits } from "@/lib/content/defaults";
import { isNonEmbedMapUrl } from "@/lib/safe-url";
import { contentVersion, VERSION_FIELD } from "../../_lib/version";
import { readHoursSpec } from "../_lib/hours";

const HEX = /^#[0-9a-f]{6}$/i;

/** One latitude/longitude field, kept only when it is a real coordinate. */
function coordinate(geo: unknown, key: "lat" | "lng", limit: number): string {
  const raw = String((geo as Record<string, unknown> | undefined)?.[key] ?? "").trim();
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= limit ? raw.slice(0, 20) : "";
}
const RADII = ["none", "sm", "md", "lg", "xl", "full"];
const BUTTONS = ["solid", "outline", "pill", "square", "glow", "underline"];

export async function saveSection(host: string, section: string, fd: FormData) {
  const { site } = await requireSiteAdmin(host);
  if (!isContentSection(section)) redirect("/admin/content?error=unknown_section");
  const back = `/admin/content/${section}`;
  // Refuse before building the patch, not after. A list form carries `rows.count` and every `rows.N.id`
  // from the moment the page was rendered, and the patch rebuilds the whole array from exactly those
  // rows — so a second tab's save deletes the service the first tab just added and still says "saved".
  // Nothing downstream can tell that apart from a deliberate deletion, so it has to be caught here.
  if (readStr(fd, VERSION_FIELD, 40) !== contentVersion(site.content)) redirect(withQuery(back, { error: "content_changed" }));
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
        // One normaliser for both numbers, so a `00965…` entry (the third way a Kuwaiti number is
        // written) is stored as `965…` instead of reaching tel:/wa.me with the access prefix intact.
        const normalized = internationalDigits(String(contact.whatsapp ?? ""));
        if (!/^\d{8,15}$/.test(normalized)) redirect(withQuery(back, { error: "invalid_whatsapp" }));
        contact.whatsapp = normalized;
        if (typeof contact.phone === "string" && contact.phone) contact.phone = internationalDigits(contact.phone);
        // A normal Maps link passes URL validation but Google refuses to frame it, so the site would show
        // an empty box. Say so instead of saving something that renders as nothing.
        if (isNonEmbedMapUrl(readStr(fd, "contact.mapEmbedUrl", 4000))) redirect(withQuery(back, { error: "map_not_embed" }));
        // A coordinate is either a number inside the range of the earth or it is nothing: a half-typed
        // "29." stored as-is would put a broken `geo` in the structured data rather than none at all.
        contact.geo = { lat: coordinate(contact.geo, "lat", 90), lng: coordinate(contact.geo, "lng", 180) };
        contact.hoursSpec = readHoursSpec(fd);
        patch.contact = contact;
      }
    }
    await patchSiteContent(site.id, patch);
  } catch (e) {
    // `redirect()` above signals itself by throwing; unstable_rethrow lets Next's own control-flow
    // errors (redirect, notFound, forbidden) pass through instead of being reported as a save failure.
    unstable_rethrow(e);
    console.error(`[content] saving ${section} failed:`, e);
    redirect(withQuery(back, { error: "save_failed" }));
  }
  revalidatePath("/", "layout");
  // Back to the list of sections, not back onto the form that was just saved. An owner setting a site up
  // works through the sections in turn, and landing on the saved form again meant scrolling to the bottom
  // of a long page and hunting for the way out before the next one could be opened. The section key rides
  // along so the list can say which card was saved.
  //
  // Only the success path leaves: every `redirect` above stays on the form, because an error is something
  // to fix in the fields that are still filled in, not something to carry to another page.
  redirect(withQuery("/admin/content", { saved: section }));
}

/** Clears every theme override so the site returns to the template's own design. */
export async function resetTheme(host: string) {
  const { site } = await requireSiteAdmin(host);
  await patchSiteContent(site.id, { theme: { primary: "", secondary: "", accent: "", bg: "", surface: "", text: "", headingFont: "", bodyFont: "", radius: "", buttonStyle: "", pattern: "" } });
  revalidatePath("/", "layout");
  redirect(withQuery("/admin/content/theme", { saved: "1" }));
}

/**
 * Moves a section one step in the site order (creates a custom order from the template order first).
 *
 * `currentOrder` arrives as a bound server-action argument, which means it is client input: it is filtered
 * to known section keys and has to be a complete permutation before it is stored, the same rule the
 * renderer and `saveSection` already apply. Anything else falls back to the template's own order.
 */
export async function moveSection(host: string, currentOrder: string[], key: string, dir: "up" | "down") {
  const { site } = await requireSiteAdmin(host);
  const order = [...new Set(currentOrder.filter((k): k is (typeof DEFAULT_ORDER)[number] => (DEFAULT_ORDER as string[]).includes(k)))];
  if (order.length !== DEFAULT_ORDER.length) redirect(withQuery("/admin/content/sections", { error: "invalid_order" }));
  const i = (order as string[]).indexOf(key);
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
