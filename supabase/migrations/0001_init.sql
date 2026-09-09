-- DecoKuwait platform schema. Works on Supabase Postgres and on the embedded PGlite used locally.
-- Apply with `npm run db:migrate` (uses DATABASE_URL) or paste into the Supabase SQL editor.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  is_super boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('gypsum','aluminum','partition','ceramic')),
  template_code text not null,
  status text not null default 'active' check (status in ('active','paused')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  hostname text not null unique,
  kind text not null check (kind in ('subdomain','custom')),
  is_primary boolean not null default false,
  vercel_status jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists site_domains_site_idx on site_domains(site_id);

create table if not exists site_members (
  site_id uuid not null references sites(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  type text not null check (type in ('finished','before_after','progress')),
  title jsonb not null default '{"ar":"","en":""}'::jsonb,
  description jsonb not null default '{"ar":"","en":""}'::jsonb,
  location jsonb,
  cover_url text,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_site_idx on projects(site_id, type, sort_order);

create table if not exists project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  url text not null,
  poster_url text,
  role text not null default 'gallery' check (role in ('gallery','before','after','step')),
  caption jsonb,
  step_label jsonb,
  step_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_media_project_idx on project_media(project_id, sort_order);

create table if not exists pixels (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  platform text not null check (platform in ('meta','tiktok','snapchat','google')),
  pixel_id text not null default '',
  access_token text,
  extra jsonb not null default '{}'::jsonb,
  test_event_code text,
  active boolean not null default false,
  event_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, platform)
);

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  code text not null,
  source_platform text not null default 'direct',
  utm jsonb not null default '{}'::jsonb,
  click_ids jsonb not null default '{}'::jsonb,
  cookies jsonb not null default '{}'::jsonb,
  referrer text,
  landing_url text,
  user_agent text,
  ip text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visits integer not null default 1,
  whatsapp_clicks integer not null default 0,
  stage text not null default 'new' check (stage in ('new','contacted','called_for_visit','ordered','first_payment','order_complete')),
  stage_updated_at timestamptz,
  notes text,
  name text,
  phone text,
  unique (site_id, code)
);
create index if not exists visitors_site_last_seen_idx on visitors(site_id, last_seen_at desc);
create index if not exists visitors_site_stage_idx on visitors(site_id, stage);

create table if not exists visitor_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references visitors(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  event_type text not null,
  stage text,
  value numeric,
  currency text,
  event_id text not null,
  targets jsonb not null default '[]'::jsonb,
  deliveries jsonb not null default '[]'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists visitor_events_visitor_idx on visitor_events(visitor_id, created_at desc);
create index if not exists visitor_events_site_idx on visitor_events(site_id, created_at desc);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  key text not null unique,
  url text not null,
  kind text not null,
  content_type text,
  size bigint,
  created_at timestamptz not null default now()
);
create index if not exists media_assets_site_idx on media_assets(site_id, created_at desc);
