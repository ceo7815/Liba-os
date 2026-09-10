ALTER TABLE public.facebook_ads_campaign_map
  ADD COLUMN IF NOT EXISTS ad_account_id text,
  ADD COLUMN IF NOT EXISTS ad_account_name text;
