-- Allow unpaid (ללא שכר) agreements: closed premium is company profit, wage is 0.

ALTER TABLE public.finance_employees
  DROP CONSTRAINT IF EXISTS finance_employees_employment_kind_check;

ALTER TABLE public.finance_employees
  ADD CONSTRAINT finance_employees_employment_kind_check
  CHECK (
    employment_kind IS NULL
    OR employment_kind IN ('salaried', 'freelancer', 'unpaid')
  );

COMMENT ON COLUMN public.finance_employees.employment_kind IS
  'salaried = שכיר, freelancer = עצמאי, unpaid = ללא שכר (wage 0, production is company profit). Null means not configured yet.';
