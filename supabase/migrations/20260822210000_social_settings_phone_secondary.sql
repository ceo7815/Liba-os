-- Second public phone for captions (Liba often lists two numbers)

ALTER TABLE public.social_settings
  ADD COLUMN IF NOT EXISTS phone_secondary text;
