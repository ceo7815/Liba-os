-- Rivhit, Grow, and insurer imports. Additive shemesh_* only.
-- Idempotent. No ALTER or DROP of Liba tables. No seed amounts.
-- Depends on private.is_admin() already existing in this project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.shemesh_rivhit_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_id text,
  api_token_encrypted text,
  monthly_quota integer,
  ops_month text,
  ops_count integer NOT NULL DEFAULT 0,
  cache jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_rivhit_quota_check CHECK (monthly_quota IS NULL OR monthly_quota >= 0)
);

CREATE TABLE IF NOT EXISTS public.shemesh_grow_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id text,
  page_code_encrypted text,
  api_key_encrypted text,
  environment text NOT NULL DEFAULT 'sandbox',
  webhook_token text,
  last_transaction_id text,
  last_checked_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_grow_environment_check CHECK (environment IN ('sandbox', 'production'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_insurer_mappings (
  company text PRIMARY KEY,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shemesh_insurer_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  kind text NOT NULL,
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_insurer_imports_kind_check CHECK (kind IN ('excel', 'swiftness'))
);

CREATE TABLE IF NOT EXISTS public.shemesh_insurer_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  external_key text NOT NULL,
  policy_ref text,
  client_name text,
  premium numeric(14, 2),
  commission numeric(14, 2),
  produced_on date,
  import_id uuid REFERENCES public.shemesh_insurer_imports (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_insurer_rows_key UNIQUE (company, external_key)
);

ALTER TABLE public.shemesh_rivhit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_grow_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_insurer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_insurer_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_insurer_rows ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shemesh_rivhit_settings',
    'shemesh_grow_settings',
    'shemesh_insurer_mappings',
    'shemesh_insurer_imports',
    'shemesh_insurer_rows'
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

CREATE INDEX IF NOT EXISTS shemesh_insurer_rows_company_idx ON public.shemesh_insurer_rows (company, produced_on);
CREATE INDEX IF NOT EXISTS shemesh_insurer_imports_created_idx ON public.shemesh_insurer_imports (created_at DESC);
