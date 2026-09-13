import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS, isCategory } from "@/lib/types";
import { templatesFor } from "@/templates/registry";
import { TemplateGallery } from "../_gallery";

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
  return {
    title: `قوالب ${label.ar} — ${label.en} templates`,
    description: `${templatesFor(category).length} قالب موقع جاهز لأعمال ${label.ar} في الكويت.`,
    alternates: { canonical: `/templates/${category}` },
  };
}

export default async function CategoryGallery({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  return <TemplateGallery active={category} />;
}
