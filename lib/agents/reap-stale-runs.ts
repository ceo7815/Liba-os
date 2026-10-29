import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isRunStale,
  missingHeartbeatColumn,
  STALE_RUN_AFTER_MS,
  staleHeartbeatOrFilter,
} from "@/lib/agents/run-heartbeat";

export { STALE_RUN_AFTER_MS };

export const STALE_RUN_REASON = "ההרצה נתקעה יותר משעה בלי לסיים.";

const STALE_STATUSES = ["running", "claimed"] as const;

const BATCH = 400;
const MAX_BATCHES = 40;

type Candidate = {
  id: string;
  agent_id: string | null;
  started_at: string | null;
  heartbeat_at?: string | null;
};

type SelectResult = {
  data: Candidate[] | null;
  error: { message: string } | null;
};

function selectCandidates(
  admin: SupabaseClient,
  cutoff: string,
  afterId: string | null,
  withHeartbeat: boolean,
): PromiseLike<SelectResult> {
  const columns = withHeartbeat
    ? "id, agent_id, started_at, heartbeat_at"
    : "id, agent_id, started_at";
  let query = admin
    .from("agent_runs")
    .select(columns)
    .in("status", [...STALE_STATUSES])
    .lt("started_at", cutoff)
    .order("id", { ascending: true })
    .limit(BATCH);
  if (afterId) query = query.gt("id", afterId);
  return query as PromiseLike<SelectResult>;
}

/**
 * Fails `running` and `claimed` rows whose heartbeat is older than one hour.
 * started_at alone does not make a long job stale while heartbeat_at stays fresh.
 * Until the heartbeat column exists, falls back to started_at and does not throw.
 */
export async function reapStaleAgentRuns(
  admin: SupabaseClient,
): Promise<{ failed: number }> {
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - STALE_RUN_AFTER_MS).toISOString();
  const finishedAt = new Date(nowMs).toISOString();
  const touchedAgents = new Set<string>();
  let failed = 0;
  let afterId: string | null = null;
  let withHeartbeat = true;
  let announcedMissing = false;

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      let result = await selectCandidates(admin, cutoff, afterId, withHeartbeat);
      if (result.error && withHeartbeat && missingHeartbeatColumn(result.error.message)) {
        withHeartbeat = false;
        if (!announcedMissing) {
          announcedMissing = true;
          console.error(
            "[agent-runs] heartbeat_at is missing; reaping by started_at until the heartbeat migration is applied",
          );
        }
        result = await selectCandidates(admin, cutoff, afterId, false);
      }
      if (result.error) {
        console.error("[agent-runs] stale reaper select failed", result.error.message);
        break;
      }
      const rows = result.data ?? [];
      if (rows.length === 0) break;
      afterId = String(rows[rows.length - 1]?.id ?? afterId);

      const stale = rows.filter((row) =>
        isRunStale(
          {
            heartbeatAt: withHeartbeat ? row.heartbeat_at : null,
            startedAt: row.started_at,
          },
          nowMs,
        ),
      );
      if (stale.length > 0) {
        const ids = stale.map((row) => String(row.id));
        for (const row of stale) {
          if (typeof row.agent_id === "string") touchedAgents.add(row.agent_id);
        }
        let update = admin
          .from("agent_runs")
          .update({
            status: "failed",
            finished_at: finishedAt,
            error_message: STALE_RUN_REASON,
          })
          .in("id", ids)
          .in("status", [...STALE_STATUSES]);
        if (withHeartbeat) update = update.or(staleHeartbeatOrFilter(cutoff));
        const { data: updated, error: updateError } = await update.select("id");
        if (updateError) {
          console.error("[agent-runs] stale reaper update failed", updateError.message);
          break;
        }
        failed += updated?.length ?? ids.length;
      }
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
