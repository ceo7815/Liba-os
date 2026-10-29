-- Heartbeat for the stale-run reaper.
-- A running/claimed row is stale only when heartbeat_at (or started_at, if it
-- never heartbeated) is older than one hour. This file does not update existing rows.
-- Apply separately. The app ignores a missing heartbeat_at column until then
-- and keeps reaping by started_at.

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

COMMENT ON COLUMN public.agent_runs.heartbeat_at IS
  'Last proof the run was still working. The reaper uses this instead of started_at alone.';

CREATE INDEX IF NOT EXISTS agent_runs_open_heartbeat_idx
  ON public.agent_runs (heartbeat_at)
  WHERE status IN ('running', 'claimed');

-- Claiming work is itself a heartbeat, so a run that sat in the queue is not
-- failed the moment it is claimed.
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
  SET status = 'claimed',
      heartbeat_at = now()
  FROM picked
  WHERE r.id = picked.id
  RETURNING r.*;
END;
$$;
