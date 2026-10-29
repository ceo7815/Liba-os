import type { SupabaseClient } from "@supabase/supabase-js";

/** Open runs with no heartbeat for longer than this are failed by the reaper. */
export const STALE_RUN_AFTER_MS = 60 * 60 * 1000;

const OPEN_STATUSES = ["running", "claimed"] as const;

/** True when Postgres/PostgREST does not know heartbeat_at yet. */
export function missingHeartbeatColumn(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    /heartbeat_at/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}

/**
 * A run is stale only when its last heartbeat is older than an hour.
 * Runs that have never heartbeated fall back to started_at.
 * Exactly one hour is still alive (`>` not `>=`).
 */
export function isRunStale(
  row: { heartbeatAt?: string | null; startedAt?: string | null },
  nowMs: number,
  staleAfterMs = STALE_RUN_AFTER_MS,
): boolean {
  const stamp = (row.heartbeatAt ?? "").trim() || (row.startedAt ?? "").trim();
  const at = Date.parse(stamp);
  if (!Number.isFinite(at)) return false;
  return nowMs - at > staleAfterMs;
}

/** PostgREST `or` filter: fail only rows that still have no fresh heartbeat. */
export function staleHeartbeatOrFilter(cutoffIso: string): string {
  return `heartbeat_at.lt."${cutoffIso}",heartbeat_at.is.null`;
}

async function writeHeartbeat(
  admin: SupabaseClient,
  apply: (now: string) => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  try {
    const { error } = await apply(new Date().toISOString());
    if (error && !missingHeartbeatColumn(error.message)) {
      console.error("[agent-runs] heartbeat update failed", error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!missingHeartbeatColumn(message)) {
      console.error("[agent-runs] heartbeat update failed", message);
    }
  }
}

/** Touch one open run. Missing column is ignored so daily work keeps going before the migration. */
export async function touchRunHeartbeat(
  admin: SupabaseClient,
  runId: string,
): Promise<void> {
  await writeHeartbeat(admin, (now) =>
    admin
      .from("agent_runs")
      .update({ heartbeat_at: now })
      .eq("id", runId)
      .in("status", [...OPEN_STATUSES]),
  );
}

/** Touch every open run for an agent. Used by os.heartbeat while a long job is still working. */
export async function touchOpenRunHeartbeats(
  admin: SupabaseClient,
  agentId: string,
): Promise<void> {
  await writeHeartbeat(admin, (now) =>
    admin
      .from("agent_runs")
      .update({ heartbeat_at: now })
      .eq("agent_id", agentId)
      .in("status", [...OPEN_STATUSES]),
  );
}
