-- Salary entries must be assigned to an employee and a calendar month (YYYY-MM).

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS payroll_month text;

ALTER TABLE public.finance_entries
  DROP CONSTRAINT IF EXISTS finance_entries_payroll_month_check;

ALTER TABLE public.finance_entries
  ADD CONSTRAINT finance_entries_payroll_month_check
  CHECK (
    payroll_month IS NULL
    OR payroll_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  );

CREATE INDEX IF NOT EXISTS finance_entries_payroll_month_idx
  ON public.finance_entries (payroll_month);

CREATE INDEX IF NOT EXISTS finance_entries_employee_month_idx
  ON public.finance_entries (employee_id, payroll_month);

CREATE OR REPLACE FUNCTION public.finance_entries_require_salary_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind = 'expense' AND NEW.category IN ('salary_gross', 'salary_social', 'salary_bonus') THEN
    IF NEW.employee_id IS NULL THEN
      RAISE EXCEPTION 'חובה לשייך משכורת לעובד';
    END IF;
    IF NEW.payroll_month IS NULL OR NEW.payroll_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
      RAISE EXCEPTION 'חובה לבחור חודש משכורת';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_entries_require_salary_assignment
  ON public.finance_entries;

CREATE TRIGGER finance_entries_require_salary_assignment
  BEFORE INSERT OR UPDATE ON public.finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.finance_entries_require_salary_assignment();

COMMENT ON COLUMN public.finance_entries.payroll_month IS 'YYYY-MM salary period; required for salary categories';
