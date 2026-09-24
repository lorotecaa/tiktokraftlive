-- Catálogo GLOBAL de regalos detectados por TikTokraft Live.
-- Ejecutar una vez. Si antes usaste la versión privada del catálogo, puedes
-- ejecutar este mismo archivo nuevamente: copia sus regalos al catálogo global.

create table if not exists public.tiktokraft_gift_catalog (
  gift_id text primary key check (length(trim(gift_id)) > 0),
  gift_name text not null,
  coin_value bigint not null default 0 check (coin_value >= 0),
  image_url text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists tiktokraft_gift_catalog_recent_idx
  on public.tiktokraft_gift_catalog (last_seen_at desc);

-- Conserva los regalos ya descubiertos con la versión privada anterior. La
-- tabla anterior no se borra para no tocar datos ajenos al cambio de catálogo.
do $$
begin
  if to_regclass('public.tiktokraft_workspace_gift_catalog') is not null then
    insert into public.tiktokraft_gift_catalog as catalog
      (gift_id, gift_name, coin_value, image_url, first_seen_at, last_seen_at)
    select distinct on (gift_id)
      gift_id, gift_name, coin_value, image_url, first_seen_at, last_seen_at
    from public.tiktokraft_workspace_gift_catalog
    order by gift_id, (image_url <> '') desc, coin_value desc, last_seen_at desc
    on conflict (gift_id) do update set
      gift_name = case when excluded.gift_name <> '' then excluded.gift_name else catalog.gift_name end,
      coin_value = greatest(catalog.coin_value, excluded.coin_value),
      image_url = case when catalog.image_url = '' and excluded.image_url <> '' then excluded.image_url else catalog.image_url end,
      first_seen_at = least(catalog.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(catalog.last_seen_at, excluded.last_seen_at);
  end if;
end;
$$;

alter table public.tiktokraft_gift_catalog enable row level security;
revoke all on table public.tiktokraft_gift_catalog from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_gift_catalog to service_role;

create or replace function public.tiktokraft_upsert_gift_catalog(
  p_gift_id text,
  p_gift_name text,
  p_coin_value bigint,
  p_image_url text default ''
)
returns setof public.tiktokraft_gift_catalog
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_gift_id), '') is null then
    raise exception 'El ID real del regalo es obligatorio.';
  end if;

  return query
  insert into public.tiktokraft_gift_catalog as catalog
    (gift_id, gift_name, coin_value, image_url)
  values
    (trim(p_gift_id), left(coalesce(nullif(trim(p_gift_name), ''), trim(p_gift_id)), 80), greatest(coalesce(p_coin_value, 0), 0), left(coalesce(p_image_url, ''), 2048))
  on conflict (gift_id) do update set
    gift_name = case when excluded.gift_name <> '' then excluded.gift_name else catalog.gift_name end,
    coin_value = case when excluded.coin_value > 0 then excluded.coin_value else catalog.coin_value end,
    image_url = case when excluded.image_url <> '' then excluded.image_url else catalog.image_url end,
    last_seen_at = now()
  returning catalog.*;
end;
$$;

revoke all on function public.tiktokraft_upsert_gift_catalog(text, text, bigint, text) from public;
grant execute on function public.tiktokraft_upsert_gift_catalog(text, text, bigint, text) to service_role;

notify pgrst, 'reload schema';
