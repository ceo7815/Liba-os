-- Last Surense lead-control pull. The page reads this row. Writes happen only from «סנכרון מערכת».

CREATE TABLE public.lead_control_snapshots (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  synced_at timestamptz NOT NULL DEFAULT now(),
  truncated boolean NOT NULL DEFAULT false,
  error text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT lead_control_snapshots_items_array CHECK (jsonb_typeof(items) = 'array')
);

REVOKE ALL ON TABLE public.lead_control_snapshots FROM anon, authenticated;
GRANT SELECT ON TABLE public.lead_control_snapshots TO authenticated;

ALTER TABLE public.lead_control_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_control_snapshots_select_admin
  ON public.lead_control_snapshots
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.lead_control_snapshots IS
  'Singleton: last Surense lead and workflow control pull. Writes via service role on system sync.';
