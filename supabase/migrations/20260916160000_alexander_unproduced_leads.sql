-- Manual end-of-month Alexander leads that were received but not produced.

CREATE TABLE public.finance_alexander_unproduced_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.finance_employees (id) ON DELETE CASCADE,
  month text NOT NULL,
  leads integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_alexander_unproduced_leads_month_check CHECK (month ~ '^\d{4}-\d{2}$'),
  CONSTRAINT finance_alexander_unproduced_leads_leads_check CHECK (leads >= 0),
  CONSTRAINT finance_alexander_unproduced_leads_unique UNIQUE (employee_id, month)
);

CREATE INDEX finance_alexander_unproduced_leads_employee_idx
  ON public.finance_alexander_unproduced_leads (employee_id, month DESC);

REVOKE ALL ON TABLE public.finance_alexander_unproduced_leads FROM anon, authenticated;
GRANT SELECT ON TABLE public.finance_alexander_unproduced_leads TO authenticated;

ALTER TABLE public.finance_alexander_unproduced_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_alexander_unproduced_leads_select_admin
  ON public.finance_alexander_unproduced_leads
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.finance_alexander_unproduced_leads IS
  'Alexander leads sent to a freelancer in a wage month that were not produced. Charged at ₪60 each, on top of produced Alexander closes.';
