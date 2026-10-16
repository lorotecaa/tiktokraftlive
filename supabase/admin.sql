-- Autorización de cuentas registradas para conectar TikTok LIVE.
-- Ejecutar en Supabase SQL Editor antes de publicar el servidor actualizado.
-- La tabla antigua tiktokraft_authorized_tiktok_users queda intacta por
-- seguridad histórica, pero la aplicación deja de consultarla.

create table if not exists public.tiktokraft_authorized_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(trim(email)) > 3),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);

alter table public.tiktokraft_authorized_accounts enable row level security;
revoke all on table public.tiktokraft_authorized_accounts from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_authorized_accounts to service_role;

notify pgrst, 'reload schema';
