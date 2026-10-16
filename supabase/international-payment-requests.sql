-- Contactos de pago exterior. Enviar esta solicitud no confirma ni realiza un pago.
-- Ejecutar después de roles.sql; solo el servidor (service_role) tiene acceso.
create table if not exists public.tiktokraft_international_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text not null,
  country text not null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contacted_at timestamptz,
  contacted_by uuid references auth.users(id) on delete set null
);
create unique index if not exists tiktokraft_international_one_pending
  on public.tiktokraft_international_payment_requests (user_id) where status = 'pending';
create index if not exists tiktokraft_international_recent
  on public.tiktokraft_international_payment_requests (created_at desc);
alter table public.tiktokraft_international_payment_requests enable row level security;
revoke all on table public.tiktokraft_international_payment_requests from anon, authenticated;
grant select, insert, update on table public.tiktokraft_international_payment_requests to service_role;

create or replace function public.tiktokraft_start_international_payment_request(
  p_user_id uuid, p_email text, p_country text, p_phone text
)
returns setof public.tiktokraft_international_payment_requests
language plpgsql security definer set search_path = public, auth as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'La cuenta no existe.';
  end if;
  if length(trim(p_country)) < 2 or length(trim(p_country)) > 80 or
     length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 7 or
     length(regexp_replace(p_phone, '[^0-9]', '', 'g')) > 15 then
    raise exception 'Indica país y teléfono válidos.';
  end if;
  return query
    insert into public.tiktokraft_international_payment_requests (user_id, account_email, country, phone)
    values (p_user_id, lower(trim(p_email)), trim(p_country), trim(p_phone))
    on conflict (user_id) where status = 'pending'
    do update set account_email = excluded.account_email, country = excluded.country,
                  phone = excluded.phone, updated_at = now()
    returning *;
end;
$$;

create or replace function public.tiktokraft_mark_international_payment_contacted(p_id uuid, p_admin_id uuid)
returns setof public.tiktokraft_international_payment_requests
language plpgsql security definer set search_path = public, auth as $$
declare contact public.tiktokraft_international_payment_requests%rowtype;
begin
  if p_admin_id is null or not exists (select 1 from auth.users where id = p_admin_id) then
    raise exception 'El administrador no existe.';
  end if;
  update public.tiktokraft_international_payment_requests r
  set status = 'contacted', contacted_at = now(), contacted_by = p_admin_id, updated_at = now()
  where r.id = p_id and r.status = 'pending' returning * into contact;
  if contact.id is null then raise exception 'La solicitud ya fue atendida o no existe.'; end if;
  return next contact;
end;
$$;

revoke all on function public.tiktokraft_start_international_payment_request(uuid,text,text,text) from public;
revoke all on function public.tiktokraft_mark_international_payment_contacted(uuid,uuid) from public;
grant execute on function public.tiktokraft_start_international_payment_request(uuid,text,text,text) to service_role;
grant execute on function public.tiktokraft_mark_international_payment_contacted(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
