-- Roles administrativos de TikTokraft Live.
-- Ejecutar una sola vez en Supabase SQL Editor, después de admin.sql.

create table if not exists public.tiktokraft_account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (length(trim(role)) > 0),
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiktokraft_account_roles enable row level security;
revoke all on table public.tiktokraft_account_roles from anon, authenticated;
grant select, insert, update, delete on table public.tiktokraft_account_roles to service_role;

-- Conserva al administrador principal incluso si el servicio se despliega de nuevo.
insert into public.tiktokraft_account_roles (user_id, role)
select id, 'administrator'
from auth.users
where lower(email) = 'loroteca98@gmail.com'
on conflict on constraint tiktokraft_account_roles_pkey do update
set role = 'administrator', updated_at = now();

create or replace function public.tiktokraft_list_account_roles()
returns table (
  user_id uuid,
  email text,
  role text,
  assigned_at timestamptz,
  updated_at timestamptz
)
language sql security definer set search_path = public, auth as $$
  select roles.user_id, users.email, roles.role, roles.assigned_at, roles.updated_at
  from public.tiktokraft_account_roles roles
  join auth.users users on users.id = roles.user_id
  order by lower(users.email);
$$;

create or replace function public.tiktokraft_assign_account_role(
  p_email text,
  p_role text,
  p_assigned_by uuid
)
returns table (
  user_id uuid,
  email text,
  role text,
  assigned_at timestamptz,
  updated_at timestamptz
)
language plpgsql security definer set search_path = public, auth as $$
declare
  target_user auth.users%rowtype;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'El correo es obligatorio.';
  end if;
  if lower(trim(p_role)) <> 'administrator' then
    raise exception 'El rol seleccionado no es válido.';
  end if;

  select * into target_user
  from auth.users as users
  where lower(users.email) = lower(trim(p_email))
  limit 1;

  if target_user.id is null then
    raise exception 'No existe una cuenta registrada con ese correo.';
  end if;

  insert into public.tiktokraft_account_roles as account_roles (user_id, role, assigned_by)
  values (target_user.id, lower(trim(p_role)), p_assigned_by)
  on conflict on constraint tiktokraft_account_roles_pkey do update
  set role = excluded.role, assigned_by = excluded.assigned_by, updated_at = now();

  return query
  select account_roles.user_id, target_user.email, account_roles.role, account_roles.assigned_at, account_roles.updated_at
  from public.tiktokraft_account_roles as account_roles
  where account_roles.user_id = target_user.id;
end;
$$;

create or replace function public.tiktokraft_remove_account_role(p_email text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  target_id uuid;
begin
  select users.id into target_id
  from auth.users as users
  where lower(users.email) = lower(trim(p_email))
  limit 1;

  if target_id is null then
    raise exception 'No existe una cuenta registrada con ese correo.';
  end if;

  delete from public.tiktokraft_account_roles as account_roles
  where account_roles.user_id = target_id;
end;
$$;

revoke all on function public.tiktokraft_list_account_roles() from public;
revoke all on function public.tiktokraft_assign_account_role(text, text, uuid) from public;
revoke all on function public.tiktokraft_remove_account_role(text) from public;
grant execute on function public.tiktokraft_list_account_roles() to service_role;
grant execute on function public.tiktokraft_assign_account_role(text, text, uuid) to service_role;
grant execute on function public.tiktokraft_remove_account_role(text) to service_role;

notify pgrst, 'reload schema';
