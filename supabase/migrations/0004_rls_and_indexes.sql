-- Lock the tables down for Supabase's auto-generated API, and add the indexes the app's own queries need.
-- Idempotent: safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Row level security
--
-- The application connects as the database owner through DATABASE_URL, so RLS never applies to it.
-- Supabase, however, also exposes every table in `public` through PostgREST to the `anon` and
-- `authenticated` roles, and its default privileges grant those roles full DML on new tables. Without
-- RLS, anyone holding the project's anon key could read users.password_hash, sessions.token_hash,
-- pixels.access_token and the whole visitors table (IP, phone, name, notes).
--
-- No policies are created on purpose: RLS with zero policies denies everything for every role it
-- applies to, which is exactly what a platform that never uses the Supabase client API wants. The
-- grants are revoked as well, so the tables disappear from the generated API instead of answering 403.
--
-- Deliberately ENABLE and not FORCE: ENABLE exempts the table owner, which is the role the application
-- connects as. FORCE would apply the (empty) policy set to the owner too and lock the platform out of
-- its own database.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'sessions', 'sites', 'site_domains', 'site_members', 'projects', 'project_media',
    'pixels', 'visitors', 'visitor_events', 'media_assets', 'login_attempts', '_migrations'
  ] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I no force row level security', t);
      -- The roles only exist on Supabase; skip silently elsewhere (local PGlite, CI Postgres).
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute format('revoke all on public.%I from anon', t);
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute format('revoke all on public.%I from authenticated', t);
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Missing indexes
-- ---------------------------------------------------------------------------

-- site_members' primary key is (site_id, user_id), so nothing indexes user_id on its own:
-- listSiteIdsForUser() and every `delete from users` cascade were sequential scans.
create index if not exists site_members_user_idx on site_members(user_id);

-- visitor_events.created_by references users(id) with no index, so deleting one user scanned the
-- largest table in the schema. Partial: only admin-created stage events carry a value here.
create index if not exists visitor_events_created_by_idx on visitor_events(created_by) where created_by is not null;

-- visitorStats() runs on every admin dashboard load and filters visitors by first_seen_at.
create index if not exists visitors_site_first_seen_idx on visitors(site_id, first_seen_at desc);

-- The visitors page can filter by source platform.
create index if not exists visitors_site_source_idx on visitors(site_id, source_platform);

-- ---------------------------------------------------------------------------
-- 3. event_type was the only enum-ish column without a check constraint
-- ---------------------------------------------------------------------------
-- NOT VALID: the constraint applies to every new row, but an existing database is not scanned and a
-- historical row with an unexpected value cannot fail the deploy. Run
-- `alter table visitor_events validate constraint visitor_events_event_type_check;` once the existing
-- data is known to be clean.
alter table visitor_events drop constraint if exists visitor_events_event_type_check;
alter table visitor_events add constraint visitor_events_event_type_check
  check (event_type in ('page_view','whatsapp_click','call_click','contacted','called_for_visit','ordered','first_payment','order_complete')) not valid;

-- ---------------------------------------------------------------------------
-- 4. Click dedupe has to be enforced by the database, not by a read-then-write
--
-- hasRecentEvent() + createEvent() is a check-then-act pair: two parallel beacons from one double tap
-- both passed the check and both fired a conversion, each carrying its own event_id, so the ad
-- platforms could not deduplicate them either. The browser's event_id cannot be the guard (the client
-- chooses it), so click events now carry a server-derived key: visitor + event type + time bucket.
-- A partial unique index makes the insert itself the arbiter; stage events leave the column null.
-- ---------------------------------------------------------------------------
alter table visitor_events add column if not exists dedupe_key text;
create unique index if not exists visitor_events_dedupe_key on visitor_events(dedupe_key) where dedupe_key is not null;
