create table if not exists public.tiktokraft_config (
  id text primary key check (id = 'tiktokraft-live'),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tiktokraft_config enable row level security;

revoke all on table public.tiktokraft_config from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_config to service_role;
