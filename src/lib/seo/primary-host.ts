import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { listDomains } from "@/lib/db/domains";
import { ROOT_DOMAIN, siteUrl } from "@/lib/config";
import { subdomainHost } from "@/lib/tenant";

/** The parts of a `site_domains` row the resolver needs. Kept structural so it is unit-testable without a database. */
export interface DomainLike {
  hostname: string;
  kind: "subdomain" | "custom";
  isPrimary: boolean;
  verified: boolean;
}

export interface PrimaryHost {
  /** Bare hostname: no scheme, no port, no `www.`. */
  host: string;
  source: "verified-custom" | "primary-subdomain" | "slug";
  /**
   * Whether every other host must be 301'd here. Only a *verified* custom domain earns that: bouncing a
   * domain whose DNS is still propagating would make the site unreachable on the one host that works.
   */
  enforce: boolean;
}

function bare(h: string): string {
  const v = h.trim().toLowerCase().replace(/:\d+$/, "");
  return v.startsWith("www.") ? v.slice(4) : v;
}

/**
 * The ONE hostname a site is published on.
 *
 * Every SEO surface — `alternates.canonical`, `openGraph.url`, the JSON-LD `url`, the sitemap base and
 * the `Sitemap:` line in robots.txt — must agree on this value, and none of them may derive it from the
 * request host. A site reachable at both `alfaisal.decokuwait.com` and `alfaisal-decor.com` served
 * byte-identical HTML that declared *itself* canonical on each, so Google picked one at random and
 * routinely showed the subdomain the customer did not pay for.
 *
 * `site_domains.is_primary` has existed and been written at provision time since the first migration and
 * was read nowhere; this is the reader. A verified custom domain always wins, because that is the domain
 * the customer bought.
 */
export function resolvePrimaryHost(domains: DomainLike[], opts: { slug: string; rootDomain?: string }): PrimaryHost {
  const root = opts.rootDomain ?? ROOT_DOMAIN;
  const customs = domains.filter((d) => d.kind === "custom" && d.verified && d.hostname);
  const flagged = customs.find((d) => d.isPrimary) ?? customs[0];
  if (flagged) return { host: bare(flagged.hostname), source: "verified-custom", enforce: true };
  const sub = domains.find((d) => d.kind === "subdomain" && d.isPrimary && d.hostname) ?? domains.find((d) => d.kind === "subdomain" && d.hostname);
  if (sub) return { host: bare(sub.hostname), source: "primary-subdomain", enforce: false };
  // No rows at all (seeded or half-provisioned site): the slug subdomain always resolves.
  return { host: subdomainHost(opts.slug, root), source: "slug", enforce: false };
}

/**
 * The host a request must be redirected to, or null when it is already on the right one.
 *
 * A canonical tag is a hint; a redirect is not. Once the custom domain is verified the subdomain is a
 * duplicate and is sent away permanently. `www.` is always folded into the apex, for the subdomain case
 * too — `www.elite.decokuwait.com` used to serve a second copy of a tenant with no redirect at all,
 * because the proxy only ever de-`www`'d custom domains.
 */
export function primaryRedirectTarget(requestHost: string | null | undefined, primary: PrimaryHost): string | null {
  const raw = (requestHost || "").trim().toLowerCase().replace(/:\d+$/, "");
  if (!raw) return null;
  if (raw === primary.host) return null;
  if (primary.enforce) return primary.host;
  if (raw.startsWith("www.") && raw.slice(4) === primary.host) return primary.host;
  return null;
}

/**
 * Primary host of a site, from the database. `cache()`d per request so metadata, the page body and the
 * JSON-LD graph share one round trip — `generateMetadata` and the component tree each resolve it.
 */
export const getSitePrimaryHost = cache(async (site: { id: string; slug: string }): Promise<PrimaryHost> => {
  const domains = await listDomains(site.id).catch(() => []);
  return resolvePrimaryHost(domains, { slug: site.slug });
});

/** Absolute URL of a path on the site's primary host. `path` starts with `/`. */
export function primaryUrl(primary: PrimaryHost, path = "/"): string {
  return siteUrl(primary.host, path);
}

/**
 * Send a request that did not arrive on the primary host there, permanently. Throws; never returns.
 *
 * Every indexable tenant URL must call this — the `/projects` and `/services` pages included.
 * Call it **before any await that could open a Suspense boundary**: once the body starts streaming the
 * HTTP status is fixed, and a duplicate host would then get a 200 with a canonical tag, which is a hint
 * rather than an instruction.
 */
export function enforcePrimaryHost(primary: PrimaryHost, requestHost: string, pathAndQuery = "/"): void {
  const target = primaryRedirectTarget(requestHost, primary);
  if (target) permanentRedirect(siteUrl(target, pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`));
}
