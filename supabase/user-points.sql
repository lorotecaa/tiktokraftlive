-- PASO 1: estructura base de Usuario y Puntos.
-- Ejecuta este archivo completo antes de manual-transactions.sql.
create table if not exists public.tiktokraft_user_points (
  username text primary key,
  nickname text not null,
  avatar_url text not null default '',
  total_coins bigint not null default 0 check (total_coins >= 0),
  first_gift_at timestamptz not null default now(),
  last_gift_at timestamptz not null default now()
);

alter table public.tiktokraft_user_points enable row level security;
revoke all on table public.tiktokraft_user_points from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_user_points to service_role;

create or replace function public.tiktokraft_add_user_points(
  p_username text,
  p_nickname text,
  p_avatar_url text,
  p_coins bigint
)
returns setof public.tiktokraft_user_points
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.tiktokraft_user_points as points (username, nickname, avatar_url, total_coins)
  values (
    lower(trim(p_username)),
    left(coalesce(nullif(trim(p_nickname), ''), trim(p_username)), 80),
    left(coalesce(p_avatar_url, ''), 2048),
    greatest(p_coins, 0)
  )
  on conflict (username) do update set
    nickname = excluded.nickname,
    avatar_url = case when excluded.avatar_url <> '' then excluded.avatar_url else points.avatar_url end,
    total_coins = points.total_coins + excluded.total_coins,
    last_gift_at = now()
  returning points.*;
end;
$$;

revoke all on function public.tiktokraft_add_user_points(text, text, text, bigint) from public;
grant execute on function public.tiktokraft_add_user_points(text, text, text, bigint) to service_role;
notify pgrst, 'reload schema';
