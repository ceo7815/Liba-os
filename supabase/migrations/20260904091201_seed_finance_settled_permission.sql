-- Grant finance.settled to legacy finance allowlist (and anyone who already has finance.insurance).

insert into public.profile_permissions (profile_id, permission_key)
select p.id, 'finance.settled'
from public.profiles p
where p.is_active = true
  and (
    lower(p.email) in ('ceo@beosystem.com', 'asaf@liba-fs.co.il')
    or exists (
      select 1
      from public.profile_permissions pp
      where pp.profile_id = p.id
        and pp.permission_key = 'finance.insurance'
        and pp.granted = true
    )
  )
on conflict do nothing;
