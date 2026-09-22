-- PASO 2: transacciones manuales.
-- Ejecuta este archivo únicamente después de user-points.sql.
do $$
begin
  if to_regclass('public.tiktokraft_user_points') is null then
    raise exception 'Falta la estructura base. Ejecuta primero supabase/user-points.sql.';
  end if;
end;
$$;

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
notify pgrst, 'reload schema';
