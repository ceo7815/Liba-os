-- Expenses v2: allocation (office vs sources), invoice on cost, clear seed catalog.

-- Soft-clear existing seeded / old fixed costs so the agency can re-enter cleanly.
update public.finance_fixed_costs
set is_active = false,
    updated_at = now()
where is_active = true;

alter table public.finance_fixed_costs
  add column if not exists allocation_type text not null default 'office',
  add column if not exists invoice_storage_path text,
  add column if not exists invoice_file_name text,
  add column if not exists invoice_mime_type text,
  add column if not exists invoice_uploaded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_fixed_costs_allocation_type_check'
  ) then
    alter table public.finance_fixed_costs
      add constraint finance_fixed_costs_allocation_type_check
      check (allocation_type in ('office', 'sources'));
  end if;
end $$;

create table if not exists public.finance_fixed_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  fixed_cost_id uuid not null
    references public.finance_fixed_costs (id) on delete cascade,
  source_name text not null,
  share_percent numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  constraint finance_fixed_cost_allocations_share_check
    check (share_percent > 0 and share_percent <= 100),
  constraint finance_fixed_cost_allocations_source_check
    check (char_length(trim(source_name)) > 0),
  unique (fixed_cost_id, source_name)
);

create index if not exists finance_fixed_cost_allocations_cost_idx
  on public.finance_fixed_cost_allocations (fixed_cost_id);

create index if not exists finance_fixed_cost_allocations_source_idx
  on public.finance_fixed_cost_allocations (source_name);

revoke all on table public.finance_fixed_cost_allocations from anon, authenticated;
grant select on table public.finance_fixed_cost_allocations to authenticated;

alter table public.finance_fixed_cost_allocations enable row level security;

drop policy if exists finance_fixed_cost_allocations_select_admin
  on public.finance_fixed_cost_allocations;
create policy finance_fixed_cost_allocations_select_admin
  on public.finance_fixed_cost_allocations
  for select to authenticated
  using (private.is_admin());

comment on column public.finance_fixed_costs.allocation_type is
  'office = general office overhead; sources = split across lead sources';
comment on table public.finance_fixed_cost_allocations is
  'Proportional source split for a fixed cost (percentages should sum to 100)';
