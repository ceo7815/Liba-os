-- Track whether income was entered after 5% Israeli withholding tax.
-- Ledger amounts are always stored before withholding (gross commission).

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS withholding_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.finance_entries.withholding_applied IS
  'True if the typed amount was after 5% מס במקור; stored amount is always before withholding.';
