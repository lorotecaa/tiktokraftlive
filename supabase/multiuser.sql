-- TikTokraft Live multiusuario. Ejecutar una sola vez en Supabase SQL Editor.
-- Conserva las tablas antiguas: la primera cuenta que inicie sesión las reclama
-- de forma atómica; las siguientes comienzan con espacios vacíos.

create table if not exists public.tiktokraft_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null,
  overlay_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tiktokraft_multiuser_state (
  id boolean primary key default true check (id),
  legacy_owner_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);

create table if not exists public.tiktokraft_workspace_user_points (
  owner_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  nickname text not null,
  avatar_url text not null default '',
  total_coins bigint not null default 0 check (total_coins >= 0),
  first_gift_at timestamptz not null default now(),
  last_gift_at timestamptz not null default now(),
  primary key (owner_id, username)
);

create table if not exists public.tiktokraft_workspace_point_transactions (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  amount bigint not null check (amount <> 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.tiktokraft_workspaces enable row level security;
alter table public.tiktokraft_multiuser_state enable row level security;
alter table public.tiktokraft_workspace_user_points enable row level security;
alter table public.tiktokraft_workspace_point_transactions enable row level security;

revoke all on table public.tiktokraft_workspaces, public.tiktokraft_multiuser_state, public.tiktokraft_workspace_user_points, public.tiktokraft_workspace_point_transactions from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_workspaces, public.tiktokraft_multiuser_state, public.tiktokraft_workspace_user_points, public.tiktokraft_workspace_point_transactions to service_role;

create or replace function public.tiktokraft_claim_workspace(
  p_owner_id uuid,
  p_default_config jsonb,
  p_overlay_token text
)
returns public.tiktokraft_workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  legacy_config jsonb;
  result public.tiktokraft_workspaces%rowtype;
begin
  insert into public.tiktokraft_multiuser_state (id) values (true) on conflict do nothing;
  select legacy_owner_id into owner from public.tiktokraft_multiuser_state where id = true for update;

  select * into result from public.tiktokraft_workspaces where owner_id = p_owner_id;
  if found then return result; end if;

  if owner is null then
    update public.tiktokraft_multiuser_state set legacy_owner_id = p_owner_id, claimed_at = now() where id = true;
    if to_regclass('public.tiktokraft_config') is not null then
      select config into legacy_config from public.tiktokraft_config where id = 'tiktokraft-live';
    end if;
  end if;

  insert into public.tiktokraft_workspaces (owner_id, config, overlay_token)
  values (p_owner_id, coalesce(legacy_config, p_default_config), p_overlay_token)
  returning * into result;

  if owner is null and to_regclass('public.tiktokraft_user_points') is not null then
    insert into public.tiktokraft_workspace_user_points (owner_id, username, nickname, avatar_url, total_coins, first_gift_at, last_gift_at)
    select p_owner_id, username, nickname, avatar_url, total_coins, first_gift_at, last_gift_at
    from public.tiktokraft_user_points
    on conflict (owner_id, username) do nothing;
  end if;

  return result;
end;
$$;

revoke all on function public.tiktokraft_claim_workspace(uuid, jsonb, text) from public;
grant execute on function public.tiktokraft_claim_workspace(uuid, jsonb, text) to service_role;

-- Reparación segura para la primera cuenta si su workspace se creó antes de
-- copiar la configuración antigua. Solo rellena mappings cuando están vacíos;
-- nunca modifica ni borra tiktokraft_config.
create or replace function public.tiktokraft_reclaim_legacy_mappings(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_config jsonb;
  workspace_config jsonb;
begin
  if (select legacy_owner_id from public.tiktokraft_multiuser_state where id = true) is distinct from p_owner_id then
    return null;
  end if;
  if to_regclass('public.tiktokraft_config') is null then return null; end if;
  select config into legacy_config from public.tiktokraft_config where id = 'tiktokraft-live';
  if jsonb_typeof(legacy_config->'mappings') <> 'array' or jsonb_array_length(legacy_config->'mappings') = 0 then
    return null;
  end if;
  select config into workspace_config from public.tiktokraft_workspaces where owner_id = p_owner_id for update;
  if workspace_config is null then return null; end if;
  if jsonb_typeof(workspace_config->'mappings') = 'array' and jsonb_array_length(workspace_config->'mappings') > 0 then
    return workspace_config;
  end if;
  update public.tiktokraft_workspaces
  set config = jsonb_set(workspace_config, '{mappings}', legacy_config->'mappings', true), updated_at = now()
  where owner_id = p_owner_id
  returning config into workspace_config;
  return workspace_config;
end;
$$;

revoke all on function public.tiktokraft_reclaim_legacy_mappings(uuid) from public;
grant execute on function public.tiktokraft_reclaim_legacy_mappings(uuid) to service_role;

create or replace function public.tiktokraft_workspace_add_user_points(
  p_owner_id uuid, p_username text, p_nickname text, p_avatar_url text, p_coins bigint
)
returns setof public.tiktokraft_workspace_user_points
language plpgsql security definer set search_path = public as $$
begin
  return query insert into public.tiktokraft_workspace_user_points as points (owner_id, username, nickname, avatar_url, total_coins)
  values (p_owner_id, lower(trim(p_username)), left(coalesce(nullif(trim(p_nickname), ''), trim(p_username)), 80), left(coalesce(p_avatar_url, ''), 2048), greatest(p_coins, 0))
  on conflict (owner_id, username) do update set nickname = excluded.nickname, avatar_url = case when excluded.avatar_url <> '' then excluded.avatar_url else points.avatar_url end, total_coins = points.total_coins + excluded.total_coins, last_gift_at = now()
  returning points.*;
end;
$$;

create or replace function public.tiktokraft_workspace_add_manual_points(
  p_owner_id uuid, p_username text, p_nickname text, p_coins bigint, p_description text default ''
)
returns setof public.tiktokraft_workspace_user_points
language plpgsql security definer set search_path = public as $$
declare updated public.tiktokraft_workspace_user_points%rowtype;
begin
  if nullif(trim(p_username), '') is null or p_coins is null or p_coins = 0 then raise exception 'Usuario y cantidad distinta de cero son obligatorios.'; end if;
  insert into public.tiktokraft_workspace_user_points as points (owner_id, username, nickname, total_coins)
  values (p_owner_id, lower(trim(p_username)), left(coalesce(nullif(trim(p_nickname), ''), trim(p_username)), 80), 0)
  on conflict (owner_id, username) do update set nickname = excluded.nickname, last_gift_at = now()
  returning * into updated;
  if updated.total_coins + p_coins < 0 then raise exception 'La transacción dejaría el total por debajo de cero.'; end if;
  update public.tiktokraft_workspace_user_points set total_coins = updated.total_coins + p_coins, last_gift_at = now() where owner_id = p_owner_id and username = updated.username returning * into updated;
  insert into public.tiktokraft_workspace_point_transactions (owner_id, username, amount, description) values (p_owner_id, updated.username, p_coins, left(coalesce(p_description, ''), 280));
  return next updated;
end;
$$;

revoke all on function public.tiktokraft_workspace_add_user_points(uuid, text, text, text, bigint), public.tiktokraft_workspace_add_manual_points(uuid, text, text, bigint, text) from public;
grant execute on function public.tiktokraft_workspace_add_user_points(uuid, text, text, text, bigint), public.tiktokraft_workspace_add_manual_points(uuid, text, text, bigint, text) to service_role;
notify pgrst, 'reload schema';
