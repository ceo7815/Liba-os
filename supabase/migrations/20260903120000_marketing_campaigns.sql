-- Campaign P&L for the marketing dashboard (admin-only).
-- Writes go through service role after requireSalesDashboardAccess.

CREATE TABLE public.marketing_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  profit_threshold numeric(6, 4) NOT NULL DEFAULT 0.45,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_settings (id, profit_threshold)
VALUES (1, 0.45)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.marketing_campaigns (
  source_name text PRIMARY KEY,
  included boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaigns_source_name_check
    CHECK (char_length(trim(source_name)) > 0)
);

CREATE TABLE public.marketing_campaign_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  channel text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  occurred_at date NOT NULL,
  note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaign_expenses_channel_check
    CHECK (channel IN ('google', 'facebook', 'manual')),
  CONSTRAINT marketing_campaign_expenses_amount_check CHECK (amount > 0),
  CONSTRAINT marketing_campaign_expenses_source_check
    CHECK (char_length(trim(source_name)) > 0)
);

CREATE INDEX marketing_campaign_expenses_source_idx
  ON public.marketing_campaign_expenses (source_name, occurred_at DESC);

REVOKE ALL ON TABLE public.marketing_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_campaigns FROM anon, authenticated;
REVOKE ALL ON TABLE public.marketing_campaign_expenses FROM anon, authenticated;

GRANT SELECT ON TABLE public.marketing_settings TO authenticated;
GRANT SELECT ON TABLE public.marketing_campaigns TO authenticated;
GRANT SELECT ON TABLE public.marketing_campaign_expenses TO authenticated;

ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_settings_select_admin
  ON public.marketing_settings
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY marketing_campaigns_select_admin
  ON public.marketing_campaigns
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY marketing_campaign_expenses_select_admin
  ON public.marketing_campaign_expenses
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.marketing_settings IS
  'Singleton: campaign profit threshold (default 45%). Writes via service role.';
COMMENT ON TABLE public.marketing_campaigns IS
  'Which Excel referral sources appear as campaigns. Writes via service role.';
COMMENT ON TABLE public.marketing_campaign_expenses IS
  'Manual / Ads campaign costs. Google and Facebook APIs will fill the same channels later.';
