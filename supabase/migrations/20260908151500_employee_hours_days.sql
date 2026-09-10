-- Daily TimeWatch rows (date, kind, clock in/out, paid hours) on each month.

ALTER TABLE public.finance_employee_hours
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.finance_employee_hours.days IS
  'Daily attendance rows from the employee TimeWatch report for this month.';
