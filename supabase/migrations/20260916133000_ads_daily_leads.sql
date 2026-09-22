-- Lead counts for freelancer lead-cost settlement (50% of CPL per produced sale).

ALTER TABLE public.google_ads_daily_stats
  ADD COLUMN IF NOT EXISTS leads integer NOT NULL DEFAULT 0;

ALTER TABLE public.facebook_ads_daily_stats
  ADD COLUMN IF NOT EXISTS leads integer NOT NULL DEFAULT 0;

ALTER TABLE public.google_ads_daily_stats
  DROP CONSTRAINT IF EXISTS google_ads_daily_stats_leads_check;
ALTER TABLE public.google_ads_daily_stats
  ADD CONSTRAINT google_ads_daily_stats_leads_check CHECK (leads >= 0);

ALTER TABLE public.facebook_ads_daily_stats
  DROP CONSTRAINT IF EXISTS facebook_ads_daily_stats_leads_check;
ALTER TABLE public.facebook_ads_daily_stats
  ADD CONSTRAINT facebook_ads_daily_stats_leads_check CHECK (leads >= 0);

COMMENT ON COLUMN public.google_ads_daily_stats.leads IS
  'Inbound phone calls from Google Ads (metrics.phone_calls).';
COMMENT ON COLUMN public.facebook_ads_daily_stats.leads IS
  'Website form leads from Facebook Ads actions (pixel lead / complete registration).';
