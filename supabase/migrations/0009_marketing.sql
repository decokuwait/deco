-- Conversion delivery: durability and visibility.
-- Additive only, and idempotent so a repeated run is harmless.
-- Numbered 0009: the fix programme ran in parallel and 0006 (security), 0007 (leads) and 0008
-- (media) were claimed while this was being written. Nothing here depends on any of them.

-- ---------------------------------------------------------------------------
-- 1. Retry queue.
--
--    A server-side conversion had exactly one attempt. A five-second Meta blip,
--    a 429, a cold DNS answer — and the lead is gone, permanently, with the
--    failure console.error'd and buried in visitor_events.deliveries, a jsonb
--    column nobody reads. A tenant could lose every Meta conversion for weeks
--    and the panel would look the same as a working one.
--
--    Retryable failures (network, timeout, 429, 5xx) are queued here and drained
--    by the cron. A 4xx is a configuration problem: retrying it just repeats the
--    same rejection, so it is recorded and not queued.
--
--    The row carries what is needed to rebuild the request rather than the
--    request itself: the pixel's token may have been rotated by the time the
--    retry runs, and a stored payload would replay the old one. `event_id` is
--    reused so a retry that crosses with a late success is deduplicated by the
--    ad platform instead of double-counting.
-- ---------------------------------------------------------------------------
create table if not exists pending_deliveries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  visitor_id uuid references visitors(id) on delete cascade,
  platform text not null,
  event_key text not null,
  event_id text not null,
  event_time bigint not null,
  stage text,
  value numeric,
  currency text,
  source_url text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
-- The drain selects by due time only; without this it sequential-scans on every cron tick.
create index if not exists pending_deliveries_due_idx on pending_deliveries(next_attempt_at);
create index if not exists pending_deliveries_site_idx on pending_deliveries(site_id);
-- One queued retry per platform per event: two failures of the same dispatch must not become two sends.
create unique index if not exists pending_deliveries_event_idx on pending_deliveries(event_id, platform);

-- ---------------------------------------------------------------------------
-- 2. Signal health.
--
--    One row per delivery attempt, which is what makes "last success, last
--    failure reason, failures in the last 7 days" answerable per platform. It
--    cannot be derived from visitor_events.deliveries without scanning every
--    event row and unpacking jsonb, and an expired access token has to be
--    visible in one query or nobody will ever look.
--
--    `alarm` separates the two failures that break every event for every tenant
--    at once — an expired token and a retired API version — from ordinary noise.
--    Trimmed to 30 days by the same cron that drains the queue.
-- ---------------------------------------------------------------------------
create table if not exists signal_attempts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  platform text not null,
  event_key text not null,
  ok boolean not null,
  -- 'ok' | 'skipped' | 'auth' | 'api_version' | 'http_<status>' | 'network' — never provider prose:
  -- this is rendered in the panel and provider text is attacker-influenceable.
  code text not null,
  analytics_only boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists signal_attempts_site_idx on signal_attempts(site_id, platform, created_at desc);
create index if not exists signal_attempts_age_idx on signal_attempts(created_at);

-- ---------------------------------------------------------------------------
-- 3. Same lockdown as every other table (see 0004): RLS on with no policies, and
--    the Supabase API roles revoked, so these never appear in PostgREST.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pending_deliveries', 'signal_attempts'] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I no force row level security', t);
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute format('revoke all on public.%I from anon', t);
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute format('revoke all on public.%I from authenticated', t);
      end if;
    end if;
  end loop;
end $$;
