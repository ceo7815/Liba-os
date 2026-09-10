-- Insurer income multiplier on each closed premium (Liba receives premium × 9).

ALTER TABLE public.marketing_settings
  ADD COLUMN IF NOT EXISTS insurer_multiplier numeric(8, 4) NOT NULL DEFAULT 9;

COMMENT ON COLUMN public.marketing_settings.insurer_multiplier IS
  'What Liba receives from insurers on each closed premium. Net = (premium × this) − wages − marketing.';
