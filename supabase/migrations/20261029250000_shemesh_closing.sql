-- Shemesh closing tools. Additive shemesh_* only. Not applied to production.

CREATE TABLE IF NOT EXISTS public.shemesh_bank_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date,
  description text NOT NULL DEFAULT '',
  amount numeric(14, 2) NOT NULL,
  matched_ledger_id uuid,
  import_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_ad_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  campaign text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  byte_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_ad_receipts_source_check CHECK (source IN ('google', 'facebook', 'other'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_mail_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_ad_budgets (
  month text PRIMARY KEY,
  amount numeric(14, 2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shemesh_bank_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_ad_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_mail_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_ad_budgets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shemesh_bank_lines', 'shemesh_ad_receipts', 'shemesh_mail_drafts', 'shemesh_ad_budgets']
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())',
      t || '_admin', t
    );
  END LOOP;
END $$;
