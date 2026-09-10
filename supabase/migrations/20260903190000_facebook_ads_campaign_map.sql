-- Facebook Ads campaign mapping + daily stats for marketing cubes.
-- Writes go through service role after requireSalesDashboardAccess.

CREATE TABLE public.facebook_ads_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ad_account_id text,
  ad_account_name text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  connected_name text,
  last_synced_at timestamptz,
  last_error text,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.facebook_ads_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.facebook_ads_campaign_map (
  facebook_campaign_id text PRIMARY KEY,
  facebook_campaign_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'UNKNOWN',
  source_name text,
  enabled boolean NOT NULL DEFAULT true,
  mapped_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  mapped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facebook_ads_campaign_map_id_check
    CHECK (char_length(trim(facebook_campaign_id)) > 0)
);

CREATE TABLE public.facebook_ads_daily_stats (
  facebook_campaign_id text NOT NULL
    REFERENCES public.facebook_ads_campaign_map (facebook_campaign_id) ON DELETE CASCADE,
  day date NOT NULL,
  cost numeric(14, 2) NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  PRIMARY KEY (facebook_campaign_id, day),
  CONSTRAINT facebook_ads_daily_stats_cost_check CHECK (cost >= 0),
  CONSTRAINT facebook_ads_daily_stats_clicks_check CHECK (clicks >= 0),
  CONSTRAINT facebook_ads_daily_stats_impressions_check CHECK (impressions >= 0)
);

CREATE INDEX facebook_ads_campaign_map_source_idx
  ON public.facebook_ads_campaign_map (source_name)
  WHERE source_name IS NOT NULL;

CREATE INDEX facebook_ads_daily_stats_day_idx
  ON public.facebook_ads_daily_stats (day DESC);

REVOKE ALL ON TABLE public.facebook_ads_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.facebook_ads_campaign_map FROM anon, authenticated;
REVOKE ALL ON TABLE public.facebook_ads_daily_stats FROM anon, authenticated;

GRANT SELECT ON TABLE public.facebook_ads_settings TO authenticated;
GRANT SELECT ON TABLE public.facebook_ads_campaign_map TO authenticated;
GRANT SELECT ON TABLE public.facebook_ads_daily_stats TO authenticated;

ALTER TABLE public.facebook_ads_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_ads_campaign_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_ads_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY facebook_ads_settings_select_admin
  ON public.facebook_ads_settings
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY facebook_ads_campaign_map_select_admin
  ON public.facebook_ads_campaign_map
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY facebook_ads_daily_stats_select_admin
  ON public.facebook_ads_daily_stats
  FOR SELECT TO authenticated
  USING (private.is_admin());

COMMENT ON TABLE public.facebook_ads_settings IS
  'Singleton Facebook Ads connection. Access token encrypted; writes via service role.';
COMMENT ON TABLE public.facebook_ads_campaign_map IS
  'Maps a Facebook Ads campaign id to an Excel referral-source cube.';
COMMENT ON TABLE public.facebook_ads_daily_stats IS
  'Cached Facebook Ads cost/clicks/impressions per campaign per day.';
