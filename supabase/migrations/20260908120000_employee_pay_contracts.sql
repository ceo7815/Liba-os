-- Editable pay clauses on each employee card.
-- Volume (היקף) fields stay on volume reports; settled (נפרעים) fields stay on settled reports.

ALTER TABLE public.finance_employees
  ADD COLUMN IF NOT EXISTS employment_kind text,
  ADD COLUMN IF NOT EXISTS pay_contract jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_employees_employment_kind_check'
  ) THEN
    ALTER TABLE public.finance_employees
      ADD CONSTRAINT finance_employees_employment_kind_check
      CHECK (employment_kind IS NULL OR employment_kind IN ('salaried', 'freelancer'));
  END IF;
END $$;

COMMENT ON COLUMN public.finance_employees.employment_kind IS
  'salaried = שכיר, freelancer = עצמאי. Null means the card is not configured yet.';
COMMENT ON COLUMN public.finance_employees.pay_contract IS
  'Editable agreement fields: hourly, study fund, production tiers, appointment %, travel %, volume %, settled %.';
