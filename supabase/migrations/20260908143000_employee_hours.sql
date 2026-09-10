-- Monthly attendance hours for salaried wage (hourly × hours, or tracking for global salary).

CREATE TABLE public.finance_employee_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.finance_employees (id) ON DELETE CASCADE,
  month text NOT NULL,
  hours numeric(8,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  file_name text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_employee_hours_month_check CHECK (month ~ '^\d{4}-\d{2}$'),
  CONSTRAINT finance_employee_hours_hours_check CHECK (hours >= 0),
  CONSTRAINT finance_employee_hours_unique UNIQUE (employee_id, month)
);

CREATE INDEX finance_employee_hours_employee_idx
  ON public.finance_employee_hours (employee_id, month DESC);

REVOKE ALL ON TABLE public.finance_employee_hours FROM anon, authenticated;
GRANT SELECT ON TABLE public.finance_employee_hours TO authenticated;

ALTER TABLE public.finance_employee_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_employee_hours_select_admin ON public.finance_employee_hours
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.finance_employee_hours IS
  'Monthly hours from the attendance Excel. Used for salaried hourly wage; global salary is still monthly.';
