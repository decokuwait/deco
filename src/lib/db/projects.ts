import { q, one, isUuid, json, parseJson } from "./client";
import type { LText, MediaItem, MediaKind, MediaRole, Project, ProjectType } from "@/lib/types";

interface ProjectRow {
  id: string;
  site_id: string;
  type: ProjectType;
  slug: string | null;
  title: unknown;
  description: unknown;
  location: unknown;
  cover_url: string | null;
  published: boolean;
  sort_order: number;
}

interface MediaRow {
  id: string;
  project_id: string;
  kind: MediaKind;
  url: string;
  poster_url: string | null;
  role: MediaRole;
  caption: unknown;
  alt: unknown;
  step_label: unknown;
  step_date: unknown;
  sort_order: number;
  focal: string | null;
}

const E: LText = { ar: "", en: "" };

/** Explicit column list, never `select *`: a `select p.*` silently picks up whatever a later migration adds. */
const PROJECT_FIELDS = ["id", "site_id", "type", "slug", "title", "description", "location", "cover_url", "published", "sort_order"];
function projectCols(alias = "p") {
  return PROJECT_FIELDS.map((c) => `${alias}.${c}`).join(", ");
}

const MEDIA_FIELDS = ["id", "project_id", "kind", "url", "poster_url", "role", "caption", "alt", "step_label", "step_date", "sort_order", "focal"];
function mediaCols(alias = "m") {
  return MEDIA_FIELDS.map((c) => `${alias}.${c}`).join(", ");
}

/**
 * Arabic to Latin, for slugs. The content is Arabic-first, so a slug derived only from the English title
 * would be `p-4f3a1c` for most projects — an unreadable URL on the one page type that exists to be shared.
 * The mapping is deliberately plain (no ʿayn, no macrons): a URL segment is `[a-z0-9-]` by contract.
 */
const AR_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w",
  "ي": "y", "ى": "a", "ة": "a", "ء": "", "ئ": "y", "ؤ": "w", "پ": "p", "چ": "ch", "ژ": "zh", "گ": "g",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export const PROJECT_SLUG_MAX = 80;

/**
 * Normalises any text into a URL segment: lowercase Latin `[a-z0-9-]`, no leading, trailing or doubled
 * dashes. Returns "" when nothing survives, which the callers treat as "derive one instead".
 */
export function normalizeProjectSlug(input: string): string {
  const mapped = input
    .normalize("NFKD")
    // Strip combining marks after NFKD: Arabic harakat, and the accents split off Latin letters (é -> e).
    .replace(/[ً-ٰٟ̀-ͯ]/g, "")
    .replace(/[؀-ۿ]/g, (ch) => AR_LATIN[ch] ?? " ")
    .toLowerCase();
  return mapped
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PROJECT_SLUG_MAX)
    .replace(/-+$/g, "");
}

/** True for a slug that may be stored as-is. Anything else is normalised or rejected by the callers. */
export function isValidProjectSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length > 0 && slug.length <= PROJECT_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** The slug a project gets when nobody typed one: title then location, English first, Arabic transliterated. */
export function projectSlugFrom(title: LText | null | undefined, location?: LText | null): string {
  const parts = [title?.en || title?.ar || "", location?.en || location?.ar || ""].filter(Boolean);
  return normalizeProjectSlug(parts.join(" ")) || "project";
}

/**
 * Makes `desired` unique within the site by appending `-2`, `-3`, … The candidates are read in one query
 * rather than probed one at a time, and the unique index `projects_site_slug_idx` is still the real
 * guarantee: two admins saving at once is settled there, and `createProject` retries on 23505.
 */
export async function uniqueProjectSlug(siteId: string, desired: string, excludeProjectId?: string | null): Promise<string> {
  const base = normalizeProjectSlug(desired) || "project";
  const rows = await q<{ slug: string }>(
    `select slug from projects
     where site_id = $1 and slug is not null and (slug = $2 or slug like $3) and ($4::uuid is null or id <> $4::uuid)`,
    [siteId, base, `${base}-%`, excludeProjectId ?? null],
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base.slice(0, PROJECT_SLUG_MAX - 6)}-${i}`.replace(/-+-/g, "-");
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("slug_exhausted");
}

/** Validates an author-supplied slug, or derives one. Throws `invalid_slug` rather than silently mangling. */
async function resolveSlug(
  siteId: string,
  supplied: string | null | undefined,
  fallback: { title?: LText | null; location?: LText | null },
  excludeProjectId?: string | null,
): Promise<string> {
  if (supplied != null && supplied !== "") {
    const normalized = normalizeProjectSlug(supplied);
    // An author who types a slug gets told it is unusable; they do not get a different one behind their back.
    if (!isValidProjectSlug(normalized)) throw new Error("invalid_slug");
    return uniqueProjectSlug(siteId, normalized, excludeProjectId);
  }
  return uniqueProjectSlug(siteId, projectSlugFrom(fallback.title, fallback.location), excludeProjectId);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && String((e as { code?: unknown }).code) === "23505";
}

function mapMedia(m: MediaRow): MediaItem {
  let stepDate: string | null = null;
  if (m.step_date instanceof Date) stepDate = m.step_date.toISOString().slice(0, 10);
  else if (typeof m.step_date === "string") stepDate = m.step_date.slice(0, 10);
  return {
    id: m.id,
    kind: m.kind,
    url: m.url,
    posterUrl: m.poster_url,
    role: m.role,
    caption: parseJson<LText | null>(m.caption, null),
    alt: parseJson<LText | null>(m.alt, null),
    stepLabel: parseJson<LText | null>(m.step_label, null),
    stepDate,
    order: m.sort_order,
    // 0008 added the column and the admin has written to it since, but nothing read it back on the render
    // path — so the three-position focal picker had no effect on any page, whatever the templates did with
    // `MediaItem.focal`. The check constraint limits the column to these three, and anything else (or null)
    // means centre, which is what every row had before the column existed.
    focal: m.focal === "top" || m.focal === "center" || m.focal === "bottom" ? m.focal : null,
  };
}

function mapProject(r: ProjectRow, media: MediaItem[]): Project {
  return {
    id: r.id,
    type: r.type,
    // 0005 backfilled every existing row, and every write path derives one, so a null here would mean a row
    // inserted by hand. It still gets a usable URL rather than `/projects/null`.
    slug: r.slug || `p-${r.id.slice(0, 8)}`,
    title: parseJson<LText>(r.title, E),
    description: parseJson<LText>(r.description, E),
    location: parseJson<LText | null>(r.location, null),
    coverUrl: r.cover_url,
    published: !!r.published,
    order: r.sort_order,
    media,
  };
}

export interface ProjectQuery {
  type?: ProjectType;
  publishedOnly?: boolean;
}

/** The media of a project as a json array, ordered the same way everywhere. Keeps the listing to one round trip. */
const MEDIA_JSON = `coalesce((select json_agg(json_build_object(
     'id', m.id, 'project_id', m.project_id, 'kind', m.kind, 'url', m.url, 'poster_url', m.poster_url,
     'role', m.role, 'caption', m.caption, 'alt', m.alt, 'step_label', m.step_label,
     'step_date', m.step_date, 'sort_order', m.sort_order, 'focal', m.focal) order by m.sort_order, m.created_at)
   from project_media m where m.project_id = p.id), '[]'::json) as media`;

/** Projects with their media in one round trip (the public page renders every published project). */
export async function listProjects(siteId: string, opts: ProjectQuery = {}): Promise<Project[]> {
  const rows = await q<ProjectRow & { media: unknown }>(
    `select ${projectCols("p")}, ${MEDIA_JSON}
     from projects p
     where p.site_id = $1 and ($2::text is null or p.type = $2) and ($3::boolean = false or p.published = true)
     order by p.type, p.sort_order, p.created_at`,
    [siteId, opts.type ?? null, opts.publishedOnly ?? false],
  );
  return rows.map((r) => mapProject(r, parseJson<MediaRow[]>(r.media, []).map(mapMedia)));
}

/** What the public project pages read. Never returns a draft, whatever the caller forgets to pass. */
export async function listPublishedProjects(siteId: string, opts: Omit<ProjectQuery, "publishedOnly"> = {}): Promise<Project[]> {
  return listProjects(siteId, { ...opts, publishedOnly: true });
}

export async function getProject(id: string): Promise<(Project & { siteId: string }) | null> {
  if (!isUuid(id)) return null;
  const r = await one<ProjectRow>(`select ${projectCols("p")} from projects p where p.id = $1`, [id]);
  if (!r) return null;
  const media = await q<MediaRow>(`select ${mediaCols("m")} from project_media m where m.project_id = $1 order by m.sort_order, m.created_at`, [id]);
  return { ...mapProject(r, media.map(mapMedia)), siteId: r.site_id };
}

/**
 * A project by its URL segment, scoped to the site. The site id is part of the lookup, not a check after
 * it: slugs are unique per site, so a bare `where slug = $1` would hand one tenant another tenant's project.
 * `publishedOnly` defaults to true because the public detail page is the caller that matters.
 */
export async function getProjectBySlug(
  siteId: string,
  slug: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<(Project & { siteId: string }) | null> {
  if (!isUuid(siteId) || typeof slug !== "string" || !slug) return null;
  const publishedOnly = opts.publishedOnly ?? true;
  const r = await one<ProjectRow & { media: unknown }>(
    `select ${projectCols("p")}, ${MEDIA_JSON}
     from projects p
     where p.site_id = $1 and p.slug = $2 and ($3::boolean = false or p.published = true)`,
    [siteId, slug.toLowerCase(), publishedOnly],
  );
  if (!r) return null;
  return { ...mapProject(r, parseJson<MediaRow[]>(r.media, []).map(mapMedia)), siteId: r.site_id };
}

export async function createProject(input: {
  siteId: string;
  type: ProjectType;
  title: LText;
  description?: LText;
  location?: LText | null;
  coverUrl?: string | null;
  published?: boolean;
  /** Optional: an author-typed URL segment. Validated, deduped per site, derived from title+location if absent. */
  slug?: string | null;
}): Promise<Project> {
  const next = await one<{ n: unknown }>(`select coalesce(max(sort_order), -1) + 1 as n from projects where site_id = $1 and type = $2`, [
    input.siteId,
    input.type,
  ]);
  // The dedupe read and the insert are not atomic, so the unique index settles a tie and we try again with
  // the next free suffix. Bounded: a real conflict resolves on the second pass.
  for (let attempt = 0; ; attempt++) {
    const slug = await resolveSlug(input.siteId, input.slug, { title: input.title, location: input.location });
    try {
      const r = await one<ProjectRow>(
        `insert into projects (site_id, type, slug, title, description, location, cover_url, published, sort_order)
         values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9) returning ${projectCols("projects")}`,
        [
          input.siteId,
          input.type,
          slug,
          json(input.title),
          json(input.description ?? E),
          json(input.location ?? null),
          input.coverUrl ?? null,
          input.published ?? true,
          Number(next?.n ?? 0),
        ],
      );
      return mapProject(r!, []);
    } catch (e) {
      if (attempt >= 3 || !isUniqueViolation(e)) throw e;
    }
  }
}

/** Fields left out of `patch` keep their value; fields set to null are cleared. See updateVisitor on why
 *  "keep" is a separate boolean parameter and not a sentinel value. */
export async function updateProject(
  id: string,
  patch: Partial<{
    title: LText;
    description: LText;
    location: LText | null;
    coverUrl: string | null;
    published: boolean;
    type: ProjectType;
    /** An author-typed URL segment. Validated and deduped within the site, ignoring this project's own row. */
    slug: string;
  }>,
): Promise<void> {
  let slug: string | null = null;
  if (patch.slug !== undefined) {
    if (!isUuid(id)) return;
    const owner = await one<{ site_id: string }>(`select site_id from projects where id = $1`, [id]);
    if (!owner) return;
    slug = await resolveSlug(owner.site_id, patch.slug, { title: patch.title }, id);
  }
  await q(
    `update projects set
       slug = coalesce($10, slug),
       title = coalesce($2::jsonb, title),
       description = coalesce($3::jsonb, description),
       location = case when $4::boolean then location else $5::jsonb end,
       cover_url = case when $6::boolean then cover_url else $7 end,
       published = coalesce($8, published),
       type = coalesce($9, type),
       updated_at = now()
     where id = $1`,
    [
      id,
      patch.title ? json(patch.title) : null,
      patch.description ? json(patch.description) : null,
      patch.location === undefined, patch.location === undefined ? null : json(patch.location),
      patch.coverUrl === undefined, patch.coverUrl ?? null,
      patch.published ?? null,
      patch.type ?? null,
      slug,
    ],
  );
}

export async function deleteProject(id: string) {
  await q(`delete from projects where id = $1`, [id]);
}

/**
 * Moves a project one step within its type. Uses the same total order as listProjects
 * (sort_order, created_at) and swaps both rows in one statement; equal sort_orders are split apart.
 */
export async function moveProject(id: string, direction: "up" | "down") {
  const p = await one<{ id: string; sort_order: number }>(`select id, sort_order from projects where id = $1`, [id]);
  if (!p) return;
  // The neighbour is resolved in one statement so created_at never crosses the driver: postgres.js truncates
  // timestamp parameters to milliseconds, and a truncated value sorts before the row itself, so a "down"
  // move used to pick the row as its own neighbour and bump its own sort_order instead of swapping.
  const neighbor = await one<{ id: string; sort_order: number }>(
    direction === "up"
      ? `with me as (select site_id, type, sort_order, created_at from projects where id = $1)
         select p.id, p.sort_order from projects p, me
         where p.site_id = me.site_id and p.type = me.type and (p.sort_order, p.created_at) < (me.sort_order, me.created_at)
         order by p.sort_order desc, p.created_at desc limit 1`
      : `with me as (select site_id, type, sort_order, created_at from projects where id = $1)
         select p.id, p.sort_order from projects p, me
         where p.site_id = me.site_id and p.type = me.type and (p.sort_order, p.created_at) > (me.sort_order, me.created_at)
         order by p.sort_order asc, p.created_at asc limit 1`,
    [id],
  );
  if (!neighbor) return;
  const [mine, theirs] = p.sort_order === neighbor.sort_order ? (direction === "up" ? [neighbor.sort_order - 1, p.sort_order] : [neighbor.sort_order + 1, p.sort_order]) : [neighbor.sort_order, p.sort_order];
  await q(`update projects set sort_order = case id when $1::uuid then $3::int when $2::uuid then $4::int end, updated_at = now() where id in ($1::uuid, $2::uuid)`, [p.id, neighbor.id, mine, theirs]);
}

export async function addMedia(input: {
  projectId: string;
  kind: MediaKind;
  url: string;
  posterUrl?: string | null;
  role?: MediaRole;
  caption?: LText | null;
  /** Authorable alt text. Null means "generate one at render time" — never render alt="" for a content image. */
  alt?: LText | null;
  stepLabel?: LText | null;
  stepDate?: string | null;
}): Promise<MediaItem> {
  const next = await one<{ n: unknown }>(`select coalesce(max(sort_order), -1) + 1 as n from project_media where project_id = $1`, [input.projectId]);
  const r = await one<MediaRow>(
    `insert into project_media (project_id, kind, url, poster_url, role, caption, alt, step_label, step_date, sort_order)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::date, $10) returning ${mediaCols("project_media")}`,
    [
      input.projectId,
      input.kind,
      input.url,
      input.posterUrl ?? null,
      input.role ?? "gallery",
      json(input.caption ?? null),
      json(input.alt ?? null),
      json(input.stepLabel ?? null),
      input.stepDate || null,
      Number(next?.n ?? 0),
    ],
  );
  return mapMedia(r!);
}

/** Same "keep" convention as updateProject: absent means keep, null means clear. */
export async function updateMedia(
  id: string,
  patch: Partial<{
    role: MediaRole;
    caption: LText | null;
    alt: LText | null;
    stepLabel: LText | null;
    stepDate: string | null;
    posterUrl: string | null;
    url: string;
  }>,
) {
  await q(
    `update project_media set
       role = coalesce($2, role),
       caption = case when $3::boolean then caption else $4::jsonb end,
       step_label = case when $5::boolean then step_label else $6::jsonb end,
       step_date = case when $7::boolean then step_date else nullif($8, '')::date end,
       poster_url = case when $9::boolean then poster_url else $10 end,
       url = coalesce($11, url),
       alt = case when $12::boolean then alt else $13::jsonb end
     where id = $1`,
    [
      id,
      patch.role ?? null,
      patch.caption === undefined, patch.caption === undefined ? null : json(patch.caption),
      patch.stepLabel === undefined, patch.stepLabel === undefined ? null : json(patch.stepLabel),
      patch.stepDate === undefined, patch.stepDate ?? "",
      patch.posterUrl === undefined, patch.posterUrl ?? null,
      patch.url ?? null,
      patch.alt === undefined, patch.alt === undefined ? null : json(patch.alt),
    ],
  );
}

export async function deleteMedia(id: string) {
  await q(`delete from project_media where id = $1`, [id]);
}

export async function getMedia(id: string): Promise<(MediaItem & { projectId: string }) | null> {
  if (!isUuid(id)) return null;
  const r = await one<MediaRow>(`select ${mediaCols("m")} from project_media m where m.id = $1`, [id]);
  return r ? { ...mapMedia(r), projectId: r.project_id } : null;
}

/** Moves a media item one step within its project (same total order as the listing; single-statement swap). */
export async function moveMedia(id: string, direction: "up" | "down") {
  const m = await one<{ id: string; sort_order: number }>(`select id, sort_order from project_media where id = $1`, [id]);
  if (!m) return;
  // Resolved server-side, for the same reason as moveProject.
  const neighbor = await one<{ id: string; sort_order: number }>(
    direction === "up"
      ? `with me as (select project_id, sort_order, created_at from project_media where id = $1)
         select pm.id, pm.sort_order from project_media pm, me
         where pm.project_id = me.project_id and (pm.sort_order, pm.created_at) < (me.sort_order, me.created_at)
         order by pm.sort_order desc, pm.created_at desc limit 1`
      : `with me as (select project_id, sort_order, created_at from project_media where id = $1)
         select pm.id, pm.sort_order from project_media pm, me
         where pm.project_id = me.project_id and (pm.sort_order, pm.created_at) > (me.sort_order, me.created_at)
         order by pm.sort_order asc, pm.created_at asc limit 1`,
    [id],
  );
  if (!neighbor) return;
  const [mine, theirs] = m.sort_order === neighbor.sort_order ? (direction === "up" ? [neighbor.sort_order - 1, m.sort_order] : [neighbor.sort_order + 1, m.sort_order]) : [neighbor.sort_order, m.sort_order];
  await q(`update project_media set sort_order = case id when $1::uuid then $3::int when $2::uuid then $4::int end where id in ($1::uuid, $2::uuid)`, [m.id, neighbor.id, mine, theirs]);
}

export async function countProjects(siteId: string): Promise<Record<ProjectType, number>> {
  const rows = await q<{ type: ProjectType; n: unknown }>(`select type, count(*) as n from projects where site_id = $1 group by type`, [siteId]);
  const out: Record<ProjectType, number> = { finished: 0, before_after: 0, progress: 0 };
  for (const r of rows) out[r.type] = Number(r.n);
  return out;
}
