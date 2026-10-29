-- Safe metadata for every CDR POST. The webhook token and body are not stored.

ALTER TABLE public.voicenter_cdr_receipts
  ADD COLUMN IF NOT EXISTS token_hash_prefix text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS body_bytes integer;

COMMENT ON COLUMN public.voicenter_cdr_receipts.token_hash_prefix IS
  'First 8 hex characters of sha256(path token). Not the token.';
COMMENT ON COLUMN public.voicenter_cdr_receipts.content_type IS
  'Request Content-Type media type only.';
COMMENT ON COLUMN public.voicenter_cdr_receipts.body_bytes IS
  'Raw request body size in bytes.';
