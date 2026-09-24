-- Estadísticas administrativas de TikTokraft Live.
-- Ejecutar una sola vez en Supabase SQL Editor, después de multiuser.sql.

create or replace function public.tiktokraft_list_registered_accounts()
returns table (
  user_id uuid,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  workspace_updated_at timestamptz,
  tiktok_username text
)
language sql security definer set search_path = public, auth as $$
  select
    users.id,
    users.email::text,
    users.created_at,
    users.last_sign_in_at,
    workspaces.updated_at,
    coalesce(workspaces.config ->> 'tiktokUsername', '')::text
  from auth.users as users
  left join public.tiktokraft_workspaces as workspaces on workspaces.owner_id = users.id
  where users.deleted_at is null
  order by users.created_at desc;
$$;

revoke all on function public.tiktokraft_list_registered_accounts() from public;
grant execute on function public.tiktokraft_list_registered_accounts() to service_role;

notify pgrst, 'reload schema';
