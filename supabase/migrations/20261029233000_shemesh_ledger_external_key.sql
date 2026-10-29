-- Idempotent key so a tax-report import does not insert the same row twice.
-- Additive shemesh_* only. No amounts.

ALTER TABLE public.shemesh_ledger ADD COLUMN IF NOT EXISTS external_key text;

CREATE UNIQUE INDEX IF NOT EXISTS shemesh_ledger_external_key_idx
  ON public.shemesh_ledger (kind, external_key)
  WHERE external_key IS NOT NULL AND external_key <> '';
