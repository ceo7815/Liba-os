-- Optional queue trigger so the external runner can log immediate vs scheduled publishes.

ALTER TABLE public.social_publish_queue
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.social_publish_queue
  DROP CONSTRAINT IF EXISTS social_publish_queue_trigger_check;

ALTER TABLE public.social_publish_queue
  ADD CONSTRAINT social_publish_queue_trigger_check
  CHECK (trigger IN ('scheduled', 'immediate'));

COMMENT ON COLUMN public.social_publish_queue.trigger IS
  'How the post entered the queue: scheduled (calendar) or immediate (publish-now button)';

DROP FUNCTION IF EXISTS public.claim_social_publish_queue();

CREATE FUNCTION public.claim_social_publish_queue()
RETURNS TABLE (
  queue_id uuid,
  post_id uuid,
  scheduled_for timestamptz,
  trigger text
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
  RETURNING q.id, q.post_id, q.scheduled_for, q.trigger;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_social_publish_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_social_publish_queue() TO service_role;

COMMENT ON FUNCTION public.claim_social_publish_queue() IS
  'social.poll_due: claim oldest pending queue row that is due (SKIP LOCKED)';
