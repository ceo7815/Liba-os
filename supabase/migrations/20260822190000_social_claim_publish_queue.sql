-- Atomically claim one due social publish-queue row for the Hermes runner.

CREATE OR REPLACE FUNCTION public.claim_social_publish_queue()
RETURNS TABLE (
  queue_id uuid,
  post_id uuid,
  scheduled_for timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.social_publish_queue q
    WHERE q.status = 'pending'
      AND q.scheduled_for <= now()
    ORDER BY q.scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.social_publish_queue q
  SET
    status = 'claimed',
    claimed_at = now()
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.id, q.post_id, q.scheduled_for;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_social_publish_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_social_publish_queue() TO service_role;

COMMENT ON FUNCTION public.claim_social_publish_queue() IS
  'social.poll_due: claim oldest pending queue row that is due (SKIP LOCKED)';
