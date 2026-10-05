CREATE TABLE public.voicenter_cdr_webhook (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token_sha256 text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.voicenter_cdr_webhook FROM anon, authenticated;
ALTER TABLE public.voicenter_cdr_webhook ENABLE ROW LEVEL SECURITY;
