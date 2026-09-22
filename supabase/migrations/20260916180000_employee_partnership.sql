-- Partnership (שיתוף פעולה): source-based partner pay, not an employee wage model.

ALTER TABLE public.finance_employees
  DROP CONSTRAINT IF EXISTS finance_employees_employment_kind_check;

ALTER TABLE public.finance_employees
  ADD CONSTRAINT finance_employees_employment_kind_check
  CHECK (
    employment_kind IS NULL
    OR employment_kind IN ('salaried', 'freelancer', 'unpaid', 'partnership')
  );

COMMENT ON COLUMN public.finance_employees.employment_kind IS
  'salaried = שכיר, freelancer = עצמאי, unpaid = ללא שכר, partnership = שיתוף פעולה לפי מקור (Oshran ×4, no settled to partner). Null means not configured yet.';
