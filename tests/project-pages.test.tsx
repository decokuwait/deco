import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale, Project, SiteData, SiteRecord } from "@/lib/types";

/**
 * The project and service pages: the URLs that turn a tenant from one indexable page into ten to forty.
 *
 * These are real route modules, exercised end to end with the request surface (headers, cookies, the
 * database) stubbed out — that is the only way to assert the things that actually matter here: that an
 * unpublished slug is a hard 404, that no content image ships with an empty `alt`, and that both
 * languages render with the right `dir`.
 */

const HOST = "demo.localhost";

// ---------------------------------------------------------------------------------------------------
// Request surface
// ---------------------------------------------------------------------------------------------------

let requestHeaders: Record<string, string> = {};
let site: SiteRecord;
let data: SiteData;

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => requestHeaders[k.toLowerCase()] ?? null }),
  cookies: async () => ({ get: () => undefined }),
}));

/** `notFound()` and `permanentRedirect()` throw in Next; the tests assert on the message. */
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));

vi.mock("@/lib/site-request", () => ({
  getRequestSite: async () => site,
  getRequestVisitorCode: async () => requestHeaders["x-dk-vid"] ?? null,
  clientIp: () => null,
}));

vi.mock("@/lib/db/sites", () => ({ getSiteData: async () => data }));
vi.mock("@/lib/db/pixels", () => ({ getActivePixels: async () => [] }));
vi.mock("@/lib/db/visitors", () => ({ trackVisit: async () => ({ visitor: { code: "654321" }, created: true }) }));
// No `site_domains` rows: `resolvePrimaryHost` falls back to the slug subdomain, which is this host.
vi.mock("@/lib/db/domains", () => ({ listDomains: async () => [] }));

const { TEMPLATES } = await import("@/templates/registry");
const { previewSiteData } = await import("@/lib/preview");
const ProjectsPage = (await import("@/app/tenant/[host]/projects/page")).default;
const projectsMetadata = (await import("@/app/tenant/[host]/projects/page")).generateMetadata;
const ProjectPage = (await import("@/app/tenant/[host]/projects/[slug]/page")).default;
const projectMetadata = (await import("@/app/tenant/[host]/projects/[slug]/page")).generateMetadata;
const ServicesPage = (await import("@/app/tenant/[host]/services/page")).default;
const ServicePage = (await import("@/app/tenant/[host]/services/[slug]/page")).default;
const { findPublishedProject } = await import("@/app/tenant/[host]/projects/_lib/resolve");
const { serviceEntries, findServiceEntry } = await import("@/app/tenant/[host]/services/_lib/entries");
const { serviceSlugs } = await import("@/lib/seo/service-slugs");

const def = TEMPLATES[0];

function makeSite(locale: Locale = "ar"): { site: SiteRecord; data: SiteData } {
  const preview = previewSiteData(def);
  const content = structuredClone(preview.content);
  content.settings.defaultLocale = locale;
  content.settings.showLangToggle = true;
  content.settings.demo = false;
  const record: SiteRecord = {
    id: "site-1",
    slug: "demo",
    name: "Demo Decor",
    category: def.category,
    templateCode: def.code,
    status: "active",
    content,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    plan: "basic",
    priceFils: 0,
    billingCycle: "monthly",
    paidUntil: null,
    lastInvoiceRef: null,
  };
  const siteData: SiteData = { id: record.id, slug: record.slug, category: record.category, templateCode: def.code, content, projects: structuredClone(preview.projects) };
  return { site: record, data: siteData };
}

async function render(node: Promise<React.ReactElement> | React.ReactElement): Promise<string> {
  return renderToStaticMarkup(await node);
}

/** Every `<img>` in the markup, with its alt attribute (null when the attribute is missing entirely). */
function images(html: string): { tag: string; alt: string | null }[] {
  return [...html.matchAll(/<img\b[^>]*>/g)].map((m) => {
    const alt = /\salt="([^"]*)"/.exec(m[0]);
    return { tag: m[0], alt: alt ? alt[1] : null };
  });
}

beforeEach(() => {
  requestHeaders = { "x-dk-host": HOST, "x-dk-path": "/projects" };
  const made = makeSite("ar");
  site = made.site;
  data = made.data;
});

function firstOfType(type: Project["type"]): Project {
  const p = data.projects.find((x) => x.type === type);
  if (!p) throw new Error(`no demo project of type ${type}`);
  return p;
}

// ---------------------------------------------------------------------------------------------------

describe("slug resolution", () => {
  it("finds a published project by its slug, case-insensitively", () => {
    const p = firstOfType("finished");
    expect(findPublishedProject(data.projects, p.slug)?.id).toBe(p.id);
    expect(findPublishedProject(data.projects, p.slug.toUpperCase())?.id).toBe(p.id);
    expect(findPublishedProject(data.projects, encodeURIComponent(p.slug))?.id).toBe(p.id);
  });

  it("refuses an unpublished project, an unknown slug and a malformed one", () => {
    const p = firstOfType("finished");
    const unpublished = data.projects.map((x) => (x.id === p.id ? { ...x, published: false } : x));
    expect(findPublishedProject(unpublished, p.slug)).toBeNull();
    expect(findPublishedProject(data.projects, "no-such-project")).toBeNull();
    expect(findPublishedProject(data.projects, "%E0%A4%A")).toBeNull();
    expect(findPublishedProject(data.projects, "")).toBeNull();
  });

  it("derives service slugs exactly as the sitemap does", () => {
    const entries = serviceEntries(site.content);
    expect(entries.length).toBe(site.content.services.items.length);
    expect(entries.map((e) => e.slug)).toEqual(serviceSlugs(site.content.services.items));
    // Unique, URL-safe, and reversible — the sitemap submits these exact strings.
    expect(new Set(entries.map((e) => e.slug)).size).toBe(entries.length);
    for (const e of entries) {
      expect(e.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(findServiceEntry(entries, e.slug)?.service.id).toBe(e.service.id);
    }
    expect(findServiceEntry(entries, "not-a-service")).toBeNull();
  });
});

describe("/projects", () => {
  it("lists every published project as a real link to its own page", async () => {
    const html = await render(ProjectsPage({ params: Promise.resolve({ host: HOST }), searchParams: Promise.resolve({}) }));
    for (const p of data.projects) {
      expect(html, `missing link for ${p.slug}`).toContain(`href="/projects/${p.slug}"`);
      expect(html).toContain(p.title.ar);
    }
    // Site chrome, so the page belongs to the tenant's template rather than looking like a bare list.
    expect(html).toContain(`data-template="${def.code}"`);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("BreadcrumbList");
  });

  it("renders an empty portfolio as an invitation, not a broken page, and keeps it out of the index", async () => {
    data = { ...data, projects: [] };
    const html = await render(ProjectsPage({ params: Promise.resolve({ host: HOST }), searchParams: Promise.resolve({}) }));
    expect(html).toContain(site.content.brand.name.ar);
    expect(html).toContain("wa.me/");
    expect(html).not.toContain("undefined");
    const meta = await projectsMetadata({ params: Promise.resolve({ host: HOST }), searchParams: Promise.resolve({}) });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("canonicalises each page of the series to itself", async () => {
    const one = await projectsMetadata({ params: Promise.resolve({ host: HOST }), searchParams: Promise.resolve({}) });
    expect(one.alternates?.canonical).toBe(`http://${HOST}:3000/projects`);
    expect(one.robots).toBeUndefined();
  });
});

describe("/projects/<slug>", () => {
  it("renders the gallery, the breadcrumbs and a WhatsApp CTA carrying the visitor id", async () => {
    requestHeaders["x-dk-vid"] = "654321";
    const p = firstOfType("finished");
    const html = await render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: p.slug }) }));

    expect(html).toContain(`<h1`);
    expect(html).toContain(p.title.ar);
    expect(html).toContain(p.location!.ar);
    // Breadcrumbs: visible trail plus the structured data, which needs at least two ListItems.
    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('href="/projects"');
    const crumbs = /"@type":"BreadcrumbList","@id":"[^"]+","itemListElement":(\[.*?\}\])/.exec(html);
    expect(crumbs, "BreadcrumbList JSON-LD").toBeTruthy();
    const items = JSON.parse(crumbs![1]) as { position: number; name: string; item: string }[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const [i, it] of items.entries()) {
      expect(it.position).toBe(i + 1);
      expect(it.name).toBeTruthy();
      expect(it.item).toMatch(/^https?:\/\//);
    }
    // ImageObject markup for the photographs.
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).toContain('"representativeOfPage":true');
    // Every photo is in the DOM, not behind a click.
    const imgs = images(html);
    expect(imgs.length).toBeGreaterThanOrEqual(p.media.filter((m) => m.kind === "image").length);
    // The CTA carries the visitor id inside the prefilled message, exactly like the home page.
    const wa = /https:\/\/wa\.me\/\d+\?text=([^"]+)"/.exec(html);
    expect(wa, "wa.me link").toBeTruthy();
    expect(decodeURIComponent(wa![1].replace(/&amp;/g, "&"))).toContain("654321");
  });

  it("shows the before/after comparison and the progress timeline on the right project types", async () => {
    const ba = firstOfType("before_after");
    const baHtml = await render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: ba.slug }) }));
    expect(baHtml).toContain("قبل");
    expect(baHtml).toContain("بعد");
    // Both sides of the comparison are real <img> elements, so both are crawlable.
    const before = ba.media.find((m) => m.role === "before")!;
    const after = ba.media.find((m) => m.role === "after")!;
    expect(baHtml).toContain(before.url);
    expect(baHtml).toContain(after.url);

    const prog = firstOfType("progress");
    const progHtml = await render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: prog.slug }) }));
    const steps = prog.media.filter((m) => m.role === "step");
    expect(steps.length).toBeGreaterThan(1);
    // Every stage is server-rendered, not one slide with the rest behind a control.
    for (const s of steps) expect(progHtml, `missing step ${s.id}`).toContain(s.url);
  });

  it("never renders an empty alt on a content image, in either language", async () => {
    for (const locale of ["ar", "en"] as Locale[]) {
      const made = makeSite(locale);
      site = made.site;
      data = made.data;
      for (const p of data.projects) {
        const html = await render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: p.slug }) }));
        const imgs = images(html);
        expect(imgs.length, `${locale}/${p.slug} has no images`).toBeGreaterThan(0);
        for (const img of imgs) {
          expect(img.alt, `${locale}/${p.slug}: missing alt on ${img.tag}`).not.toBeNull();
          expect(img.alt!.trim(), `${locale}/${p.slug}: empty alt on ${img.tag}`).not.toBe("");
        }
      }
    }
  });

  it("renders in both locales with the right dir and lang", async () => {
    const p = firstOfType("finished");
    for (const locale of ["ar", "en"] as Locale[]) {
      const made = makeSite(locale);
      site = made.site;
      data = made.data;
      const html = await render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: p.slug }) }));
      expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(locale === "ar" ? p.title.ar : p.title.en);
      expect(html).not.toContain("[object Object]");
    }
  });

  it("404s on an unknown slug and on an unpublished one", async () => {
    await expect(render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: "no-such-project" }) }))).rejects.toThrow("NEXT_NOT_FOUND");

    const p = firstOfType("finished");
    data = { ...data, projects: data.projects.map((x) => (x.id === p.id ? { ...x, published: false } : x)) };
    await expect(render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: p.slug }) }))).rejects.toThrow("NEXT_NOT_FOUND");
    const meta = await projectMetadata({ params: Promise.resolve({ host: HOST, slug: p.slug }) });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("404s on every inner page of a paused site", async () => {
    site = { ...site, status: "paused" };
    const p = firstOfType("finished");
    await expect(render(ProjectPage({ params: Promise.resolve({ host: HOST, slug: p.slug }) }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(render(ProjectsPage({ params: Promise.resolve({ host: HOST }), searchParams: Promise.resolve({}) }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/services", () => {
  it("gives every service its own URL instead of one shared anchor", async () => {
    const html = await render(ServicesPage({ params: Promise.resolve({ host: HOST }) }));
    const entries = serviceEntries(site.content);
    expect(entries.length).toBeGreaterThan(1);
    for (const e of entries) {
      expect(html, `missing link for ${e.slug}`).toContain(`href="/services/${e.slug}"`);
      expect(html).toContain(e.service.title.ar);
    }
    // The links are distinct destinations, which is the whole point of the change.
    const hrefs = [...html.matchAll(/href="\/services\/([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(hrefs).size).toBe(entries.length);
  });

  it("renders a service page with its copy, related work, a CTA and Service markup", async () => {
    const entry = serviceEntries(site.content)[0];
    const html = await render(ServicePage({ params: Promise.resolve({ host: HOST, slug: entry.slug }) }));
    expect(html).toContain(entry.service.title.ar);
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain("BreadcrumbList");
    expect(html).toContain("wa.me/");
    // It links back out: to the services index and to at least one project page.
    expect(html).toContain('href="/services"');
    expect(html).toMatch(/href="\/projects\/[^"]+"/);
    for (const img of images(html)) expect(img.alt?.trim()).toBeTruthy();
  });

  it("404s on an unknown service slug and when the services section is switched off", async () => {
    await expect(render(ServicePage({ params: Promise.resolve({ host: HOST, slug: "not-a-service" }) }))).rejects.toThrow("NEXT_NOT_FOUND");
    const entry = serviceEntries(site.content)[0];
    site = { ...site, content: { ...site.content, sections: { ...site.content.sections, services: false } } };
    await expect(render(ServicePage({ params: Promise.resolve({ host: HOST, slug: entry.slug }) }))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
