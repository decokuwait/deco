import type { Category, SiteData } from "@/lib/types";
import { demoContent, demoProjects } from "@/lib/demo/content";
import type { TemplateDef } from "@/templates/types";

/** Demo site data used by /template/<code> previews and by render tests. */
export function previewSiteData(def: TemplateDef, category: Category = def.category): SiteData {
  return {
    id: `preview-${def.code}`,
    slug: `preview-${def.code}`,
    category,
    templateCode: def.code,
    content: demoContent(category),
    projects: demoProjects(category),
    preview: true,
  };
}
