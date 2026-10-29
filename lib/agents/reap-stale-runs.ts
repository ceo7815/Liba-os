import type { SupabaseClient } from "@supabase/supabase-js";

/** Runs left in `running` longer than this are failed by the reaper. */
export const STALE_RUN_AFTER_MS = 60 * 60 * 1000;

export const STALE_RUN_REASON = "ההרצה נתקעה יותר משעה בלי לסיים.";

const STALE_STATUSES = ["running", "claimed"] as const;

const BATCH = 400;
const MAX_BATCHES = 40;

/**
 * Marks every agent's `running` rows older than one hour as failed.
 * Called from the agent poll/heartbeat/start path and from the call-control screen,
 * so the cleanup is a job rather than a one-off database edit.
 */
export async function reapStaleAgentRuns(
  admin: SupabaseClient,
): Promise<{ failed: number }> {
  const cutoff = new Date(Date.now() - STALE_RUN_AFTER_MS).toISOString();
  const finishedAt = new Date().toISOString();
  const touchedAgents = new Set<string>();
  let failed = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const { data, error } = await admin
        .from("agent_runs")
        .select("id, agent_id")
        .in("status", [...STALE_STATUSES])
        .lt("started_at", cutoff)
        .limit(BATCH);
      if (error) {
        console.error("[agent-runs] stale reaper select failed", error.message);
        break;
      }
      const rows = data ?? [];
      if (rows.length === 0) break;

      const ids = rows.map((row) => row.id as string);
      for (const row of rows) {
        if (typeof row.agent_id === "string") touchedAgents.add(row.agent_id);
      }

      const { error: updateError } = await admin
        .from("agent_runs")
        .update({
          status: "failed",
          finished_at: finishedAt,
          error_message: STALE_RUN_REASON,
        })
        .in("id", ids)
        .in("status", [...STALE_STATUSES]);
      if (updateError) {
        console.error("[agent-runs] stale reaper update failed", updateError.message);
        break;
      }
      failed += ids.length;
      if (rows.length < BATCH) break;
    }

    for (const agentId of touchedAgents) {
      const { data: stillRunning } = await admin
        .from("agent_runs")
        .select("id")
        .eq("agent_id", agentId)
        .in("status", ["queued", "claimed", "running"])
        .limit(1);
      if (stillRunning && stillRunning.length > 0) continue;
      await admin
        .from("agents")
        .update({ last_run_status: "failed", last_run_at: finishedAt })
        .eq("id", agentId)
        .in("last_run_status", ["running", "claimed"]);
    }
  } catch (err) {
    console.error(
      "[agent-runs] stale reaper failed",
      err instanceof Error ? err.message : err,
    );
  }

  if (failed > 0) {
    console.info("[agent-runs] stale reaper", { failed });
  }
  return { failed };
}
