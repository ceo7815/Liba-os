-- Per-agent commission multiplier for automatic campaign wage expenses.
-- Wage = closed (active) premium × multiplier. Default 5, as in 2,500 × 5 = 12,500.

ALTER TABLE public.marketing_settings
  ADD COLUMN IF NOT EXISTS default_agent_multiplier numeric(8, 4) NOT NULL DEFAULT 5;

UPDATE public.marketing_settings
SET default_agent_multiplier = 5
WHERE id = 1 AND default_agent_multiplier IS NULL;

CREATE TABLE IF NOT EXISTS public.marketing_agent_rates (
  agent_name text PRIMARY KEY,
  multiplier numeric(8, 4) NOT NULL DEFAULT 5,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_agent_rates_name_check
    CHECK (char_length(trim(agent_name)) > 0),
  CONSTRAINT marketing_agent_rates_multiplier_check
    CHECK (multiplier >= 0 AND multiplier <= 100)
);

REVOKE ALL ON TABLE public.marketing_agent_rates FROM anon, authenticated;
GRANT SELECT ON TABLE public.marketing_agent_rates TO authenticated;

ALTER TABLE public.marketing_agent_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_agent_rates_select_admin ON public.marketing_agent_rates;
CREATE POLICY marketing_agent_rates_select_admin
  ON public.marketing_agent_rates
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.marketing_agent_rates IS
  'Commission multiplier per Excel agent name. Wage expense = active premium × multiplier.';
COMMENT ON COLUMN public.marketing_settings.default_agent_multiplier IS
  'Fallback multiplier when an agent has no saved rate (default 5).';
