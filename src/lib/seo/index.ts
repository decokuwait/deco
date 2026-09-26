/**
 * The shared SEO surface: everything that renders a tenant URL builds against this.
 *
 * Every indexable page — tenant home, project, service, platform gallery — must agree on three things,
 * and all three live here: which host a site is published on (`primary-host`), which languages it is
 * published in (`locale`), and what its entity markup says (`jsonld`). A page that derives any of them
 * from the request host or from a cookie reintroduces the duplicate-content bug this module exists to
 * close.
 */
export {
  enforcePrimaryHost,
  getSitePrimaryHost,
  primaryRedirectTarget,
  primaryUrl,
  resolvePrimaryHost,
  type DomainLike,
  type PrimaryHost,
} from "./primary-host";
export { englishIsPublished, isEnglishText, langPath, publishedLocales, urlLocale } from "./locale";
export { absolute, breadcrumbList, geoPoint, ldJson, openingHours, platformGraph, postalAddress, tenantGraph, type BreadcrumbItem } from "./jsonld";
export { CATEGORY_SEO, tenantDescription, tenantTitle } from "./titles";
export { findServiceBySlug, serviceSlugs, slugify } from "./service-slugs";
export { siteLastmod } from "./lastmod";
