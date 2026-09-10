-- Login throttling and housekeeping indexes. Idempotent.
create table if not exists login_attempts (
  key text primary key,
  failures integer not null default 0,
  first_failure_at timestamptz not null default now(),
  last_failure_at timestamptz not null default now()
);
create index if not exists sessions_expires_idx on sessions(expires_at);
create index if not exists visitor_events_visitor_type_idx on visitor_events(visitor_id, event_type, created_at desc);
