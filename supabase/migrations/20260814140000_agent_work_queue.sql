-- Work queue statuses for Hermes poll + heartbeat presence

ALTER TABLE public.agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_status_check CHECK (
    status IN (
      'queued',
      'claimed',
      'running',
      'success',
      'failed',
      'partial',
      'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS agent_runs_agent_queue_idx
  ON public.agent_runs (agent_id, started_at ASC)
  WHERE status IN ('queued', 'claimed', 'running');

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS hermes_status text,
  ADD COLUMN IF NOT EXISTS hermes_last_seen_at timestamptz;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_hermes_status_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_hermes_status_check CHECK (
    hermes_status IS NULL OR hermes_status IN ('online', 'offline')
  );

-- Atomically claim one queued run for an agent (poll_work)
CREATE OR REPLACE FUNCTION public.claim_queued_agent_run(p_agent_id uuid)
RETURNS SETOF public.agent_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT r.id
    FROM public.agent_runs r
    WHERE r.agent_id = p_agent_id
      AND r.status = 'queued'
    ORDER BY r.started_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.agent_runs r
  SET status = 'claimed'
  FROM picked
  WHERE r.id = picked.id
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_queued_agent_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queued_agent_run(uuid) TO service_role;

COMMENT ON FUNCTION public.claim_queued_agent_run(uuid) IS
  'os.poll_work: claim oldest queued agent_run → claimed (SKIP LOCKED)';
