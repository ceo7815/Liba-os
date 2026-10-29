-- Shemesh settlement drafts only. Does not alter Liba tables.
-- Apply on production only after Or approves.

CREATE TABLE IF NOT EXISTS public.shemesh_settlement_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  liba_commission numeric(14, 2),
  insurance_premium numeric(14, 2),
  redemption_collected numeric(14, 2),
  liba_rows integer NOT NULL DEFAULT 0,
  insurance_rows integer NOT NULL DEFAULT 0,
  redemption_rows integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_settlement_drafts_status_check CHECK (status IN ('draft', 'approved', 'paid')),
  CONSTRAINT shemesh_settlement_drafts_period_check CHECK (char_length(trim(period)) > 0)
);

ALTER TABLE public.shemesh_settlement_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shemesh_settlement_drafts FROM anon, authenticated;
GRANT SELECT ON TABLE public.shemesh_settlement_drafts TO authenticated;
DROP POLICY IF EXISTS shemesh_settlement_drafts_admin ON public.shemesh_settlement_drafts;
CREATE POLICY shemesh_settlement_drafts_admin
  ON public.shemesh_settlement_drafts
  FOR ALL TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE INDEX IF NOT EXISTS shemesh_settlement_drafts_status_idx
  ON public.shemesh_settlement_drafts (status, created_at DESC);
