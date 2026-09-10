-- Recurring business overheads (rent, utilities, software) + link to ledger payments

CREATE TABLE public.finance_fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  vendor_name text,
  default_amount numeric(14, 2),
  due_day smallint,
  notes text,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_fixed_costs_title_check CHECK (char_length(trim(title)) > 0),
  CONSTRAINT finance_fixed_costs_category_check CHECK (char_length(trim(category)) > 0),
  CONSTRAINT finance_fixed_costs_amount_check CHECK (
    default_amount IS NULL OR default_amount >= 0
  ),
  CONSTRAINT finance_fixed_costs_due_day_check CHECK (
    due_day IS NULL OR (due_day >= 1 AND due_day <= 28)
  )
);

CREATE INDEX finance_fixed_costs_active_idx ON public.finance_fixed_costs (is_active);
CREATE INDEX finance_fixed_costs_category_idx ON public.finance_fixed_costs (category);
CREATE INDEX finance_fixed_costs_sort_idx ON public.finance_fixed_costs (sort_order, title);

CREATE OR REPLACE FUNCTION public.finance_fixed_costs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_fixed_costs_updated_at_trg
  BEFORE UPDATE ON public.finance_fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.finance_fixed_costs_set_updated_at();

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS fixed_cost_id uuid
    REFERENCES public.finance_fixed_costs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS finance_entries_fixed_cost_id_idx
  ON public.finance_entries (fixed_cost_id);

REVOKE ALL ON TABLE public.finance_fixed_costs FROM anon, authenticated;
GRANT SELECT ON TABLE public.finance_fixed_costs TO authenticated;

ALTER TABLE public.finance_fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_fixed_costs_select_admin ON public.finance_fixed_costs
  FOR SELECT TO authenticated
  USING (private.is_admin());

INSERT INTO public.finance_fixed_costs (title, category, sort_order) VALUES
  ('שכירות', 'rent', 10),
  ('ארנונה', 'arnona', 20),
  ('חשמל', 'electricity', 30),
  ('מים', 'water', 40),
  ('ניקיון', 'cleaning', 50),
  ('אינטרנט', 'internet', 60),
  ('טלפוניה', 'telephony', 70),
  ('CRM / תוכנה', 'crm_software', 80),
  ('אחסון ענן', 'cloud_hosting', 90),
  ('ליסינג', 'leasing', 100),
  ('רו״ח / הנהלת חשבונות', 'accountant', 110),
  ('אגרות ורישיונות', 'licenses', 120),
  ('ביטוח אחריות מקצועית', 'professional_insurance', 130);

COMMENT ON TABLE public.finance_fixed_costs IS
  'Catalog of recurring overheads; payments are finance_entries.fixed_cost_id';
