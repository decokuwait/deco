import type { LText, Locale, Project, Service } from "@/lib/types";
import { LOCALES } from "@/lib/types";

/**
 * Matching a project to the service it belongs to, and vice versa.
 *
 * Services are free text in `SiteContent`; projects are database rows. There is no relation between
 * them and adding one is a content-model change nobody asked for, so the link is inferred from the
 * words the owner wrote. The point is internal linking, not precision: a wrong-but-related suggestion
 * costs nothing, an empty "related" block costs a crawl path.
 */

/** Words too common in this trade to carry any signal; matching on them relates everything to everything. */
const STOP = new Set([
  "and", "the", "for", "with", "our", "your", "from", "kuwait", "work", "works", "project", "projects", "service", "services",
  "في", "من", "على", "مع", "الكويت", "خدمة", "خدمات", "مشروع", "مشاريع", "أعمال", "اعمال",
]);

/**
 * Comparable words from a bilingual string. Arabic is normalised the way a reader would: the definite
 * article `ال` is dropped, alef/ya/ta-marbuta variants are folded together and the harakat are stripped,
 * so "الأسقف" and "اسقف" are the same word.
 */
function tokens(values: (LText | null | undefined | string)[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const texts = typeof v === "string" ? [v] : LOCALES.map((l) => v[l]);
    for (const text of texts) {
      if (!text) continue;
      const normalized = text
        .toLowerCase()
        .replace(/[ـً-ْٰ]/g, "")
        .replace(/[آأإ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/[ى]/g, "ي")
        .replace(/[^\p{L}\p{N}]+/gu, " ");
      for (let word of normalized.split(" ")) {
        if (word.startsWith("ال") && word.length > 4) word = word.slice(2);
        if (word.length < 3 || STOP.has(word)) continue;
        out.add(word);
      }
    }
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/** Services whose wording overlaps this project's, best first. Empty when nothing matches. */
export function servicesForProject(services: Service[], project: Project, limit = 2): Service[] {
  const words = tokens([project.title, project.description, project.location]);
  if (!words.size) return [];
  return services
    .map((s) => ({ s, score: overlap(words, tokens([s.title, s.description])) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.s);
}

/**
 * Projects that illustrate this service, best first. Projects that share no wording at all are appended
 * (published, newest order first) so a service page is never a dead end with a single paragraph on it.
 */
export function projectsForService(projects: Project[], service: Service, limit = 6): Project[] {
  const words = tokens([service.title, service.description]);
  const scored = projects.map((p) => ({ p, score: words.size ? overlap(words, tokens([p.title, p.description, p.location])) : 0 }));
  const matched = scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  if (matched.length >= limit) return matched.slice(0, limit).map((r) => r.p);
  const rest = scored.filter((r) => r.score === 0).map((r) => r.p);
  return [...matched.map((r) => r.p), ...rest].slice(0, limit);
}

/** Other projects to offer at the bottom of a project page: same type first, then anything else. */
export function relatedProjects(projects: Project[], current: Project, limit = 3): Project[] {
  const others = projects.filter((p) => p.id !== current.id);
  const sameType = others.filter((p) => p.type === current.type);
  const words = tokens([current.title, current.description, current.location]);
  const byWords = [...others]
    .map((p) => ({ p, score: overlap(words, tokens([p.title, p.description, p.location])) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const p of [...byWords, ...sameType, ...others]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length === limit) break;
  }
  return out;
}

/** FAQ entries whose question or answer mentions this service's words. */
export function faqsFor(items: { id: string; q: LText; a: LText }[], service: Service, _locale: Locale, limit = 4) {
  const words = tokens([service.title, service.description]);
  if (!words.size) return [];
  return items
    .map((f) => ({ f, score: overlap(words, tokens([f.q, f.a])) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.f);
}
