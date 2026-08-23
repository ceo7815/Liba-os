-- Social media agent: calendar posts, assets, inbox, settings, publish queue (Liba OS source of truth)

-- ---------------------------------------------------------------------------
-- Settings (singleton row per deployment)
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  tone_guidelines text NOT NULL DEFAULT '',
  forbidden_phrases text[] NOT NULL DEFAULT '{}',
  default_publish_time time NOT NULL DEFAULT '10:00',
  platforms text[] NOT NULL DEFAULT ARRAY['facebook_page', 'instagram'],
  phone text,
  phone_secondary text,
  email text,
  address text,
  license_number text,
  ctas jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.social_settings (brand, tone_guidelines, forbidden_phrases, phone, email, ctas)
VALUES (
  '{"name":"ליבה ביטוח ופיננסים","altName":"ליבה ביטוח ופנסיוני","primaryColor":"#C41E3A","secondaryColor":"#1B2A4A","logoPath":"/brand/liba-logo.png","website":"https://liba-fs.co.il","visualLanguage":"שפת עיצוב ליבה (אתר liba-fs.co.il) — לא הלוגו. צילום אור יום, קרם, אנושי; נייבי + אדום-קורל לנקודה. לא AI פיננסים חשוך. לא צהוב Liba OS."}'::jsonb,
  'בדיקה לפני מוצר. שקיפות. שפה פשוטה. לא דוחפים פוליסה. קודם להבין → אחר כך להמליץ.',
  ARRAY[
    'הכי זול',
    'מכוסה במאה אחוז',
    'מאושר לכולם',
    'ייעוץ אישי',
    'הבטחה מוחלטת',
    'ללא סיכון'
  ],
  NULL,
  NULL,
  '[{"label":"שיחת היכרות","url":"https://liba-fs.co.il/contact"},{"label":"סורק הביטוח האישי","url":"https://liba-fs.co.il/tools/insurance-scan"}]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  caption text NOT NULL DEFAULT '',
  caption_locked boolean NOT NULL DEFAULT false,
  media_mode text NOT NULL DEFAULT 'none',
  platforms text[] NOT NULL DEFAULT ARRAY['facebook_page', 'instagram'],
  formats text[] NOT NULL DEFAULT ARRAY['feed'],
  include_image_text boolean NOT NULL DEFAULT false,
  holiday_key text,
  ai_suggestion text,
  user_notes text,
  image_prompt text,
  image_revision_notes text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  published_at timestamptz,
  meta_ids jsonb,
  analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_status_check CHECK (
    status IN (
      'draft',
      'pending_review',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'skipped'
    )
  ),
  CONSTRAINT social_posts_media_mode_check CHECK (
    media_mode IN ('none', 'user_upload', 'ai_generated')
  )
);

CREATE INDEX social_posts_scheduled_at_idx ON public.social_posts (scheduled_at);
CREATE INDEX social_posts_status_idx ON public.social_posts (status);
CREATE INDEX social_posts_scheduled_status_idx
  ON public.social_posts (status, scheduled_at);

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  kind text NOT NULL,
  mime_type text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  width integer,
  height integer,
  source text NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_assets_kind_check CHECK (
    kind IN ('feed', 'story', 'feed_tall', 'original', 'reference')
  ),
  CONSTRAINT social_assets_source_check CHECK (source IN ('upload', 'ai')),
  CONSTRAINT social_assets_path_check CHECK (char_length(trim(storage_path)) > 0)
);

CREATE INDEX social_assets_post_id_idx ON public.social_assets (post_id);

-- ---------------------------------------------------------------------------
-- Publish queue (for external runner — no Meta calls from OS)
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_publish_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  agent_run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_publish_queue_status_check CHECK (
    status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX social_publish_queue_poll_idx
  ON public.social_publish_queue (status, scheduled_for)
  WHERE status = 'pending';

CREATE UNIQUE INDEX social_publish_queue_active_post_uidx
  ON public.social_publish_queue (post_id)
  WHERE status IN ('pending', 'claimed');

-- ---------------------------------------------------------------------------
-- Inbox (read-only display until runner connects)
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  external_id text NOT NULL,
  post_id uuid REFERENCES public.social_posts (id) ON DELETE SET NULL,
  author_name text,
  author_handle text,
  body text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT social_inbox_platform_check CHECK (
    platform IN ('facebook_page', 'instagram')
  ),
  CONSTRAINT social_inbox_status_check CHECK (
    status IN ('new', 'read', 'handled')
  ),
  CONSTRAINT social_inbox_external_unique UNIQUE (platform, external_id)
);

CREATE INDEX social_inbox_received_idx ON public.social_inbox (received_at DESC);
CREATE INDEX social_inbox_status_idx ON public.social_inbox (status);

-- ---------------------------------------------------------------------------
-- Analytics schema (per published post; populated by Meta later)
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_post_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts (id) ON DELETE CASCADE,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  shares bigint NOT NULL DEFAULT 0,
  link_clicks bigint NOT NULL DEFAULT 0,
  story_views bigint NOT NULL DEFAULT 0,
  new_followers bigint NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_post_analytics_post_unique UNIQUE (post_id)
);

-- ---------------------------------------------------------------------------
-- Learn stats (aggregates after real analytics exist)
-- ---------------------------------------------------------------------------

CREATE TABLE public.social_learn_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key text NOT NULL,
  format text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  avg_engagement numeric(12, 4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_learn_stats_topic_format_unique UNIQUE (topic_key, format)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.social_posts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_posts_updated_at_trg
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.social_posts_set_updated_at();

CREATE OR REPLACE FUNCTION public.social_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_settings_updated_at_trg
  BEFORE UPDATE ON public.social_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.social_settings_set_updated_at();

-- Prevent silent edits to approved posts (must revert to draft first)
CREATE OR REPLACE FUNCTION public.social_posts_guard_approved()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('scheduled', 'publishing', 'published') AND NEW.status = OLD.status THEN
    IF NEW.caption IS DISTINCT FROM OLD.caption
      OR NEW.formats IS DISTINCT FROM OLD.formats
      OR NEW.platforms IS DISTINCT FROM OLD.platforms
      OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
      OR NEW.media_mode IS DISTINCT FROM OLD.media_mode
    THEN
      RAISE EXCEPTION 'Cannot edit approved post without reverting to draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_posts_guard_approved_trg
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.social_posts_guard_approved();

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants + RLS (authenticated staff — same visibility model as vault)
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.social_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_posts FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_assets FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_publish_queue FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_inbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_post_analytics FROM anon, authenticated;
REVOKE ALL ON TABLE public.social_learn_stats FROM anon, authenticated;

GRANT SELECT ON TABLE public.social_settings TO authenticated;
GRANT SELECT ON TABLE public.social_posts TO authenticated;
GRANT SELECT ON TABLE public.social_assets TO authenticated;
GRANT SELECT ON TABLE public.social_publish_queue TO authenticated;
GRANT SELECT ON TABLE public.social_inbox TO authenticated;
GRANT SELECT ON TABLE public.social_post_analytics TO authenticated;
GRANT SELECT ON TABLE public.social_learn_stats TO authenticated;

ALTER TABLE public.social_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_learn_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_settings_select_authenticated ON public.social_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_posts_select_authenticated ON public.social_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_assets_select_authenticated ON public.social_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_publish_queue_select_authenticated ON public.social_publish_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_inbox_select_authenticated ON public.social_inbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_post_analytics_select_authenticated ON public.social_post_analytics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

CREATE POLICY social_learn_stats_select_authenticated ON public.social_learn_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active = true
    )
  );

-- Seed social-media agent (does not touch call-control)
INSERT INTO public.agents (slug, name, description, status, hermes_profile, model)
VALUES (
  'social-media',
  'סוכן רשתות חברתיות',
  'יומן תוכן, תזמון ופרסום לפייסבוק ואינסטגרם. Liba OS הוא מקור האמת; הפרסום בפועל דרך ראנר חיצוני.',
  'active',
  'social-media',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  hermes_profile = EXCLUDED.hermes_profile;

COMMENT ON TABLE public.social_posts IS 'Scheduled social content calendar — approval required before publish queue';
COMMENT ON TABLE public.social_publish_queue IS 'Work queue for external Meta runner; poll scheduled posts when due';
COMMENT ON TABLE public.social_inbox IS 'Inbound comments/messages display only until runner connects';
