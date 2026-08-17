-- Atomic claim for overlapping agent runs + seed call-control agent

CREATE OR REPLACE FUNCTION public.claim_pending_calls(p_limit int DEFAULT 10)
RETURNS SETOF public.calls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT c.id
    FROM public.calls c
    WHERE c.status = 'pending'
    ORDER BY c.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.calls c
  SET status = 'claimed'
  FROM picked
  WHERE c.id = picked.id
  RETURNING c.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_calls(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_calls(int) TO service_role;

COMMENT ON FUNCTION public.claim_pending_calls(int) IS
  'Claims pending calls atomically (FOR UPDATE SKIP LOCKED) for agent processing';

-- slug (API): call-control · hermes_profile (Hermes folder): call-qa
INSERT INTO public.agents (slug, name, description, status, hermes_profile, model)
VALUES (
  'call-control',
  'סוכן בקרת שיחות',
  'ניתוח ובקרת שיחות — סיכומים, המלצות ומדדי איכות. הסוכן רץ במערכת Hermes נפרדת; התוצרים מדווחים לליבה OS.',
  'active',
  'call-qa',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  hermes_profile = EXCLUDED.hermes_profile;
