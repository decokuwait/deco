import type { Metadata } from "next";
import { TemplateGallery } from "./_gallery";
import { TEMPLATES } from "@/templates/registry";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "معرض القوالب — جبس بورد، ألمنيوم، بارتيشن، سيراميك",
  description: `${TEMPLATES.length} قالب موقع جاهز لأعمال الديكور في الكويت، مقسمة على أربعة أقسام.`,
};

export default function TemplatesGallery() {
  return <TemplateGallery active="all" />;
}
