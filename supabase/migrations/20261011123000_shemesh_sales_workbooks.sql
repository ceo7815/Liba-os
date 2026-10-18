-- Last synced Shemesh sales workbook (every sheet and cell). Separate from Liba.

CREATE TABLE IF NOT EXISTS public.shemesh_sales_workbooks (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  file_name text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  last_modified text,
  sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  sheet_count integer NOT NULL DEFAULT 0,
  CONSTRAINT shemesh_sales_workbooks_sheets_array CHECK (jsonb_typeof(sheets) = 'array')
);

REVOKE ALL ON TABLE public.shemesh_sales_workbooks FROM anon, authenticated;
GRANT SELECT ON TABLE public.shemesh_sales_workbooks TO authenticated;

ALTER TABLE public.shemesh_sales_workbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shemesh_sales_workbooks_select_admin ON public.shemesh_sales_workbooks;
CREATE POLICY shemesh_sales_workbooks_select_admin
  ON public.shemesh_sales_workbooks
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.shemesh_sales_workbooks IS
  'Singleton: last synced Shemesh sales workbook. Separate from Liba sales_excel_workbooks.';
