-- Shemesh operating data. Recorded source amounts only.
-- Multiplier 8 and 100% settled recognition are not calculated here.

CREATE TABLE public.shemesh_sources (
  id text PRIMARY KEY,
  label text NOT NULL,
  pulls text NOT NULL,
  connection text NOT NULL DEFAULT 'awaiting_access',
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_sources_connection_check
    CHECK (connection IN ('awaiting_access', 'credentials_present', 'connected', 'error'))
);

CREATE TABLE public.shemesh_formulas (
  id text PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending_verification',
  note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_formulas_status_check
    CHECK (status IN ('pending_verification', 'active'))
);

CREATE TABLE public.shemesh_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.shemesh_sources (id),
  external_id text NOT NULL,
  ad_platform text,
  campaign_id text,
  campaign_name text,
  status text NOT NULL,
  arrived_on date NOT NULL,
  converted_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_leads_source_external_key UNIQUE (source_id, external_id),
  CONSTRAINT shemesh_leads_status_check
    CHECK (status IN ('new', 'in_progress', 'converted', 'lost')),
  CONSTRAINT shemesh_leads_platform_check
    CHECK (ad_platform IS NULL OR ad_platform IN ('facebook', 'google', 'other'))
);

CREATE TABLE public.shemesh_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.shemesh_sources (id),
  external_id text NOT NULL,
  ad_platform text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  day date NOT NULL,
  spend numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_spend_source_external_key UNIQUE (source_id, external_id),
  CONSTRAINT shemesh_spend_platform_check
    CHECK (ad_platform IN ('facebook', 'google', 'other')),
  CONSTRAINT shemesh_spend_amount_check CHECK (spend >= 0)
);

CREATE TABLE public.shemesh_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.shemesh_sources (id),
  external_id text NOT NULL,
  kind text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  day date NOT NULL,
  ad_platform text,
  campaign_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_revenue_source_external_key UNIQUE (source_id, external_id),
  CONSTRAINT shemesh_revenue_kind_check
    CHECK (kind IN ('fee', 'insurance_sale')),
  CONSTRAINT shemesh_revenue_platform_check
    CHECK (ad_platform IS NULL OR ad_platform IN ('facebook', 'google', 'other'))
);

CREATE TABLE public.shemesh_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.shemesh_sources (id),
  external_id text NOT NULL,
  kind text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  day date NOT NULL,
  employee_name text,
  invoice_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shemesh_expenses_source_external_key UNIQUE (source_id, external_id),
  CONSTRAINT shemesh_expenses_kind_check
    CHECK (kind IN ('salary', 'operating', 'invoice')),
  CONSTRAINT shemesh_expenses_amount_check CHECK (amount >= 0)
);

CREATE INDEX shemesh_leads_arrived_on_idx ON public.shemesh_leads (arrived_on);
CREATE INDEX shemesh_spend_day_idx ON public.shemesh_spend (day);
CREATE INDEX shemesh_revenue_day_idx ON public.shemesh_revenue (day);
CREATE INDEX shemesh_expenses_day_idx ON public.shemesh_expenses (day);

COMMENT ON TABLE public.shemesh_revenue IS
  'Recorded source amounts only. Do not store multiplier-8 or settled-status recognition.';

INSERT INTO public.shemesh_sources (id, label, pulls)
VALUES
  ('insurance', 'Insurance', 'לידים ונתוני עסקאות'),
  ('facebook_ads', 'Facebook Ads', 'עלויות פרסום, קמפיינים ועלות לליד'),
  ('google_ads', 'Google Ads', 'עלויות פרסום, קמפיינים ועלות לליד'),
  ('rivhit', 'ריווחית', 'חשבוניות והוצאות'),
  ('grow', 'Grow', 'סליקה ותשלומים'),
  ('shared_folder', 'תיקייה שיתופית', 'קובצי Excel, כולל דוח שמש');

INSERT INTO public.shemesh_formulas (id, title, status, note)
VALUES
  ('multiplier_8', 'מודל מכפלה 8', 'pending_verification', 'דורש אימות מול הלקוח לפני מימוש.'),
  ('settled_100', 'סטטוס 100% נפרע', 'pending_verification', 'דורש אימות מול הלקוח לפני מימוש.');

ALTER TABLE public.shemesh_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shemesh_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_formulas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_spend FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_revenue FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shemesh_expenses FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shemesh_sources FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_formulas FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_leads FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_spend FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_revenue FROM anon, authenticated;
REVOKE ALL ON TABLE public.shemesh_expenses FROM anon, authenticated;

GRANT SELECT ON TABLE public.shemesh_sources TO authenticated;
GRANT SELECT ON TABLE public.shemesh_formulas TO authenticated;
GRANT SELECT ON TABLE public.shemesh_leads TO authenticated;
GRANT SELECT ON TABLE public.shemesh_spend TO authenticated;
GRANT SELECT ON TABLE public.shemesh_revenue TO authenticated;
GRANT SELECT ON TABLE public.shemesh_expenses TO authenticated;

CREATE POLICY shemesh_sources_admin_select
ON public.shemesh_sources
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY shemesh_formulas_admin_select
ON public.shemesh_formulas
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY shemesh_leads_admin_select
ON public.shemesh_leads
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY shemesh_spend_admin_select
ON public.shemesh_spend
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY shemesh_revenue_admin_select
ON public.shemesh_revenue
FOR SELECT
TO authenticated
USING (private.is_admin());

CREATE POLICY shemesh_expenses_admin_select
ON public.shemesh_expenses
FOR SELECT
TO authenticated
USING (private.is_admin());
