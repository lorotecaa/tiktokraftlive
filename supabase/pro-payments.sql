-- Ejecutar en Supabase SQL Editor después de roles.sql.
-- Cada checkout tiene una referencia única ligada al ID de la cuenta autenticada.
create table if not exists public.tiktokraft_pro_orders (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text not null,
  amount_in_cents bigint not null check (amount_in_cents > 0),
  currency text not null check (currency = 'COP'),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  transaction_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists tiktokraft_pro_orders_user_recent on public.tiktokraft_pro_orders (user_id, created_at desc);
alter table public.tiktokraft_pro_orders enable row level security;
revoke all on table public.tiktokraft_pro_orders from anon, authenticated;
grant select, insert, update on table public.tiktokraft_pro_orders to service_role;

create or replace function public.tiktokraft_complete_pro_order(
  p_reference text, p_transaction_id text, p_amount_in_cents bigint, p_currency text
)
returns table (user_id uuid, status text, activated boolean)
language plpgsql security definer set search_path = public, auth as $$
declare
  payment public.tiktokraft_pro_orders%rowtype;
begin
  if nullif(trim(p_transaction_id), '') is null then raise exception 'La transacción no tiene ID.'; end if;
  select * into payment from public.tiktokraft_pro_orders orders
  where orders.reference = p_reference for update;
  if payment.reference is null then raise exception 'Referencia de pago desconocida.'; end if;
  if payment.amount_in_cents <> p_amount_in_cents or payment.currency <> p_currency then
    raise exception 'El monto o la moneda del pago no coinciden.';
  end if;
  if payment.status = 'approved' then
    if payment.transaction_id <> p_transaction_id then raise exception 'Esta referencia ya fue pagada con otra transacción.'; end if;
    return query select payment.user_id, payment.status, false;
    return;
  end if;
  update public.tiktokraft_pro_orders orders
  set status = 'approved', transaction_id = p_transaction_id, paid_at = now()
  where orders.reference = p_reference;
  insert into public.tiktokraft_account_roles as roles (user_id, role)
  values (payment.user_id, 'pro')
  on conflict on constraint tiktokraft_account_roles_pkey do update
  set role = 'pro', updated_at = now()
  where roles.role <> 'administrator';
  return query select payment.user_id, 'approved'::text, true;
end;
$$;

revoke all on function public.tiktokraft_complete_pro_order(text,text,bigint,text) from public;
grant execute on function public.tiktokraft_complete_pro_order(text,text,bigint,text) to service_role;
notify pgrst, 'reload schema';
