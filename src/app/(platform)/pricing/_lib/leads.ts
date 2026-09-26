import { iso, isUuid, one, q } from "@/lib/db/client";

/**
 * Accessors for `platform_leads` — the "اطلب موقعك" request form on the home and pricing pages, and the
 * inbox that shows it in /super.
 *
 * This lives under the page that writes it rather than in `src/lib/db/**` only because the db layer is
 * owned by another workstream in this fix programme; the table and both of its callers arrived together
 * here. It is a plain accessor module in the same shape as the others, so moving it to
 * `src/lib/db/leads.ts` later is a file move and an import rewrite, nothing more.
 */

export type LeadStatus = "new" | "contacted" | "won" | "lost" | "spam";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost", "spam"];
export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as string[]).includes(v);
}

export interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  trade: string | null;
  area: string | null;
  message: string | null;
  source: string | null;
  plan: string | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadRow {
  id: string;
  name: string;
  whatsapp: string;
  trade: string | null;
  area: string | null;
  message: string | null;
  source: string | null;
  plan: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function mapLead(r: LeadRow): Lead {
  return {
    id: r.id,
    name: r.name,
    whatsapp: r.whatsapp,
    trade: r.trade,
    area: r.area,
    message: r.message,
    source: r.source,
    plan: r.plan,
    status: r.status,
    notes: r.notes,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const COLS = "id, name, whatsapp, trade, area, message, source, plan, status, notes, created_at, updated_at";

/**
 * Normalises a typed Kuwaiti number to the international digits WhatsApp wants.
 *
 * People type `5000 0000`, `+965 5000 0000`, `00965 50000000` and `٥٠٠٠٠٠٠٠` — all the same number. A
 * bare 8-digit local number gets the 965 country code, because every lead this form will ever see is in
 * Kuwait and the founder should be able to tap the row and have WhatsApp open.
 */
export function normalizeWhatsapp(input: string): string | null {
  const digits = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .replace(/^00/, "");
  if (digits.length === 8) return `965${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export async function createLead(input: {
  name: string;
  whatsapp: string;
  trade?: string | null;
  area?: string | null;
  message?: string | null;
  source?: string | null;
  plan?: string | null;
}): Promise<Lead> {
  const r = await one<LeadRow>(
    `insert into platform_leads (name, whatsapp, trade, area, message, source, plan)
     values ($1, $2, $3, $4, $5, $6, $7) returning ${COLS}`,
    [input.name, input.whatsapp, input.trade || null, input.area || null, input.message || null, input.source || null, input.plan || null],
  );
  return mapLead(r!);
}

export const LEADS_PAGE_SIZE = 50;

export async function listLeads(opts: { status?: LeadStatus; limit?: number } = {}): Promise<Lead[]> {
  const limit = Math.min(Math.max(Math.trunc(Number(opts.limit)) || LEADS_PAGE_SIZE, 1), 200);
  const rows = opts.status
    ? await q<LeadRow>(`select ${COLS} from platform_leads where status = $1 order by created_at desc limit $2`, [opts.status, limit])
    : await q<LeadRow>(`select ${COLS} from platform_leads order by created_at desc limit $1`, [limit]);
  return rows.map(mapLead);
}

/** Per-status counts for the inbox tabs, in one pass. Absent statuses come back as 0, not missing. */
export async function leadCounts(): Promise<Record<LeadStatus, number>> {
  const rows = await q<{ status: LeadStatus; n: unknown }>(`select status, count(*) as n from platform_leads group by status`);
  const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of rows) if (isLeadStatus(r.status)) out[r.status] = Number(r.n || 0);
  return out;
}

export async function updateLead(id: string, patch: { status?: LeadStatus; notes?: string | null }): Promise<Lead | null> {
  if (!isUuid(id)) return null;
  const r = await one<LeadRow>(
    `update platform_leads set
       status = coalesce($2, status),
       notes = case when $3::boolean then notes else $4 end,
       updated_at = now()
     where id = $1 returning ${COLS}`,
    [id, patch.status ?? null, patch.notes === undefined, patch.notes ?? null],
  );
  return r ? mapLead(r) : null;
}

export async function deleteLead(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const r = await one<{ id: string }>(`delete from platform_leads where id = $1 returning id`, [id]);
  return !!r;
}

/**
 * Retention: a lead that was marked spam is deleted quickly, and a closed one (won/lost) after a year.
 * An open lead is never auto-deleted — it is someone waiting for a reply, and the whole point of storing
 * it in a table instead of an inbox was that it cannot quietly disappear.
 */
export async function pruneLeads(spamDays = 30, closedDays = 365): Promise<number> {
  const rows = await q<{ id: string }>(
    `delete from platform_leads
     where (status = 'spam' and created_at < now() - ($1::int * interval '1 day'))
        or (status in ('won','lost') and updated_at < now() - ($2::int * interval '1 day'))
     returning id`,
    [Math.max(1, Math.trunc(spamDays)), Math.max(1, Math.trunc(closedDays))],
  );
  return rows.length;
}
