import type { RenderCtx } from "../../types";

/**
 * FAQPage structured data for the questions a site actually publishes.
 *
 * The page already emits LocalBusiness data; the FAQ block is the other thing Google renders directly in
 * results for this kind of site. Emitted once per FAQ section, from the same content the section renders,
 * so the two can never disagree. Previews are skipped — that content is a demo, not the site's own.
 */
export function FaqSchema({ ctx }: { ctx: RenderCtx }) {
  if (ctx.preview) return null;
  const items = ctx.site.content.faq.items
    .map((it) => ({ q: ctx.text(it.q).trim(), a: ctx.text(it.a).trim() }))
    .filter((it) => it.q && it.a);
  if (!items.length) return null;
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
