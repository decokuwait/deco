import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS, isCategory } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { rootUrl } from "@/lib/config";
import { TemplateGallery } from "../_gallery";
import { GALLERY_COPY } from "../_copy";

export const dynamic = "force-static";
/** Only the four known trades exist; any other path 404s instead of being rendered on demand. */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return { title: "غير موجود" };
  const label = CATEGORY_LABELS[category];
  const title = `قوالب مواقع ${label.ar} في الكويت`;
  const description = `${templatesFor(category).length} قالب موقع جاهز لأعمال ${label.ar} في الكويت. ${GALLERY_COPY[category].intro.slice(0, 90)}`;
  const canonical = rootUrl(`/templates/${category}`);
  return {
    title,
    description,
    // Absolute: a relative canonical resolves against the serving host, which is exactly how a preview
    // deployment ends up declaring itself the original of the gallery.
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

export default async function CategoryGallery({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  return <TemplateGallery active={category} />;
}
