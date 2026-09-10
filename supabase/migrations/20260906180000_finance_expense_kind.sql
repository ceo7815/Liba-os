-- Distinguish fixed (recurring) vs variable (one-off) expenses in the expenses hub.

alter table public.finance_fixed_costs
  add column if not exists expense_kind text not null default 'fixed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_fixed_costs_expense_kind_check'
  ) then
    alter table public.finance_fixed_costs
      add constraint finance_fixed_costs_expense_kind_check
      check (expense_kind in ('fixed', 'variable'));
  end if;
end $$;

create index if not exists finance_fixed_costs_expense_kind_idx
  on public.finance_fixed_costs (expense_kind)
  where is_active = true;

comment on column public.finance_fixed_costs.expense_kind is
  'fixed = recurring monthly overhead; variable = one-off / non-recurring paid expense';
