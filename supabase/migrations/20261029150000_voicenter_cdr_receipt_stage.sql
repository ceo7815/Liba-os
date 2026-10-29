-- Live stage of a CDR push: ring, answer, or hangup. One row per POST.

ALTER TABLE public.voicenter_cdr_receipts
  ADD COLUMN IF NOT EXISTS stage text;

COMMENT ON COLUMN public.voicenter_cdr_receipts.stage IS
  'Call stage for this POST: ring, answer, or hangup. Null when the body was rejected.';
