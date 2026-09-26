import type { Category, SiteContent, SiteRecord } from "@/lib/types";
import { createSite, getSiteBySlug } from "@/lib/db/sites";
import { addDomain, updateDomainStatus } from "@/lib/db/domains";
import { addMedia, createProject } from "@/lib/db/projects";
import { demoContent, demoProjects } from "@/lib/demo/content";
import { starterCopy } from "@/lib/demo/starter";
import { deepMerge, emptyContent } from "@/lib/content/defaults";
import { subdomainHost } from "@/lib/tenant";
import { ROOT_DOMAIN } from "@/lib/config";
import { addDomainToVercel, vercelConfigured } from "@/lib/vercel";
import { defaultTemplateFor, getTemplate } from "@/templates/registry";

/**
 * Copies the category showcase projects (with media) into a site.
 *
 * Only ever called for a site flagged as a demo: these are stock photographs of somebody else's work,
 * and presenting them as a contractor's portfolio is a lie told to his customers.
 */
export async function seedDemoProjects(siteId: string, category: Category): Promise<number> {
  let n = 0;
  for (const p of demoProjects(category)) {
    const created = await createProject({
      siteId,
      type: p.type,
      title: p.title,
      description: p.description,
      location: p.location,
      coverUrl: p.coverUrl,
      published: true,
      // The demo set carries stable slugs, so a seeded site and the template preview of the same
      // showcase serve the same `/projects/<slug>` URLs. `createProject` validates and dedupes it.
      slug: p.slug,
    });
    for (const m of p.media) {
      await addMedia({ projectId: created.id, kind: m.kind, url: m.url, posterUrl: m.posterUrl, role: m.role, caption: m.caption, stepLabel: m.stepLabel, stepDate: m.stepDate });
    }
    n++;
  }
  return n;
}

export interface StarterInput {
  category: Category;
  name: string;
  /** The site's subdomain. It is unique per site, which is what makes the copy below unique per site. */
  slug: string;
  whatsapp?: string;
  email?: string;
}

/**
 * Content for a brand-new real customer site.
 *
 * Nothing here is invented about the business: no services it may not offer, no statistics, no
 * testimonials, no photographs, no address. What it does carry is section headings and a first draft
 * of the hero and CTA copy, written from the trade's vocabulary and the customer's own name — see
 * `demo/starter.ts` for why every one of those strings has to differ between two sites in the same
 * category, and how.
 */
export function starterContent(input: StarterInput): SiteContent {
  const { category, name, slug } = input;
  const c = starterCopy(category, name, slug);
  const base = emptyContent();
  const brand = { ar: name, en: name };
  // Every hero variant renders the title as the page's only `<h1>`. An empty one is an empty h1 —
  // invisible to a reader, and a missing main heading to a crawler — so provisioning refuses to
  // produce one even if the copy generator is ever changed to return a blank.
  const heroTitle = { ar: c.heroTitle.ar.trim() || name, en: c.heroTitle.en.trim() || name };
  return deepMerge(base, {
    brand: { name: brand, tagline: c.tagline },
    contact: {
      whatsapp: input.whatsapp || "",
      phone: input.whatsapp || "",
      // Empty unless the operator typed the customer's real address: a placeholder here is a wrong
      // promise, and `info@example.com` in a mailto is worse than no email at all.
      email: input.email || "",
      title: c.contactTitle,
      subtitle: c.contactSubtitle,
    },
    hero: { badge: c.heroBadge, title: heroTitle, subtitle: c.heroSubtitle, primaryCta: c.primaryCta, secondaryCta: c.secondaryCta },
    about: { title: c.aboutTitle },
    services: { title: c.servicesTitle, subtitle: c.servicesSubtitle },
    process: { title: c.processTitle, subtitle: c.processSubtitle },
    projects: {
      title: c.projectsTitle,
      subtitle: c.projectsSubtitle,
      finished: { enabled: true },
      beforeAfter: { enabled: true },
      progress: { enabled: true },
    },
    // Heading only, no items, and the section starts hidden: an empty "what clients say" is worse than
    // no section, and a fabricated one is worse still. The admin turns it on with the first real review.
    testimonials: { title: c.testimonialsTitle, subtitle: { ar: "", en: "" }, items: [] },
    faq: { title: c.faqTitle, subtitle: c.faqSubtitle },
    cta: c.cta,
    seo: { title: brand, description: c.seoDescription, keywords: c.keywords },
    sections: { testimonials: false, stats: false },
    settings: { demo: false },
  });
}

/**
 * Last line of defence before content is written to a site.
 *
 * Everything fabricated in the demo — invented customer names with five-star ratings, a placeholder
 * phone number, social profiles that are not the customer's — is legal on a showcase and nowhere else.
 * Provisioning is the only place that writes content for a new site, so clearing it here is what makes
 * "a real customer's site can never ship a fake testimonial" a property of the system rather than a
 * habit of whoever fills in the form.
 */
function stripFabricated(content: SiteContent): SiteContent {
  if (content.settings.demo) return content;
  return deepMerge(content, {
    testimonials: { items: [] },
    stats: [],
    socials: { instagram: "", tiktok: "", snapchat: "", facebook: "", x: "", youtube: "" },
    contact: { email: (content.contact.email || "").includes("example.com") ? "" : content.contact.email || "", address: { ar: "", en: "" } },
    sections: { testimonials: false },
  });
}

export interface ProvisionInput {
  slug: string;
  name: string;
  category: Category;
  templateCode?: string;
  whatsapp?: string;
  email?: string;
  /**
   * Fill the site with the category showcase: invented brand copy, stock projects and sample
   * testimonials. **Off unless explicitly asked for.** It exists for sales demos and for the e2e
   * suite; a paying customer's site must never be left on it.
   */
  demo?: boolean;
  /**
   * `paused` (the default) serves the "coming soon" page, is noindexed and refuses tracking, so a
   * customer's domain never shows Google a half-filled shell. The operator publishes when the content
   * is ready.
   */
  status?: "active" | "paused";
  /** Also register the subdomain with Vercel when configured. */
  provisionVercel?: boolean;
}

/**
 * Creates a site, a subdomain row `{slug}.{ROOT_DOMAIN}` and, when Vercel is configured, registers the
 * subdomain with the Vercel project (auto propagation works when the root domain is on Vercel DNS or a
 * wildcard record points to Vercel).
 */
export async function provisionSite(input: ProvisionInput): Promise<{ site: SiteRecord; hostname: string; vercel: unknown }> {
  const template = getTemplate(input.templateCode) ?? defaultTemplateFor(input.category);
  const demo = input.demo === true;
  const draft = demo
    ? deepMerge(demoContent(input.category), {
        brand: { name: { ar: input.name, en: input.name } },
        seo: { title: { ar: input.name, en: input.name } },
        contact: {
          ...(input.whatsapp ? { whatsapp: input.whatsapp, phone: input.whatsapp } : {}),
          ...(input.email ? { email: input.email } : {}),
        },
        settings: { demo: true },
      })
    : starterContent({ category: input.category, name: input.name, slug: input.slug, whatsapp: input.whatsapp, email: input.email });
  const content = stripFabricated(draft);
  const site = await createSite({ slug: input.slug, name: input.name, category: input.category, templateCode: template.code, content, status: input.status ?? "paused" });
  if (demo) await seedDemoProjects(site.id, input.category);
  const hostname = subdomainHost(site.slug, ROOT_DOMAIN);
  const row = await addDomain({ siteId: site.id, hostname, kind: "subdomain", isPrimary: true, verified: true });
  let vercel: unknown = null;
  if ((input.provisionVercel ?? true) && vercelConfigured()) {
    try {
      vercel = await addDomainToVercel(hostname);
      const v = vercel as { verified?: boolean; configured?: boolean };
      await updateDomainStatus(row.id, { vercelStatus: vercel, verified: !!(v.verified || v.configured) });
    } catch (err) {
      vercel = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { site, hostname, vercel };
}

export async function slugAvailable(slug: string): Promise<boolean> {
  return !(await getSiteBySlug(slug));
}
