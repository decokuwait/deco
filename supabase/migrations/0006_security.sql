-- Security hardening. Additive only, and idempotent so a repeated run is harmless.

-- ---------------------------------------------------------------------------
-- 1. Durable rate limiting.
--
--    The public endpoints were limited by a module-level Map. On Vercel every
--    concurrent lambda holds its own copy, so the effective limit was
--    `limit x instance_count` and a cold start reset it to zero — an attacker
--    enumerating visitor codes simply out-scaled the counter. This table is the
--    shared counter; the in-memory bucket stays in front of it as a fast path.
--
--    Fixed window rather than a token bucket: one atomic upsert per check, no
--    read-modify-write race between instances.
-- ---------------------------------------------------------------------------
create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Housekeeping scans delete by age; without this they sequential-scan the table.
create index if not exists rate_limits_updated_idx on rate_limits(updated_at);

-- ---------------------------------------------------------------------------
-- 2. Session idle timeout.
--
--    Sessions only had a 30-day absolute expiry, so a token copied off a shared
--    machine stayed valid for a month of inactivity. `last_used_at` is refreshed
--    on use and expires the session after a week of silence.
--    Backfilled from created_at so existing sessions are not all killed at once.
-- ---------------------------------------------------------------------------
alter table sessions add column if not exists last_used_at timestamptz;
update sessions set last_used_at = created_at where last_used_at is null;
alter table sessions alter column last_used_at set default now();
create index if not exists sessions_last_used_idx on sessions(last_used_at);

-- ---------------------------------------------------------------------------
-- 3. Per-site storage accounting.
--
--    /api/upload records media_assets.size on every issued upload target and
--    nothing ever summed it, so one authenticated site admin could mint an
--    unbounded number of 300 MB presigned PUTs. The quota query is
--    `sum(size) where site_id = $1`, which this index serves without touching
--    the rows.
-- ---------------------------------------------------------------------------
create index if not exists media_assets_site_size_idx on media_assets(site_id) include (size);

-- ---------------------------------------------------------------------------
-- 4. RLS for the new table, matching 0004/0005: enable with no policies so only
--    the owning role (the application) can reach it, and revoke the two Supabase
--    API roles so it never appears in the auto-generated API.
-- ---------------------------------------------------------------------------
do $$ begin
  execute 'alter table rate_limits enable row level security';
  execute 'alter table rate_limits no force row level security';
exception when others then null;
end $$;

do $$ begin
  execute 'revoke all on rate_limits from anon, authenticated';
exception when others then null;
end $$;
