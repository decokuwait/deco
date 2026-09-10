import type { Category, SiteContent, SiteRecord } from "@/lib/types";
import { createSite, getSiteBySlug } from "@/lib/db/sites";
import { addDomain, updateDomainStatus } from "@/lib/db/domains";
import { addMedia, createProject } from "@/lib/db/projects";
import { demoContent, demoProjects } from "@/lib/demo/content";
import { deepMerge, emptyContent } from "@/lib/content/defaults";
import { subdomainHost } from "@/lib/tenant";
import { ROOT_DOMAIN } from "@/lib/config";
import { addDomainToVercel, vercelConfigured } from "@/lib/vercel";
import { defaultTemplateFor, getTemplate } from "@/templates/registry";

/** Copies the category demo projects (with media) into a site so it looks complete from day one. */
export async function seedDemoProjects(siteId: string, category: Category): Promise<number> {
  let n = 0;
  for (const p of demoProjects(category)) {
    const created = await createProject({ siteId, type: p.type, title: p.title, description: p.description, location: p.location, coverUrl: p.coverUrl, published: true });
    for (const m of p.media) {
      await addMedia({ projectId: created.id, kind: m.kind, url: m.url, posterUrl: m.posterUrl, role: m.role, caption: m.caption, stepLabel: m.stepLabel, stepDate: m.stepDate });
    }
    n++;
  }
  return n;
}

/**
 * Content for a brand-new real customer site: section titles, CTA texts and defaults from the demo
 * (so nothing renders empty), but no fabricated services, stats, testimonials, FAQ or media.
 */
export function starterContent(category: Category, name: string, whatsapp?: string): SiteContent {
  const demo = demoContent(category);
  const base = emptyContent();
  return deepMerge(base, {
    brand: { name: { ar: name, en: name }, tagline: demo.brand.tagline },
    contact: { ...base.contact, whatsapp: whatsapp || "", phone: whatsapp || "", title: demo.contact.title, subtitle: demo.contact.subtitle },
    hero: { badge: demo.hero.badge, title: demo.hero.title, subtitle: demo.hero.subtitle, primaryCta: demo.hero.primaryCta, secondaryCta: demo.hero.secondaryCta },
    about: { title: demo.about.title },
    services: { title: demo.services.title, subtitle: demo.services.subtitle },
    process: { title: demo.process.title, subtitle: demo.process.subtitle },
    projects: demo.projects,
    testimonials: { title: demo.testimonials.title, subtitle: demo.testimonials.subtitle },
    faq: { title: demo.faq.title, subtitle: demo.faq.subtitle },
    cta: demo.cta,
    seo: { title: { ar: name, en: name }, description: demo.brand.tagline, keywords: demo.seo.keywords },
  });
}

export interface ProvisionInput {
  slug: string;
  name: string;
  category: Category;
  templateCode?: string;
  whatsapp?: string;
  /** Copy the category demo projects into the site (default true). */
  seedProjects?: boolean;
  /** Start from the full demo content (services, stats, testimonials, FAQ). Default true; false = starter content. */
  demoContent?: boolean;
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
  const useDemo = input.demoContent ?? true;
  const content = useDemo
    ? deepMerge(demoContent(input.category), {
        brand: { name: { ar: input.name, en: input.name } },
        seo: { title: { ar: input.name, en: input.name } },
        contact: input.whatsapp ? { whatsapp: input.whatsapp, phone: input.whatsapp } : {},
      })
    : starterContent(input.category, input.name, input.whatsapp);
  const site = await createSite({ slug: input.slug, name: input.name, category: input.category, templateCode: template.code, content, status: input.status ?? "active" });
  if (input.seedProjects ?? true) await seedDemoProjects(site.id, input.category);
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
