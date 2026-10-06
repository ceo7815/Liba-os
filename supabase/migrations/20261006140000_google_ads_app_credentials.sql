ALTER TABLE public.google_ads_settings
  ADD COLUMN IF NOT EXISTS oauth_client_id_encrypted text,
  ADD COLUMN IF NOT EXISTS oauth_client_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS developer_token_encrypted text;
