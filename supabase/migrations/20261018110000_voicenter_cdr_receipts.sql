CREATE TABLE public.voicenter_cdr_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  call_id text,
  sofia boolean NOT NULL DEFAULT false,
  stored boolean NOT NULL DEFAULT false,
  has_transcript boolean NOT NULL DEFAULT false,
  outcome text NOT NULL
);

REVOKE ALL ON TABLE public.voicenter_cdr_receipts FROM anon, authenticated;
ALTER TABLE public.voicenter_cdr_receipts ENABLE ROW LEVEL SECURITY;
