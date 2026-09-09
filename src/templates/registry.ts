import type { Category } from "@/lib/types";
import type { TemplateDef } from "./types";
import { GYPSUM_TEMPLATES } from "./registry/gypsum";
import { ALUMINUM_TEMPLATES } from "./registry/aluminum";
import { PARTITION_TEMPLATES } from "./registry/partition";
import { CERAMIC_TEMPLATES } from "./registry/ceramic";

export const TEMPLATES: TemplateDef[] = [...GYPSUM_TEMPLATES, ...ALUMINUM_TEMPLATES, ...PARTITION_TEMPLATES, ...CERAMIC_TEMPLATES];

const MAP = new Map(TEMPLATES.map((t) => [t.code, t]));

export function getTemplate(code: string | null | undefined): TemplateDef | null {
  if (!code) return null;
  return MAP.get(String(code)) ?? null;
}

export function templatesFor(category: Category): TemplateDef[] {
  return TEMPLATES.filter((t) => t.category === category);
}

export function defaultTemplateFor(category: Category): TemplateDef {
  return templatesFor(category)[0] ?? TEMPLATES[0];
}

/** Category prefix for template codes. */
export const CATEGORY_PREFIX: Record<Category, string> = { gypsum: "1", aluminum: "2", partition: "3", ceramic: "4" };

export function isTemplateCode(v: unknown): v is string {
  return typeof v === "string" && /^[1-4]\d{2}$/.test(v) && MAP.has(v);
}

export function neighbours(code: string): { prev: TemplateDef | null; next: TemplateDef | null } {
  const i = TEMPLATES.findIndex((t) => t.code === code);
  if (i < 0) return { prev: null, next: null };
  return { prev: TEMPLATES[(i - 1 + TEMPLATES.length) % TEMPLATES.length], next: TEMPLATES[(i + 1) % TEMPLATES.length] };
}
