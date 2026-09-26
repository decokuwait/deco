-- Platform sales leads. Additive only, and idempotent so a repeated run is harmless.
--
-- The platform had no way to be *bought*: the home page's entire navigation was "templates" and
-- "super admin", so a Kuwaiti contractor who found decokuwait.com had no next step. The home page
-- and /pricing now carry a request form, and it has to land somewhere.
--
-- That somewhere is this table rather than an email, because there is no transactional email in this
-- product at all (no nodemailer / resend / sendgrid / postmark / mailgun anywhere) and adding a mail
-- provider to deliver one form is a dependency, a domain-authentication chore and a monthly bill. A row
-- the founder sees in /super/leads cannot be spam-foldered, cannot bounce, and costs nothing.
--
-- 0006 was taken by the security migration by the time this landed, hence 0007.

create table if not exists platform_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Digits only, international form without "+": the number is a WhatsApp link the founder taps.
  whatsapp text not null,
  -- One of the four trades when the visitor picked one, else free text — never constrained, because a
  -- request from a trade we do not have a template for is still a lead worth reading.
  trade text,
  area text,
  message text,
  -- Which page the form was on ('home' / 'pricing') and which plan was being looked at, if any.
  source text,
  plan text,
  status text not null default 'new' check (status in ('new','contacted','won','lost','spam')),
  -- The founder's own note on the conversation. Never shown to the person who submitted the form.
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The inbox reads "newest first, optionally filtered by status"; this is the index that serves it.
create index if not exists platform_leads_status_created_idx on platform_leads(status, created_at desc);
create index if not exists platform_leads_created_idx on platform_leads(created_at desc);

-- No IP and no user agent are stored. A lead is a name and a phone number the person deliberately gave
-- us; the request metadata would be PII we have no use for and would then have to retain, justify and
-- purge. Abuse is handled by the rate limiter in front of the form, not by keeping a log of everyone.

-- RLS matching 0004/0005: enabled with no policies so only the owning role (the application) can reach
-- it, and the two Supabase API roles are revoked so it never appears in the auto-generated REST API.
-- This table holds customer phone numbers; it must never be one anon key away from the public internet.
do $$ begin
  execute 'alter table platform_leads enable row level security';
  execute 'alter table platform_leads no force row level security';
exception when others then null;
end $$;

do $$ begin
  execute 'revoke all on platform_leads from anon, authenticated';
exception when others then null;
end $$;
