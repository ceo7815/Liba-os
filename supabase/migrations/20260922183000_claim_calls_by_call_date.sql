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
