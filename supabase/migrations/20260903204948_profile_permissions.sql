-- Granular per-user permission matrix (sidebar categories + actions).

create table if not exists public.profile_permissions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null,
  granted boolean not null default true,
  granted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (profile_id, permission_key),
  constraint profile_permissions_key_format
    check (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

create index if not exists profile_permissions_key_idx
  on public.profile_permissions (permission_key)
  where granted = true;

alter table public.profile_permissions enable row level security;

drop policy if exists "Admins read profile permissions" on public.profile_permissions;
create policy "Admins read profile permissions"
  on public.profile_permissions
  for select
  to authenticated
  using (private.is_admin());

drop policy if exists "Users read own permissions" on public.profile_permissions;
create policy "Users read own permissions"
  on public.profile_permissions
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Writes go through service role (Next.js admin client).

create or replace function public.admin_list_profiles_with_permissions()
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  is_active boolean,
  created_at timestamptz,
  permission_keys text[]
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not private.is_admin() then
    raise exception 'not allowed';
  end if;

  return query
  select
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active,
    p.created_at,
    coalesce(
      (
        select array_agg(pp.permission_key order by pp.permission_key)
        from public.profile_permissions pp
        where pp.profile_id = p.id and pp.granted = true
      ),
      '{}'::text[]
    ) as permission_keys
  from public.profiles p
  order by p.created_at asc;
end;
$$;

revoke all on function public.admin_list_profiles_with_permissions() from public;
grant execute on function public.admin_list_profiles_with_permissions() to authenticated;

-- Seed baseline: every active user gets core work access.
insert into public.profile_permissions (profile_id, permission_key)
select p.id, k.permission_key
from public.profiles p
cross join (
  values
    ('dashboard.view'),
    ('agents.view'),
    ('vault.view')
) as k(permission_key)
where p.is_active = true
on conflict do nothing;

-- Active admins: org + employees + sales + agents/vault manage + portals.
insert into public.profile_permissions (profile_id, permission_key)
select p.id, k.permission_key
from public.profiles p
cross join (
  values
    ('dashboard.view'),
    ('agents.view'),
    ('agents.manage'),
    ('vault.view'),
    ('vault.manage'),
    ('sales.view'),
    ('employees.view'),
    ('employees.agreements'),
    ('org.users'),
    ('portals.view')
) as k(permission_key)
where p.role = 'admin' and p.is_active = true
on conflict do nothing;

-- Legacy finance allowlist emails → full finance suite.
insert into public.profile_permissions (profile_id, permission_key)
select p.id, k.permission_key
from public.profiles p
cross join (
  values
    ('finance.pl_general'),
    ('finance.source_pnl'),
    ('finance.fixed_expenses'),
    ('finance.insurance'),
    ('finance.ledger')
) as k(permission_key)
where lower(p.email) in ('ceo@beosystem.com', 'asaf@liba-fs.co.il')
on conflict do nothing;
