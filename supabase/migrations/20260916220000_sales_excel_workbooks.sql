-- Last synced managers Excel grid (every sheet and cell 1:1). Writes via service role on sync.

CREATE TABLE public.sales_excel_workbooks (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  file_name text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  last_modified text,
  sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  sheet_count integer NOT NULL DEFAULT 0,
  CONSTRAINT sales_excel_workbooks_sheets_array CHECK (jsonb_typeof(sheets) = 'array')
);

REVOKE ALL ON TABLE public.sales_excel_workbooks FROM anon, authenticated;
GRANT SELECT ON TABLE public.sales_excel_workbooks TO authenticated;

ALTER TABLE public.sales_excel_workbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_excel_workbooks_select_admin
  ON public.sales_excel_workbooks
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.sales_excel_workbooks IS
  'Singleton: last synced managers Excel, every sheet and cell 1:1. Writes via service role on «סנכרן הכל».';
