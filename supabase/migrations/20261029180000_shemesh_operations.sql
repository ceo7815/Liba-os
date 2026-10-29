-- Shemesh operations: cases, ledgers, recurring money, connections, audit.
-- Idempotent and additive. Creates only new public.shemesh_* objects.
-- Does not ALTER or DROP any existing Liba table.
-- RLS policies call private.is_admin(), which already exists in this project.
-- No seed rows and no amounts. Apply only after review.
-- Safe to run again: tables, indexes, grants, and policies are created or replaced in place.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.shemesh_fee_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  redemption_fee_rate numeric(8, 6),
  tax_fee_rate numeric(8, 6),
  vat_rate numeric(8, 6),
  sla_days integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_fee_settings_sla_check CHECK (sla_days IS NULL OR sla_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.shemesh_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text,
  stage text NOT NULL DEFAULT 'lead',
  status text NOT NULL DEFAULT 'open',
  handler text,
  opened_on date NOT NULL DEFAULT CURRENT_DATE,
  deadline date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_cases_client_check CHECK (char_length(trim(client_name)) > 0),
  CONSTRAINT shemesh_cases_stage_check CHECK (stage IN ('lead', 'eligibility', 'poa', 'documents', 'filed', 'followup', 'refund', 'collected')),
  CONSTRAINT shemesh_cases_status_check CHECK (status IN ('open', 'waiting', 'done', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.shemesh_cases (id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee text,
  due_on date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_case_tasks_title_check CHECK (char_length(trim(title)) > 0),
  CONSTRAINT shemesh_case_tasks_status_check CHECK (status IN ('open', 'done'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.shemesh_cases (id) ON DELETE CASCADE,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  received boolean NOT NULL DEFAULT false,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_case_documents_label_check CHECK (char_length(trim(label)) > 0)
);

CREATE TABLE IF NOT EXISTS public.shemesh_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.shemesh_cases (id) ON DELETE CASCADE,
  body text NOT NULL,
  author text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_case_notes_body_check CHECK (char_length(trim(body)) > 0)
);

CREATE TABLE IF NOT EXISTS public.shemesh_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  client_name text NOT NULL,
  day date,
  gross numeric(14, 2) NOT NULL,
  fee_rate numeric(8, 6),
  fee numeric(14, 2),
  net numeric(14, 2),
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_ledger_kind_check CHECK (kind IN ('redemption', 'tax_refund')),
  CONSTRAINT shemesh_ledger_status_check CHECK (status IN ('open', 'waiting', 'done', 'cancelled')),
  CONSTRAINT shemesh_ledger_client_check CHECK (char_length(trim(client_name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.shemesh_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  amount numeric(14, 2),
  cadence text NOT NULL DEFAULT 'monthly',
  day_of_month integer,
  starts_on date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_rules_kind_check CHECK (kind IN ('cost', 'debt', 'income', 'payroll', 'commission')),
  CONSTRAINT shemesh_rules_cadence_check CHECK (cadence IN ('monthly', 'once')),
  CONSTRAINT shemesh_rules_title_check CHECK (char_length(trim(title)) > 0),
  CONSTRAINT shemesh_rules_day_check CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 28))
);

CREATE TABLE IF NOT EXISTS public.shemesh_month_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.shemesh_rules (id) ON DELETE SET NULL,
  kind text NOT NULL,
  month date NOT NULL,
  title text NOT NULL,
  amount numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_month_lines_kind_check CHECK (kind IN ('cost', 'debt', 'income', 'payroll', 'commission'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_facebook_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ad_account_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  connected_name text,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_google_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  customer_id text,
  login_customer_id text,
  refresh_token_encrypted text,
  connected_email text,
  candidate_customers jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_excel_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  drive_id text,
  item_id text,
  file_name text,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_surense_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'same',
  client_id_encrypted text,
  client_secret_encrypted text,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_surense_settings_mode_check CHECK (mode IN ('same', 'separate'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_provider_secrets (
  provider text PRIMARY KEY,
  api_url text,
  secret_encrypted text,
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_provider_secrets_provider_check CHECK (provider IN ('rivhit', 'grow', 'insurance'))
);

ALTER TABLE public.shemesh_fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_month_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_facebook_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_google_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_excel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_surense_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_provider_secrets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shemesh_fee_settings',
    'shemesh_audit',
    'shemesh_cases',
    'shemesh_case_tasks',
    'shemesh_case_documents',
    'shemesh_case_notes',
    'shemesh_ledger',
    'shemesh_rules',
    'shemesh_month_lines',
    'shemesh_facebook_settings',
    'shemesh_google_settings',
    'shemesh_excel_settings',
    'shemesh_surense_settings',
    'shemesh_provider_secrets'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())',
      t || '_admin',
      t
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS shemesh_cases_stage_idx ON public.shemesh_cases (stage, status);
CREATE INDEX IF NOT EXISTS shemesh_ledger_kind_idx ON public.shemesh_ledger (kind, day);
CREATE INDEX IF NOT EXISTS shemesh_audit_created_idx ON public.shemesh_audit (created_at DESC);
