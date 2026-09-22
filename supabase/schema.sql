create table if not exists public.tiktokraft_config (
  id text primary key check (id = 'tiktokraft-live'),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tiktokraft_config enable row level security;

revoke all on table public.tiktokraft_config from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_config to service_role;

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
  values (lower(trim(p_username)), left(coalesce(nullif(trim(p_nickname), ''), trim(p_username)), 80), left(coalesce(p_avatar_url, ''), 2048), greatest(p_coins, 0))
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

create table if not exists public.tiktokraft_user_point_transactions (
  id bigint generated always as identity primary key,
  username text not null,
  amount bigint not null check (amount <> 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.tiktokraft_user_point_transactions enable row level security;
revoke all on table public.tiktokraft_user_point_transactions from anon, authenticated;
grant select, insert on table public.tiktokraft_user_point_transactions to service_role;

create or replace function public.tiktokraft_add_manual_user_points(
  p_username text,
  p_nickname text,
  p_coins bigint,
  p_description text default ''
)
returns setof public.tiktokraft_user_points
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.tiktokraft_user_points%rowtype;
begin
  if nullif(trim(p_username), '') is null then
    raise exception 'Indica un usuario para la transacción.';
  end if;
  if p_coins is null or p_coins = 0 then
    raise exception 'La cantidad debe ser distinta de cero.';
  end if;

  insert into public.tiktokraft_user_points as points (username, nickname, total_coins)
  values (lower(trim(p_username)), left(coalesce(nullif(trim(p_nickname), ''), trim(p_username)), 80), 0)
  on conflict (username) do update set
    nickname = case when excluded.nickname <> '' then excluded.nickname else points.nickname end,
    last_gift_at = now()
  returning * into updated;

  if updated.total_coins + p_coins < 0 then
    raise exception 'La transacción dejaría el total de puntos por debajo de cero.';
  end if;

  update public.tiktokraft_user_points
  set total_coins = updated.total_coins + p_coins,
      last_gift_at = now()
  where username = updated.username
  returning * into updated;

  insert into public.tiktokraft_user_point_transactions (username, amount, description)
  values (updated.username, p_coins, left(coalesce(p_description, ''), 280));

  return next updated;
end;
$$;

revoke all on function public.tiktokraft_add_manual_user_points(text, text, bigint, text) from public;
grant execute on function public.tiktokraft_add_manual_user_points(text, text, bigint, text) to service_role;
