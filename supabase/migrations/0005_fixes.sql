-- Additive-only migration for the deep-analysis fix programme.
-- Every statement is idempotent (IF NOT EXISTS / guarded DO blocks) so a repeated run is harmless,
-- and nothing here drops or rewrites existing data: a previous deployment keeps working against it.

-- ---------------------------------------------------------------------------
-- 1. Soft delete. `deleteSiteAction` used to cascade immediately, which made an
--    accidental click unrecoverable (no R2 versioning, no per-tenant export).
--    Sites are now marked and purged later; every lookup filters on this column.
-- ---------------------------------------------------------------------------
alter table sites add column if not exists deleted_at timestamptz;
create index if not exists sites_active_idx on sites(created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Billing. There was no way to charge anyone and no consequence for not
--    paying: the only lever was a human flipping `status` by hand. `paid_until`
--    lets a scheduled job do it. Money is stored in fils (integer) to avoid
--    float rounding on a currency with 3 decimal places.
-- ---------------------------------------------------------------------------
alter table sites add column if not exists plan text not null default 'basic';
alter table sites add column if not exists price_fils integer not null default 0;
alter table sites add column if not exists billing_cycle text not null default 'yearly';
alter table sites add column if not exists paid_until date;
alter table sites add column if not exists last_invoice_ref text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sites_plan_check') then
    alter table sites add constraint sites_plan_check check (plan in ('basic','pro','plus'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sites_billing_cycle_check') then
    alter table sites add constraint sites_billing_cycle_check check (billing_cycle in ('monthly','yearly'));
  end if;
end $$;

create index if not exists sites_paid_until_idx on sites(paid_until) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. Project URLs. A photo-led trade business had zero indexable pages for its
--    portfolio. Each project gets a slug so it can own a real URL.
--    Unique per site, not globally: two tenants may both have `majlis-salmiya`.
-- ---------------------------------------------------------------------------
alter table projects add column if not exists slug text;
create unique index if not exists projects_site_slug_idx on projects(site_id, slug) where slug is not null;

-- Backfill a slug for every existing project so no row is left unreachable.
-- Derived from the id, because titles are jsonb and may be empty; the admin can
-- rewrite it afterwards.
update projects set slug = 'p-' || substr(id::text, 1, 8) where slug is null;

-- ---------------------------------------------------------------------------
-- 4. Authorable alt text. Alt was derived from adjacent titles and was empty on
--    every hero/gallery image routed through the generic Media component — a
--    WCAG 1.1.1 Level A failure on a site whose content *is* photographs.
-- ---------------------------------------------------------------------------
alter table project_media add column if not exists alt jsonb;

-- ---------------------------------------------------------------------------
-- 5. Visitor secret. The 6-digit code was the sole identity for both public
--    write endpoints, and it is guessable (900k space) and readable by script.
--    This is the HttpOnly companion that proves the caller owns the row.
-- ---------------------------------------------------------------------------
alter table visitors add column if not exists secret text;

-- ---------------------------------------------------------------------------
-- 6. Indexes that were missing for queries the admin runs constantly.
--    The two-column versions could not serve `order by last_seen_at`, so a
--    filtered page sorted the whole tenant's visitor set.
-- ---------------------------------------------------------------------------
create index if not exists visitors_site_stage_seen_idx on visitors(site_id, stage, last_seen_at desc);
create index if not exists visitors_site_source_seen_idx on visitors(site_id, source_platform, last_seen_at desc);
-- Prefix search on the visitor code: PGlite initialises with C collation where a
-- plain btree serves LIKE 'x%', but Supabase is en_US.UTF-8 where it does not.
create index if not exists visitors_site_code_pattern_idx on visitors(site_id, code text_pattern_ops);

-- ---------------------------------------------------------------------------
-- 7. Deletion queue. Site deletion cleaned R2 objects and Vercel domains *after*
--    the rows were gone, with every failure swallowed — so a crash mid-loop left
--    orphans that nothing recorded. Rows are written in the same transaction as
--    the delete and drained afterwards.
-- ---------------------------------------------------------------------------
create table if not exists deletion_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('r2_object','vercel_domain','user')),
  ref text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists deletion_queue_created_idx on deletion_queue(created_at);

-- ---------------------------------------------------------------------------
-- 8. Integrity gaps the rest of the schema already guards elsewhere.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'media_assets_kind_check') then
    alter table media_assets add constraint media_assets_kind_check check (kind in ('image','video')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_members_role_check') then
    alter table site_members add constraint site_members_role_check check (role in ('admin')) not valid;
  end if;
end $$;

-- One primary domain per site, enforced rather than assumed.
create unique index if not exists site_domains_primary_idx on site_domains(site_id) where is_primary;

-- ---------------------------------------------------------------------------
-- 9. RLS for the new table, matching 0004's approach: enable with no policies so
--    only the owning role (the application) can reach it, and revoke the two
--    Supabase API roles so it never appears in the auto-generated API.
-- ---------------------------------------------------------------------------
do $$ begin
  execute 'alter table deletion_queue enable row level security';
  execute 'alter table deletion_queue no force row level security';
exception when others then null;
end $$;

do $$ begin
  execute 'revoke all on deletion_queue from anon, authenticated';
exception when others then null;
end $$;
