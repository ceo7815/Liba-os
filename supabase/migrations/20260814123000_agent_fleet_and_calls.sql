-- Agent fleet + call-control domain tables (additive; does not alter profiles/auth)

-- ---------------------------------------------------------------------------
-- Core agent tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  hermes_profile text NOT NULL,
  model text,
  schedule_cron text,
  last_run_at timestamptz,
  last_run_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agents_status_check CHECK (status IN ('active', 'paused', 'error', 'archived'))
);

CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX agent_api_keys_active_hash_uidx
  ON public.agent_api_keys (key_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_type text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  last_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agent_tools_status_check CHECK (status IN ('connected', 'degraded', 'error', 'disconnected')),
  CONSTRAINT agent_tools_agent_name_uidx UNIQUE (agent_id, tool_name)
);

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  trigger text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  items_processed int NOT NULL DEFAULT 0,
  items_failed int NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  external_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agent_runs_status_check CHECK (
    status IN ('running', 'success', 'failed', 'partial', 'cancelled')
  )
);

CREATE INDEX agent_runs_agent_started_idx
  ON public.agent_runs (agent_id, started_at DESC);

CREATE TABLE public.agent_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  service text NOT NULL,
  units numeric,
  unit_type text,
  cost_usd numeric(12, 6) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_costs_agent_occurred_idx
  ON public.agent_costs (agent_id, occurred_at DESC);

CREATE INDEX agent_costs_run_idx
  ON public.agent_costs (run_id);

CREATE TABLE public.agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents (id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

CREATE INDEX agent_logs_run_created_idx
  ON public.agent_logs (run_id, created_at ASC);

-- ---------------------------------------------------------------------------
-- Call-control domain (first agent)
-- ---------------------------------------------------------------------------

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  source text NOT NULL,
  audio_path text,
  duration_sec int,
  call_date timestamptz,
  rep_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calls_status_check CHECK (
    status IN ('pending', 'claimed', 'processing', 'done', 'failed', 'skipped')
  )
);

CREATE INDEX calls_status_created_idx ON public.calls (status, created_at ASC);
CREATE INDEX calls_rep_id_idx ON public.calls (rep_id);

CREATE TABLE public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls (id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'he',
  provider text,
  full_text text,
  segments jsonb,
  cost_usd numeric(12, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX call_transcripts_call_id_idx ON public.call_transcripts (call_id);

CREATE TABLE public.call_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls (id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.agent_runs (id) ON DELETE SET NULL,
  summary text,
  overall_score numeric(5, 2),
  rubric_scores jsonb,
  findings jsonb,
  recommendations text[],
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX call_analyses_call_id_idx ON public.call_analyses (call_id);
CREATE INDEX call_analyses_run_id_idx ON public.call_analyses (run_id);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.agents FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_api_keys FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_tools FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_costs FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.calls FROM anon, authenticated;
REVOKE ALL ON TABLE public.call_transcripts FROM anon, authenticated;
REVOKE ALL ON TABLE public.call_analyses FROM anon, authenticated;

GRANT SELECT ON TABLE public.agents TO authenticated;
GRANT SELECT ON TABLE public.agent_tools TO authenticated;
GRANT SELECT ON TABLE public.agent_runs TO authenticated;
GRANT SELECT ON TABLE public.agent_costs TO authenticated;
GRANT SELECT ON TABLE public.agent_logs TO authenticated;
GRANT SELECT ON TABLE public.calls TO authenticated;
GRANT SELECT ON TABLE public.call_transcripts TO authenticated;
GRANT SELECT ON TABLE public.call_analyses TO authenticated;

-- api keys: no direct client select (admin UI will use service role / server action)

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analyses ENABLE ROW LEVEL SECURITY;

-- Ensure is_admin bypasses row security (needed under FORCE RLS patterns)
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Agent fleet: admin only
CREATE POLICY agents_admin_select ON public.agents
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY agent_tools_admin_select ON public.agent_tools
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY agent_runs_admin_select ON public.agent_runs
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY agent_costs_admin_select ON public.agent_costs
  FOR SELECT TO authenticated
  USING (private.is_admin());

CREATE POLICY agent_logs_admin_select ON public.agent_logs
  FOR SELECT TO authenticated
  USING (private.is_admin());

-- No policies on agent_api_keys for authenticated → deny by default (server/service role only)

-- Calls: admin all; employee own (rep_id)
CREATE POLICY calls_select_own_or_admin ON public.calls
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR rep_id = (SELECT auth.uid())
  );

CREATE POLICY call_transcripts_select_own_or_admin ON public.call_transcripts
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.calls c
      WHERE c.id = call_id
        AND c.rep_id = (SELECT auth.uid())
    )
  );

CREATE POLICY call_analyses_select_own_or_admin ON public.call_analyses
  FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.calls c
      WHERE c.id = call_id
        AND c.rep_id = (SELECT auth.uid())
    )
  );

COMMENT ON TABLE public.agents IS 'Registry of AI agents running on external Hermes infrastructure';
COMMENT ON TABLE public.agent_api_keys IS 'Hashed API keys for external agents; plaintext shown once at creation only';
COMMENT ON TABLE public.agent_logs IS 'Log lines reported by agents via os.log';
COMMENT ON TABLE public.calls IS 'Call-control domain: calls ingested for QA analysis';
