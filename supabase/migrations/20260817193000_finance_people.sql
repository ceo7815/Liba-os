-- Employees and suppliers under finance (admin-only)

CREATE TABLE public.finance_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  department text,
  short_dial text,
  email text,
  direct_phone text,
  outbound_number text,
  sim_provider text,
  wait_circle text,
  dialer_type text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_employees_name_check CHECK (char_length(trim(full_name)) > 0)
);

CREATE INDEX finance_employees_name_idx ON public.finance_employees (full_name);
CREATE INDEX finance_employees_active_idx ON public.finance_employees (is_active);

CREATE TABLE public.finance_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  phone text,
  email text,
  contact_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_suppliers_name_check CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX finance_suppliers_name_idx ON public.finance_suppliers (name);
CREATE INDEX finance_suppliers_active_idx ON public.finance_suppliers (is_active);

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.finance_employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.finance_suppliers (id) ON DELETE SET NULL;

CREATE INDEX finance_entries_employee_id_idx ON public.finance_entries (employee_id);
CREATE INDEX finance_entries_supplier_id_idx ON public.finance_entries (supplier_id);

REVOKE ALL ON TABLE public.finance_employees FROM anon, authenticated;
REVOKE ALL ON TABLE public.finance_suppliers FROM anon, authenticated;
GRANT SELECT ON TABLE public.finance_employees TO authenticated;
GRANT SELECT ON TABLE public.finance_suppliers TO authenticated;

ALTER TABLE public.finance_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_employees_select_admin ON public.finance_employees
  FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY finance_suppliers_select_admin ON public.finance_suppliers
  FOR SELECT TO authenticated USING (private.is_admin());

INSERT INTO public.finance_employees
  (full_name, department, short_dial, direct_phone, outbound_number, sim_provider, wait_circle, dialer_type)
VALUES
  ('סימונה ויינר', 'מכירות', '3136', '0535272034', '0772376103', 'הוט מוביל (דרך לינק)', 'ליבה', 'חייגן מהמחשב'),
  ('ניב לב רן', 'מכירות', '3152', '0504606690', '0772376103', 'פלאפון (לא על שם העסק)', 'ליבה', 'חייגן מהמחשב'),
  ('אוריאל כהן', 'מכירות', '3146', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('שחר משה', 'מכירות', '3143', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('שי בר און', 'מכירות', '3142', NULL, '0772376102', NULL, 'שמש', 'חייגן מהמחשב'),
  ('יונתן וזוודוב', 'מכירות', '3144', NULL, '0772376102', NULL, 'שמש', 'חייגן מהמחשב'),
  ('נדב לוי', 'מכירות', '3145', NULL, '0772376102', NULL, 'שמש', 'חייגן מהמחשב'),
  ('דורון', 'מכירות', '3154', NULL, '0772376102', NULL, 'שמש', 'חייגן מהמחשב'),
  ('ניב קובי', 'מכירות', '3151', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('חן בר און', 'מכירות', '3147', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('בן ביטון', 'מכירות', '3148', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('רועי ברדוגו', 'מכירות', '3150', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('אסף בר און', 'מכירות', '3149', NULL, '0772376103', NULL, 'ליבה', 'חייגן מהמחשב'),
  ('סופיה יבדייב', 'תפעול', '3153', '0505152221', '0772376103', 'פלאפון', 'ליבה', 'חייגן מהמחשב');

COMMENT ON TABLE public.finance_employees IS 'Agency employees for payroll and finance assignment';
COMMENT ON TABLE public.finance_suppliers IS 'Vendors/suppliers for expense assignment';
