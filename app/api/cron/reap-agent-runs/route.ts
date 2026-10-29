import { NextResponse } from "next/server";
import { authorizeCronSecret, cronSecretFromRequest } from "@/lib/agents/cron-auth";
import { reapStaleAgentRuns } from "@/lib/agents/reap-stale-runs";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Clock for the agent-run reaper. Middleware does not match /api, so this
 * route checks AGENT_REAPER_CRON_SECRET itself. Unset secret returns 503.
 */
async function handle(request: Request) {
  const auth = authorizeCronSecret(
    cronSecretFromRequest(request.headers),
    process.env.AGENT_REAPER_CRON_SECRET,
  );
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const result = await reapStaleAgentRuns(createAdminClient());
  return NextResponse.json({ ok: true, failed: result.failed });
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
