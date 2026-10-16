-- Solicitudes de pago manual. Un clic en el enlace NO confirma un pago.
-- Ejecutar después de roles.sql; solo el servidor (service_role) puede acceder.
create table if not exists public.tiktokraft_manual_pro_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  transaction_reference text
);
create unique index if not exists tiktokraft_manual_pro_one_pending
  on public.tiktokraft_manual_pro_requests (user_id) where status = 'pending';
create unique index if not exists tiktokraft_manual_pro_unique_payment
  on public.tiktokraft_manual_pro_requests (lower(transaction_reference))
  where status = 'approved' and transaction_reference is not null;
create index if not exists tiktokraft_manual_pro_recent
  on public.tiktokraft_manual_pro_requests (created_at desc);
alter table public.tiktokraft_manual_pro_requests enable row level security;
revoke all on table public.tiktokraft_manual_pro_requests from anon, authenticated;
grant select, insert, update on table public.tiktokraft_manual_pro_requests to service_role;

create or replace function public.tiktokraft_start_manual_pro_request(p_user_id uuid, p_email text)
returns setof public.tiktokraft_manual_pro_requests
language plpgsql security definer set search_path = public, auth as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'La cuenta no existe.';
  end if;
  return query
    insert into public.tiktokraft_manual_pro_requests (user_id, account_email)
    values (p_user_id, lower(trim(p_email)))
    on conflict (user_id) where status = 'pending'
    do update set account_email = excluded.account_email
    returning *;
end;
$$;

create or replace function public.tiktokraft_review_manual_pro_request(
  p_id uuid, p_admin_id uuid, p_decision text, p_transaction_reference text default null
)
returns setof public.tiktokraft_manual_pro_requests
language plpgsql security definer set search_path = public, auth as $$
declare
  payment public.tiktokraft_manual_pro_requests%rowtype;
  normalized_reference text := nullif(trim(p_transaction_reference), '');
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Decisión inválida.'; end if;
  if p_decision = 'approved' and (normalized_reference is null or length(normalized_reference) < 4 or length(normalized_reference) > 128) then
    raise exception 'Indica la referencia de la transacción verificada.';
  end if;
  select * into payment from public.tiktokraft_manual_pro_requests r where r.id = p_id for update;
  if payment.id is null then raise exception 'Solicitud no encontrada.'; end if;
  if payment.status <> 'pending' then raise exception 'Esta solicitud ya fue revisada.'; end if;

  update public.tiktokraft_manual_pro_requests r
  set status = p_decision, reviewed_at = now(), reviewed_by = p_admin_id,
      transaction_reference = case when p_decision = 'approved' then normalized_reference else null end
  where r.id = p_id returning * into payment;

  if p_decision = 'approved' then
    insert into public.tiktokraft_account_roles as roles (user_id, role, assigned_by)
    values (payment.user_id, 'pro', p_admin_id)
    on conflict on constraint tiktokraft_account_roles_pkey do update
    set role = 'pro', assigned_by = p_admin_id, updated_at = now()
    where roles.role <> 'administrator';
  end if;
  return next payment;
end;
$$;

revoke all on function public.tiktokraft_start_manual_pro_request(uuid,text) from public;
revoke all on function public.tiktokraft_review_manual_pro_request(uuid,uuid,text,text) from public;
grant execute on function public.tiktokraft_start_manual_pro_request(uuid,text) to service_role;
grant execute on function public.tiktokraft_review_manual_pro_request(uuid,uuid,text,text) to service_role;
notify pgrst, 'reload schema';
