import type { AdminUiKey } from "@/lib/i18n/admin";
import type { SiteContent } from "@/lib/types";
import { ICON_KEYS } from "@/templates/ui/icons";
import { readLText, readStr, readNum } from "@/components/admin/ui";
import { safeUrl, safeMediaUrl } from "@/lib/safe-url";
import { SITE_UI, type SiteUiKey } from "@/lib/i18n/site";
import { EDITABLE_UI_KEYS } from "@/templates/ctx";

export type FieldSpec =
  | { kind: "ltext"; key: string; label: AdminUiKey; textarea?: boolean; required?: boolean; hint?: AdminUiKey; labelText?: string; placeholderText?: { ar: string; en: string } }
  | { kind: "text"; key: string; label: AdminUiKey; type?: "text" | "email" | "url" | "tel"; dir?: "ltr"; hint?: AdminUiKey; placeholder?: string; required?: boolean }
  | { kind: "upload"; key: string; label: AdminUiKey; media?: "image" | "video"; hint?: AdminUiKey }
  | { kind: "select"; key: string; label: AdminUiKey; options: { value: string; label: string }[] }
  | { kind: "number"; key: string; label: AdminUiKey; min?: number; max?: number; hint?: AdminUiKey };

export interface SectionSpec {
  key: ContentSection;
  title: AdminUiKey;
  hint: AdminUiKey;
  /** Flat fields (content paths like "brand.name"). */
  fields: FieldSpec[];
  /** Optional editable list at a content path (e.g. "services.items"). Row fields are relative to the row. */
  list?: { path: string; fields: FieldSpec[]; idPrefix: string; primaryKey: string };
}

export const CONTENT_SECTIONS = ["general", "hero", "about", "services", "stats", "process", "testimonials", "faq", "cta", "labels", "legal", "seo", "theme", "sections"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export function isContentSection(v: string): v is ContentSection {
  return (CONTENT_SECTIONS as readonly string[]).includes(v);
}

const ICON_OPTIONS = ICON_KEYS.map((k) => ({ value: k, label: k }));

/** Site chrome labels the admin may override; the default dictionary text is shown as placeholder. */
const LABEL_FIELDS: FieldSpec[] = EDITABLE_UI_KEYS.map((k: SiteUiKey) => ({
  kind: "ltext",
  key: `ui.${k}`,
  label: "labels",
  labelText: `${SITE_UI[k].ar} / ${SITE_UI[k].en}`,
  placeholderText: SITE_UI[k],
}));

export const SPECS: Record<ContentSection, SectionSpec> = {
  general: {
    key: "general",
    title: "general",
    hint: "general_hint",
    fields: [
      { kind: "ltext", key: "brand.name", label: "site_name", required: true },
      { kind: "ltext", key: "brand.tagline", label: "tagline" },
      { kind: "upload", key: "brand.logoUrl", label: "logo" },
      { kind: "upload", key: "brand.faviconUrl", label: "favicon", hint: "optional" },
      { kind: "text", key: "contact.whatsapp", label: "whatsapp_number", type: "tel", dir: "ltr", placeholder: "96555555555", required: true },
      { kind: "ltext", key: "contact.whatsappMessage", label: "whatsapp_message", textarea: true, hint: "whatsapp_id_hint" },
      { kind: "text", key: "contact.phone", label: "phone", type: "tel", dir: "ltr" },
      { kind: "text", key: "contact.email", label: "email", type: "email", dir: "ltr" },
      { kind: "ltext", key: "contact.address", label: "address" },
      { kind: "ltext", key: "contact.hours", label: "hours" },
      { kind: "ltext", key: "contact.title", label: "contact_title" },
      { kind: "ltext", key: "contact.subtitle", label: "contact_subtitle" },
      { kind: "text", key: "contact.mapEmbedUrl", label: "map_embed", type: "url", dir: "ltr", hint: "map_hint" },
      { kind: "text", key: "socials.instagram", label: "instagram", type: "url", dir: "ltr", placeholder: "https://instagram.com/...", hint: "url_hint" },
      { kind: "text", key: "socials.tiktok", label: "tiktok", type: "url", dir: "ltr", placeholder: "https://tiktok.com/@..." },
      { kind: "text", key: "socials.snapchat", label: "snapchat", type: "url", dir: "ltr", placeholder: "https://snapchat.com/add/..." },
      { kind: "text", key: "socials.facebook", label: "facebook", type: "url", dir: "ltr", placeholder: "https://facebook.com/..." },
      { kind: "text", key: "socials.x", label: "x_social", type: "url", dir: "ltr", placeholder: "https://x.com/..." },
      { kind: "text", key: "socials.youtube", label: "youtube", type: "url", dir: "ltr", placeholder: "https://youtube.com/@..." },
    ],
  },
  hero: {
    key: "hero",
    title: "hero",
    hint: "hero_hint",
    fields: [
      { kind: "ltext", key: "hero.badge", label: "badge" },
      { kind: "ltext", key: "hero.title", label: "title", required: true },
      { kind: "ltext", key: "hero.subtitle", label: "subtitle", textarea: true },
      { kind: "ltext", key: "hero.primaryCta", label: "primary_cta" },
      { kind: "ltext", key: "hero.secondaryCta", label: "secondary_cta" },
      { kind: "upload", key: "hero.imageUrl", label: "main_image" },
      { kind: "upload", key: "hero.images.0", label: "extra_images", hint: "hero_images_hint" },
      { kind: "upload", key: "hero.images.1", label: "extra_images" },
      { kind: "upload", key: "hero.images.2", label: "extra_images" },
      { kind: "upload", key: "hero.images.3", label: "extra_images" },
      { kind: "upload", key: "hero.videoUrl", label: "video_url", media: "video", hint: "hero_video_hint" },
    ],
  },
  about: {
    key: "about",
    title: "about",
    hint: "about_hint",
    fields: [
      { kind: "ltext", key: "about.title", label: "title" },
      { kind: "ltext", key: "about.body", label: "body", textarea: true },
      { kind: "upload", key: "about.imageUrl", label: "image" },
    ],
    list: { path: "about.points", idPrefix: "point", primaryKey: "", fields: [{ kind: "ltext", key: "", label: "points" }] },
  },
  services: {
    key: "services",
    title: "services",
    hint: "services_hint",
    fields: [
      { kind: "ltext", key: "services.title", label: "section_header" },
      { kind: "ltext", key: "services.subtitle", label: "subtitle" },
    ],
    list: {
      path: "services.items",
      idPrefix: "svc",
      primaryKey: "title",
      fields: [
        { kind: "ltext", key: "title", label: "title", required: true },
        { kind: "ltext", key: "description", label: "description", textarea: true },
        { kind: "select", key: "icon", label: "icon", options: ICON_OPTIONS },
        { kind: "upload", key: "imageUrl", label: "image" },
      ],
    },
  },
  stats: {
    key: "stats",
    title: "stats",
    hint: "stats_hint",
    fields: [],
    list: {
      path: "stats",
      idPrefix: "stat",
      primaryKey: "value",
      fields: [
        { kind: "text", key: "value", label: "value", dir: "ltr", hint: "stat_value_hint", placeholder: "15+" },
        { kind: "ltext", key: "label", label: "label", required: true },
      ],
    },
  },
  process: {
    key: "process",
    title: "process",
    hint: "process_hint",
    fields: [
      { kind: "ltext", key: "process.title", label: "section_header" },
      { kind: "ltext", key: "process.subtitle", label: "subtitle" },
    ],
    list: {
      path: "process.steps",
      idPrefix: "step",
      primaryKey: "title",
      fields: [
        { kind: "ltext", key: "title", label: "title", required: true },
        { kind: "ltext", key: "description", label: "description", textarea: true },
      ],
    },
  },
  testimonials: {
    key: "testimonials",
    title: "testimonials",
    hint: "testimonials_hint",
    fields: [
      { kind: "ltext", key: "testimonials.title", label: "section_header" },
      { kind: "ltext", key: "testimonials.subtitle", label: "subtitle" },
    ],
    list: {
      path: "testimonials.items",
      idPrefix: "t",
      primaryKey: "name",
      fields: [
        { kind: "ltext", key: "name", label: "name", required: true },
        { kind: "ltext", key: "role", label: "location" },
        { kind: "ltext", key: "text", label: "body", textarea: true },
        { kind: "number", key: "rating", label: "rating", min: 1, max: 5 },
      ],
    },
  },
  faq: {
    key: "faq",
    title: "faq",
    hint: "faq_hint",
    fields: [
      { kind: "ltext", key: "faq.title", label: "section_header" },
      { kind: "ltext", key: "faq.subtitle", label: "subtitle" },
    ],
    list: {
      path: "faq.items",
      idPrefix: "faq",
      primaryKey: "q",
      fields: [
        { kind: "ltext", key: "q", label: "question", required: true },
        { kind: "ltext", key: "a", label: "answer", textarea: true },
      ],
    },
  },
  cta: {
    key: "cta",
    title: "cta",
    hint: "cta_hint",
    fields: [
      { kind: "ltext", key: "cta.eyebrow", label: "cta_eyebrow" },
      { kind: "ltext", key: "cta.title", label: "title" },
      { kind: "ltext", key: "cta.subtitle", label: "subtitle", textarea: true },
      { kind: "ltext", key: "cta.buttonText", label: "button_text" },
    ],
  },
  labels: { key: "labels", title: "labels", hint: "labels_hint", fields: LABEL_FIELDS },
  legal: {
    key: "legal",
    title: "legal",
    hint: "legal_hint",
    fields: [
      { kind: "ltext", key: "legal.privacyTitle", label: "title" },
      { kind: "ltext", key: "legal.privacy", label: "body", textarea: true },
    ],
  },
  seo: {
    key: "seo",
    title: "seo",
    hint: "seo_hint",
    fields: [
      { kind: "ltext", key: "seo.title", label: "meta_title" },
      { kind: "ltext", key: "seo.description", label: "meta_description", textarea: true },
      { kind: "text", key: "seo.keywords", label: "keywords" },
      { kind: "upload", key: "seo.ogImageUrl", label: "og_image" },
    ],
  },
  // theme and sections are rendered by hand (colour pickers / toggles) and parsed in actions.ts.
  theme: { key: "theme", title: "theme", hint: "theme_hint", fields: [] },
  sections: { key: "sections", title: "sections", hint: "sections_hint", fields: [] },
};

export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function readField(fd: FormData, prefix: string, f: FieldSpec): unknown {
  const name = prefix ? (f.key ? `${prefix}.${f.key}` : prefix) : f.key;
  switch (f.kind) {
    case "ltext":
      return readLText(fd, name);
    case "text": {
      const v = readStr(fd, name, 4000);
      return f.type === "url" ? safeUrl(v) : v;
    }
    case "upload":
      return safeMediaUrl(readStr(fd, name, 4000));
    case "select":
      return readStr(fd, name, 4000);
    case "number": {
      const n = readNum(fd, name);
      if (n == null) return undefined;
      return Math.min(Math.max(n, f.min ?? -Infinity), f.max ?? Infinity);
    }
  }
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "object") return !Object.values(v as Record<string, unknown>).some((x) => typeof x === "string" && x.trim());
  return false;
}

/**
 * Builds a content patch from a submitted section form. Lists are fully rebuilt from the rows
 * (arrays replace on merge). `op` handles row moves/deletes requested via the clicked button.
 */
export function parseSectionForm(fd: FormData, spec: SectionSpec, current: SiteContent, op?: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const v = readField(fd, "", f);
    if (v !== undefined) setPath(patch, f.key, v);
  }
  // hero.images.N -> array
  const heroImgs = getPath(patch, "hero.images");
  if (heroImgs && typeof heroImgs === "object" && !Array.isArray(heroImgs)) {
    const arr = Object.values(heroImgs as Record<string, unknown>).filter((u): u is string => typeof u === "string" && !!u.trim());
    setPath(patch, "hero.images", arr);
  }

  if (spec.list) {
    // A non-numeric rows.count used to collapse to NaN, the loop never ran, and the whole list was
    // replaced by an empty array — a silent wipe of every service/stat/FAQ the owner had.
    const rawCount = Number(fd.get("rows.count"));
    const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 0), 200) : 0;
    const existing = (getPath(current, spec.list.path) as Array<Record<string, unknown>> | undefined) ?? [];
    const rows: Array<Record<string, unknown> | { ar: string; en: string }> = [];
    const usedIds = new Set<string>();
    for (let i = 0; i < count; i++) {
      const prefix = `rows.${i}`;
      const submitted = readStr(fd, `${prefix}.id`, 80);
      // Row ids come from the form and end up as React keys and as the lookup into the stored rows, so
      // a repeated id would merge two rows into one. A duplicate gets a fresh id instead.
      const id = submitted && !usedIds.has(submitted) ? submitted : `${spec.list.idPrefix}-${Date.now()}-${i}`;
      usedIds.add(id);
      if (op === `delete:${i}`) continue;
      if (spec.list.primaryKey === "") {
        rows.push(readLText(fd, prefix));
        continue;
      }
      const row: Record<string, unknown> = { id };
      const old = existing.find((e) => e.id === id);
      if (old) for (const [k, v] of Object.entries(old)) row[k] = v;
      for (const f of spec.list.fields) {
        const v = readField(fd, prefix, f);
        if (v !== undefined) row[f.key] = v;
      }
      rows.push(row);
    }
    // new row appended when its primary field is filled
    const np = "rows.new";
    if (spec.list.primaryKey === "") {
      const v = readLText(fd, np);
      if (!isEmptyValue(v)) rows.push(v);
    } else {
      const primary = spec.list.fields.find((f) => f.key === spec.list!.primaryKey)!;
      const pv = readField(fd, np, primary);
      if (!isEmptyValue(pv)) {
        const row: Record<string, unknown> = { id: `${spec.list.idPrefix}-${Date.now()}` };
        for (const f of spec.list.fields) {
          const v = readField(fd, np, f);
          if (v !== undefined) row[f.key] = v;
        }
        rows.push(row);
      }
    }
    if (op?.startsWith("move:")) {
      const [, idxS, dir] = op.split(":");
      const i = Number(idxS);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && i < rows.length && j < rows.length) [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    // filter rows whose primary value is empty
    const cleaned = rows.filter((r) => (spec.list!.primaryKey === "" ? !isEmptyValue(r) : !isEmptyValue((r as Record<string, unknown>)[spec.list!.primaryKey])));
    setPath(patch, spec.list.path, cleaned);
  }
  return patch;
}
