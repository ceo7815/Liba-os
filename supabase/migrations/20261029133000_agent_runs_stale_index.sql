-- Supports the stale-run reaper (status = running and started_at older than 1 hour).
-- The reaper itself lives in application code; this migration does not edit rows.

CREATE INDEX IF NOT EXISTS agent_runs_running_started_idx
  ON public.agent_runs (started_at)
  WHERE status = 'running';
