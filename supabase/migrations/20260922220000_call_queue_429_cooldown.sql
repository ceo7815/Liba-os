ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_calls_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calls_set_updated_at ON public.calls;
CREATE TRIGGER calls_set_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.touch_calls_updated_at();

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
        AND NOT (
          coalesce(c.metadata->>'retry_after', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND (c.metadata->>'retry_after')::timestamptz > now()
        )
        AND NOT (
          position('429' in coalesce(c.metadata->>'last_error', '')) > 0
          AND c.updated_at > now() - interval '15 minutes'
          AND coalesce(c.metadata->>'retry_after', '') = ''
        )
      ORDER BY c.call_date DESC NULLS LAST, c.created_at DESC
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

UPDATE public.agent_runs r
SET status = 'cancelled',
    finished_at = now(),
    error_message = 'stale run closed so the queue can move'
FROM public.agents a
WHERE r.agent_id = a.id
  AND a.slug = 'call-control'
  AND r.status = 'running'
  AND r.started_at < now() - interval '10 minutes';
