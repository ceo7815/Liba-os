-- Finance module: manual ledger for insurance agency P&L (admin-only)

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  category text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  occurred_at date NOT NULL,
  portal_slug text,
  commission_type text,
  description text,
  reference_number text,
  vat_included boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_entries_kind_check CHECK (
    kind IN ('income', 'income_adjustment', 'expense', 'transfer')
  ),
  CONSTRAINT finance_entries_amount_check CHECK (amount > 0),
  CONSTRAINT finance_entries_category_check CHECK (char_length(trim(category)) > 0)
);

CREATE INDEX finance_entries_occurred_at_idx
  ON public.finance_entries (occurred_at DESC);
CREATE INDEX finance_entries_kind_idx ON public.finance_entries (kind);
CREATE INDEX finance_entries_category_idx ON public.finance_entries (category);
CREATE INDEX finance_entries_portal_slug_idx
  ON public.finance_entries (portal_slug);

CREATE OR REPLACE FUNCTION public.finance_entries_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_entries_updated_at_trg
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.finance_entries_set_updated_at();

CREATE TABLE public.finance_bank_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  balance numeric(14, 2) NOT NULL,
  account_label text NOT NULL DEFAULT 'עו״ש ראשי',
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_bank_snapshots_account_date_unique
    UNIQUE (snapshot_date, account_label)
);

CREATE INDEX finance_bank_snapshots_date_idx
  ON public.finance_bank_snapshots (snapshot_date DESC);

CREATE TABLE public.finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.finance_entries (id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_attachments_path_check CHECK (char_length(trim(storage_path)) > 0),
  CONSTRAINT finance_attachments_name_check CHECK (char_length(trim(file_name)) > 0)
);

CREATE INDEX finance_attachments_entry_id_idx
  ON public.finance_attachments (entry_id);
CREATE INDEX finance_attachments_created_at_idx
  ON public.finance_attachments (created_at DESC);

-- Privileges: no direct client writes; SELECT for admins via RLS
REVOKE ALL ON TABLE public.finance_entries FROM anon, authenticated;
REVOKE ALL ON TABLE public.finance_bank_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE public.finance_attachments FROM anon, authenticated;

GRANT SELECT ON TABLE public.finance_entries TO authenticated;
GRANT SELECT ON TABLE public.finance_bank_snapshots TO authenticated;
GRANT SELECT ON TABLE public.finance_attachments TO authenticated;

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bank_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_entries_select_admin ON public.finance_entries
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY finance_bank_snapshots_select_admin ON public.finance_bank_snapshots
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY finance_attachments_select_admin ON public.finance_attachments
  FOR SELECT TO authenticated
  USING (private.is_admin());

-- Private storage bucket for receipts / bank statements / invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-docs',
  'finance-docs',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage access only via service role in server actions (no authenticated policies)

COMMENT ON TABLE public.finance_entries IS
  'Manual finance ledger for agency P&L; writes via service role after requireAdmin';
COMMENT ON TABLE public.finance_bank_snapshots IS
  'Manual bank balance snapshots for P&L vs bank reconciliation';
COMMENT ON TABLE public.finance_attachments IS
  'Uploaded finance documents linked optionally to an entry';
