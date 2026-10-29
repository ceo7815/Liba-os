-- Case lifecycle fields, Sheet-6 queue, named fee settings.
-- Additive shemesh_* only. No Liba tables. No amounts. Safe to run twice.

ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS lead_source text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS handler_team text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS deal_date date;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS collected_date date;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS expected_amount numeric(14, 2);
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS received_amount numeric(14, 2);
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS fee_amount numeric(14, 2);
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS surense_id text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS excel_row_id text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS client_ref_encrypted text;
ALTER TABLE public.shemesh_cases ADD COLUMN IF NOT EXISTS sla_due_at date;

ALTER TABLE public.shemesh_cases DROP CONSTRAINT IF EXISTS shemesh_cases_status_check;
ALTER TABLE public.shemesh_cases ADD CONSTRAINT shemesh_cases_status_check
  CHECK (status IN ('open', 'waiting', 'done', 'cancelled', 'on_hold'));

ALTER TABLE public.shemesh_cases DROP CONSTRAINT IF EXISTS shemesh_cases_service_check;
ALTER TABLE public.shemesh_cases ADD CONSTRAINT shemesh_cases_service_check
  CHECK (service_type IS NULL OR service_type IN ('redemption', 'tax_refund', 'claim', 'national_insurance', 'other'));

CREATE UNIQUE INDEX IF NOT EXISTS shemesh_cases_surense_id_idx
  ON public.shemesh_cases (surense_id) WHERE surense_id IS NOT NULL AND surense_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS shemesh_cases_excel_row_idx
  ON public.shemesh_cases (excel_row_id) WHERE excel_row_id IS NOT NULL AND excel_row_id <> '';

ALTER TABLE public.shemesh_case_documents ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.shemesh_case_documents DROP CONSTRAINT IF EXISTS shemesh_case_documents_state_check;
ALTER TABLE public.shemesh_case_documents ADD CONSTRAINT shemesh_case_documents_state_check
  CHECK (state IS NULL OR state IN ('missing', 'received', 'invalid'));

ALTER TABLE public.shemesh_fee_settings ADD COLUMN IF NOT EXISTS success_fee_rates jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.shemesh_fee_settings ADD COLUMN IF NOT EXISTS rates_pending boolean NOT NULL DEFAULT true;
ALTER TABLE public.shemesh_fee_settings ADD COLUMN IF NOT EXISTS fee_multiplier numeric(8, 6);
ALTER TABLE public.shemesh_fee_settings ADD COLUMN IF NOT EXISTS multiplier_pending boolean NOT NULL DEFAULT true;

ALTER TABLE public.shemesh_ledger ADD COLUMN IF NOT EXISTS tax_status text;
ALTER TABLE public.shemesh_insurer_rows ADD COLUMN IF NOT EXISTS settlement_status text;

CREATE TABLE IF NOT EXISTS public.shemesh_sheet6_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text,
  excel_row_id text,
  surense_id text,
  opened_case_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_sheet6_queue_name_check CHECK (char_length(trim(client_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS shemesh_sheet6_excel_idx
  ON public.shemesh_sheet6_queue (excel_row_id) WHERE excel_row_id IS NOT NULL AND excel_row_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS shemesh_sheet6_surense_idx
  ON public.shemesh_sheet6_queue (surense_id) WHERE surense_id IS NOT NULL AND surense_id <> '';

ALTER TABLE public.shemesh_sheet6_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shemesh_sheet6_queue FROM anon, authenticated;
GRANT SELECT ON TABLE public.shemesh_sheet6_queue TO authenticated;
DROP POLICY IF EXISTS shemesh_sheet6_queue_admin ON public.shemesh_sheet6_queue;
CREATE POLICY shemesh_sheet6_queue_admin ON public.shemesh_sheet6_queue
  FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
