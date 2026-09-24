-- Administración de acceso a TikTokraft Live.
-- Ejecutar una sola vez en Supabase SQL Editor.

create table if not exists public.tiktokraft_authorized_tiktok_users (
  username text primary key check (length(trim(username)) > 0),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);

alter table public.tiktokraft_authorized_tiktok_users enable row level security;
revoke all on table public.tiktokraft_authorized_tiktok_users from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_authorized_tiktok_users to service_role;

create or replace function public.tiktokraft_authorize_tiktok_username(
  p_username text,
  p_added_by uuid
)
returns setof public.tiktokraft_authorized_tiktok_users
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_username), '') is null then
    raise exception 'El usuario de TikTok es obligatorio.';
  end if;

  return query
  insert into public.tiktokraft_authorized_tiktok_users as allowed (username, added_by)
  values (lower(trim(leading '@' from p_username)), p_added_by)
  on conflict (username) do update set username = excluded.username
  returning allowed.*;
end;
$$;

revoke all on function public.tiktokraft_authorize_tiktok_username(text, uuid) from public;
grant execute on function public.tiktokraft_authorize_tiktok_username(text, uuid) to service_role;

notify pgrst, 'reload schema';
