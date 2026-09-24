-- Catálogo privado de regalos detectados por cada cuenta de TikTokraft Live.
-- Ejecutar una sola vez en Supabase SQL Editor después de multiuser.sql.

create table if not exists public.tiktokraft_workspace_gift_catalog (
  owner_id uuid not null references auth.users(id) on delete cascade,
  gift_id text not null check (length(trim(gift_id)) > 0),
  gift_name text not null,
  coin_value bigint not null default 0 check (coin_value >= 0),
  image_url text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (owner_id, gift_id)
);

create index if not exists tiktokraft_workspace_gift_catalog_recent_idx
  on public.tiktokraft_workspace_gift_catalog (owner_id, last_seen_at desc);

alter table public.tiktokraft_workspace_gift_catalog enable row level security;
revoke all on table public.tiktokraft_workspace_gift_catalog from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_workspace_gift_catalog to service_role;

create or replace function public.tiktokraft_workspace_upsert_gift_catalog(
  p_owner_id uuid,
  p_gift_id text,
  p_gift_name text,
  p_coin_value bigint,
  p_image_url text default ''
)
returns setof public.tiktokraft_workspace_gift_catalog
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_gift_id), '') is null then
    raise exception 'El ID real del regalo es obligatorio.';
  end if;

  return query
  insert into public.tiktokraft_workspace_gift_catalog as catalog
    (owner_id, gift_id, gift_name, coin_value, image_url)
  values
    (p_owner_id, trim(p_gift_id), left(coalesce(nullif(trim(p_gift_name), ''), trim(p_gift_id)), 80), greatest(coalesce(p_coin_value, 0), 0), left(coalesce(p_image_url, ''), 2048))
  on conflict (owner_id, gift_id) do update set
    gift_name = case when excluded.gift_name <> '' then excluded.gift_name else catalog.gift_name end,
    coin_value = case when excluded.coin_value > 0 then excluded.coin_value else catalog.coin_value end,
    image_url = case when excluded.image_url <> '' then excluded.image_url else catalog.image_url end,
    last_seen_at = now()
  returning catalog.*;
end;
$$;

revoke all on function public.tiktokraft_workspace_upsert_gift_catalog(uuid, text, text, bigint, text) from public;
grant execute on function public.tiktokraft_workspace_upsert_gift_catalog(uuid, text, text, bigint, text) to service_role;

notify pgrst, 'reload schema';
