import { q, one, iso } from "./client";
import type { User } from "./users";

export async function isSiteMember(siteId: string, userId: string): Promise<boolean> {
  const r = await one(`select 1 as ok from site_members where site_id = $1 and user_id = $2`, [siteId, userId]);
  return !!r;
}

export interface SiteMember extends User {
  role: string;
}

export async function listMembers(siteId: string): Promise<SiteMember[]> {
  const rows = await q<{
    id: string;
    email: string;
    name: string | null;
    is_super: boolean;
    created_at: unknown;
    last_login_at: unknown;
    role: string;
  }>(
    `select u.id, u.email, u.name, u.is_super, u.created_at, u.last_login_at, m.role
     from site_members m join users u on u.id = m.user_id where m.site_id = $1 order by m.created_at`,
    [siteId],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    isSuper: !!r.is_super,
    createdAt: iso(r.created_at),
    lastLoginAt: r.last_login_at ? iso(r.last_login_at) : null,
    role: r.role,
  }));
}

export async function addMember(siteId: string, userId: string, role = "admin") {
  await q(
    `insert into site_members (site_id, user_id, role) values ($1, $2, $3)
     on conflict (site_id, user_id) do update set role = excluded.role`,
    [siteId, userId, role],
  );
}

export async function removeMember(siteId: string, userId: string) {
  await q(`delete from site_members where site_id = $1 and user_id = $2`, [siteId, userId]);
}

export async function listSiteIdsForUser(userId: string): Promise<string[]> {
  const rows = await q<{ site_id: string }>(`select site_id from site_members where user_id = $1`, [userId]);
  return rows.map((r) => r.site_id);
}
