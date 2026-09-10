import { q, one, iso, json, parseJson } from "./client";
import type { LText, MediaItem, MediaKind, MediaRole, Project, ProjectType } from "@/lib/types";

interface ProjectRow {
  id: string;
  site_id: string;
  type: ProjectType;
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
  step_label: unknown;
  step_date: unknown;
  sort_order: number;
}

const E: LText = { ar: "", en: "" };

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
    stepLabel: parseJson<LText | null>(m.step_label, null),
    stepDate,
    order: m.sort_order,
  };
}

function mapProject(r: ProjectRow, media: MediaItem[]): Project {
  return {
    id: r.id,
    type: r.type,
    title: parseJson<LText>(r.title, E),
    description: parseJson<LText>(r.description, E),
    location: parseJson<LText | null>(r.location, null),
    coverUrl: r.cover_url,
    published: !!r.published,
    order: r.sort_order,
    media,
  };
}

export async function listProjects(siteId: string, opts: { type?: ProjectType; publishedOnly?: boolean } = {}): Promise<Project[]> {
  const rows = await q<ProjectRow>(
    `select * from projects where site_id = $1 and ($2::text is null or type = $2) and ($3::boolean = false or published = true)
     order by type, sort_order, created_at`,
    [siteId, opts.type ?? null, opts.publishedOnly ?? false],
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const media = await q<MediaRow>(`select * from project_media where project_id = any($1::uuid[]) order by sort_order, created_at`, [ids]);
  const byProject = new Map<string, MediaItem[]>();
  for (const m of media) {
    const arr = byProject.get(m.project_id) ?? [];
    arr.push(mapMedia(m));
    byProject.set(m.project_id, arr);
  }
  return rows.map((r) => mapProject(r, byProject.get(r.id) ?? []));
}

export async function getProject(id: string): Promise<(Project & { siteId: string }) | null> {
  const r = await one<ProjectRow>(`select * from projects where id = $1`, [id]);
  if (!r) return null;
  const media = await q<MediaRow>(`select * from project_media where project_id = $1 order by sort_order, created_at`, [id]);
  return { ...mapProject(r, media.map(mapMedia)), siteId: r.site_id };
}

export async function createProject(input: {
  siteId: string;
  type: ProjectType;
  title: LText;
  description?: LText;
  location?: LText | null;
  coverUrl?: string | null;
  published?: boolean;
}): Promise<Project> {
  const next = await one<{ n: unknown }>(`select coalesce(max(sort_order), -1) + 1 as n from projects where site_id = $1 and type = $2`, [
    input.siteId,
    input.type,
  ]);
  const r = await one<ProjectRow>(
    `insert into projects (site_id, type, title, description, location, cover_url, published, sort_order)
     values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8) returning *`,
    [
      input.siteId,
      input.type,
      json(input.title),
      json(input.description ?? E),
      json(input.location ?? null),
      input.coverUrl ?? null,
      input.published ?? true,
      Number(next?.n ?? 0),
    ],
  );
  return mapProject(r!, []);
}

export async function updateProject(
  id: string,
  patch: Partial<{ title: LText; description: LText; location: LText | null; coverUrl: string | null; published: boolean; type: ProjectType }>,
): Promise<void> {
  await q(
    `update projects set
       title = coalesce($2::jsonb, title),
       description = coalesce($3::jsonb, description),
       location = case when $4::text = '__keep__' then location else $4::jsonb end,
       cover_url = case when $5::text = '__keep__' then cover_url else $5 end,
       published = coalesce($6, published),
       type = coalesce($7, type),
       updated_at = now()
     where id = $1`,
    [
      id,
      patch.title ? json(patch.title) : null,
      patch.description ? json(patch.description) : null,
      patch.location === undefined ? "__keep__" : json(patch.location),
      patch.coverUrl === undefined ? "__keep__" : patch.coverUrl,
      patch.published ?? null,
      patch.type ?? null,
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
  const p = await one<ProjectRow & { created_at: unknown }>(`select * from projects where id = $1`, [id]);
  if (!p) return;
  const neighbor = await one<ProjectRow & { created_at: unknown }>(
    direction === "up"
      ? `select * from projects where site_id = $1 and type = $2 and (sort_order, created_at) < ($3, $4::timestamptz) order by sort_order desc, created_at desc limit 1`
      : `select * from projects where site_id = $1 and type = $2 and (sort_order, created_at) > ($3, $4::timestamptz) order by sort_order asc, created_at asc limit 1`,
    [p.site_id, p.type, p.sort_order, iso(p.created_at)],
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
  stepLabel?: LText | null;
  stepDate?: string | null;
}): Promise<MediaItem> {
  const next = await one<{ n: unknown }>(`select coalesce(max(sort_order), -1) + 1 as n from project_media where project_id = $1`, [input.projectId]);
  const r = await one<MediaRow>(
    `insert into project_media (project_id, kind, url, poster_url, role, caption, step_label, step_date, sort_order)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::date, $9) returning *`,
    [
      input.projectId,
      input.kind,
      input.url,
      input.posterUrl ?? null,
      input.role ?? "gallery",
      json(input.caption ?? null),
      json(input.stepLabel ?? null),
      input.stepDate || null,
      Number(next?.n ?? 0),
    ],
  );
  return mapMedia(r!);
}

export async function updateMedia(
  id: string,
  patch: Partial<{ role: MediaRole; caption: LText | null; stepLabel: LText | null; stepDate: string | null; posterUrl: string | null; url: string }>,
) {
  await q(
    `update project_media set
       role = coalesce($2, role),
       caption = case when $3::text = '__keep__' then caption else $3::jsonb end,
       step_label = case when $4::text = '__keep__' then step_label else $4::jsonb end,
       step_date = case when $5::text = '__keep__' then step_date else nullif($5, '')::date end,
       poster_url = case when $6::text = '__keep__' then poster_url else $6 end,
       url = coalesce($7, url)
     where id = $1`,
    [
      id,
      patch.role ?? null,
      patch.caption === undefined ? "__keep__" : json(patch.caption),
      patch.stepLabel === undefined ? "__keep__" : json(patch.stepLabel),
      patch.stepDate === undefined ? "__keep__" : (patch.stepDate ?? ""),
      patch.posterUrl === undefined ? "__keep__" : patch.posterUrl,
      patch.url ?? null,
    ],
  );
}

export async function deleteMedia(id: string) {
  await q(`delete from project_media where id = $1`, [id]);
}

export async function getMedia(id: string): Promise<(MediaItem & { projectId: string }) | null> {
  const r = await one<MediaRow>(`select * from project_media where id = $1`, [id]);
  return r ? { ...mapMedia(r), projectId: r.project_id } : null;
}

/** Moves a media item one step within its project (same total order as the listing; single-statement swap). */
export async function moveMedia(id: string, direction: "up" | "down") {
  const m = await one<MediaRow & { created_at: unknown }>(`select * from project_media where id = $1`, [id]);
  if (!m) return;
  const neighbor = await one<MediaRow & { created_at: unknown }>(
    direction === "up"
      ? `select * from project_media where project_id = $1 and (sort_order, created_at) < ($2, $3::timestamptz) order by sort_order desc, created_at desc limit 1`
      : `select * from project_media where project_id = $1 and (sort_order, created_at) > ($2, $3::timestamptz) order by sort_order asc, created_at asc limit 1`,
    [m.project_id, m.sort_order, iso(m.created_at)],
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
