import type { Metadata } from "next";
import { TemplateGallery } from "./_gallery";
import { GALLERY_COPY } from "./_copy";
import { TEMPLATES } from "@/templates/registry";
import { rootUrl } from "@/lib/config";

export const dynamic = "force-static";

export const metadata: Metadata = {
  // `absolute`: the layout's "%s | DecoKuwait" template would push this past the width Google renders.
  title: { absolute: "معرض القوالب — جبس بورد، ألمنيوم، بارتيشن، سيراميك" },
  description: `${TEMPLATES.length} قالب موقع جاهز لأعمال الديكور في الكويت، مقسمة على أربعة أقسام. ${GALLERY_COPY.all.intro.slice(0, 90)}`,
  // Absolute, not `/templates`: a relative canonical resolves against whatever host served the page, so a
  // `*.vercel.app` copy of the gallery canonicalised to itself instead of home.
  alternates: { canonical: rootUrl("/templates") },
  openGraph: { title: "معرض القوالب", description: `${TEMPLATES.length} قالب موقع جاهز لأعمال الديكور في الكويت.`, url: rootUrl("/templates"), type: "website" },
};

export default function TemplatesGallery() {
  return <TemplateGallery active="all" />;
}
