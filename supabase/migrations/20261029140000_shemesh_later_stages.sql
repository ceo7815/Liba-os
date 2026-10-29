-- Shemesh stages 10, 4, 9, 11, 5, 3, 7.
-- Structure only. No payroll figures, debts, or loan amounts.
-- Do not apply this file from the app. Run it in Supabase when ready.

CREATE TABLE IF NOT EXISTS public.shemesh_fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  cadence text NOT NULL DEFAULT 'monthly',
  vat_mode text NOT NULL DEFAULT 'exclusive',
  amount numeric(14, 2),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_fixed_costs_title_check CHECK (char_length(trim(title)) > 0),
  CONSTRAINT shemesh_fixed_costs_cadence_check CHECK (cadence IN ('monthly', 'bimonthly', 'usage')),
  CONSTRAINT shemesh_fixed_costs_vat_check CHECK (vat_mode IN ('exclusive', 'inclusive'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  label text NOT NULL,
  opened_on date,
  balance numeric(14, 2),
  monthly_payment numeric(14, 2),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_obligations_kind_check CHECK (kind IN ('debt', 'loan', 'card'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  file_name text,
  day date,
  amount numeric(14, 2),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_receipts_source_check CHECK (source IN ('google', 'facebook', 'other'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date,
  description text NOT NULL DEFAULT '',
  amount numeric(14, 2) NOT NULL,
  matched_receipt_id uuid REFERENCES public.shemesh_receipts (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_insurance_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer text NOT NULL DEFAULT '',
  policy_ref text,
  agent_name text,
  produced_on date,
  premium numeric(14, 2),
  settled numeric(14, 2),
  reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_income_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  month date,
  amount numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_income_items_kind_check CHECK (kind IN ('settled', 'insurance_sale', 'redemption'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  collected_in_liba numeric(14, 2),
  transferred numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_pay_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL,
  model text NOT NULL,
  hours numeric(8, 2),
  hourly_rate numeric(14, 2),
  bands jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_pay_profiles_model_check CHECK (model IN ('hourly', 'collection', 'insurance', 'managers'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_agency_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'same',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_agency_settings_mode_check CHECK (mode IN ('same', 'separate'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_revival_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'queued',
  template_id uuid REFERENCES public.shemesh_message_templates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_revival_queue_status_check CHECK (status IN ('queued', 'skipped', 'done'))
);

ALTER TABLE public.shemesh_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_bank_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_insurance_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_income_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_pay_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_revival_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shemesh_fixed_costs FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_obligations FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_receipts FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_bank_lines FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_insurance_rows FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_income_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_settlements FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_pay_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_agency_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_message_templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_revival_queue FROM anon, authenticated;

GRANT SELECT ON TABLE public.shemesh_fixed_costs TO authenticated;
GRANT SELECT ON TABLE public.shemesh_obligations TO authenticated;
GRANT SELECT ON TABLE public.shemesh_receipts TO authenticated;
GRANT SELECT ON TABLE public.shemesh_bank_lines TO authenticated;
GRANT SELECT ON TABLE public.shemesh_insurance_rows TO authenticated;
GRANT SELECT ON TABLE public.shemesh_income_items TO authenticated;
GRANT SELECT ON TABLE public.shemesh_settlements TO authenticated;
GRANT SELECT ON TABLE public.shemesh_pay_profiles TO authenticated;
GRANT SELECT ON TABLE public.shemesh_agency_settings TO authenticated;
GRANT SELECT ON TABLE public.shemesh_message_templates TO authenticated;
GRANT SELECT ON TABLE public.shemesh_revival_queue TO authenticated;

CREATE POLICY shemesh_fixed_costs_admin ON public.shemesh_fixed_costs FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_obligations_admin ON public.shemesh_obligations FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_receipts_admin ON public.shemesh_receipts FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_bank_lines_admin ON public.shemesh_bank_lines FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_insurance_rows_admin ON public.shemesh_insurance_rows FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_income_items_admin ON public.shemesh_income_items FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_settlements_admin ON public.shemesh_settlements FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_pay_profiles_admin ON public.shemesh_pay_profiles FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_agency_settings_admin ON public.shemesh_agency_settings FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_message_templates_admin ON public.shemesh_message_templates FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY shemesh_revival_queue_admin ON public.shemesh_revival_queue FOR SELECT TO authenticated USING (private.is_admin());
