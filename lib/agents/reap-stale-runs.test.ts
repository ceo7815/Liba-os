import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRunStale, missingHeartbeatColumn, STALE_RUN_AFTER_MS } from "./run-heartbeat";
import { reapStaleAgentRuns, STALE_RUN_REASON } from "./reap-stale-runs";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const HOUR = STALE_RUN_AFTER_MS;

test("a fresh heartbeat keeps a long run alive", () => {
  assert.equal(
    isRunStale(
      {
        startedAt: new Date(NOW - 5 * HOUR).toISOString(),
        heartbeatAt: new Date(NOW - 60_000).toISOString(),
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    isRunStale(
      {
        startedAt: new Date(NOW - HOUR).toISOString(),
        heartbeatAt: null,
      },
      NOW,
    ),
    false,
  );
  assert.equal(
    isRunStale(
      {
        startedAt: new Date(NOW - HOUR - 1).toISOString(),
        heartbeatAt: null,
      },
      NOW,
    ),
    true,
  );
  assert.equal(
    isRunStale(
      {
        startedAt: new Date(NOW - 30 * 60_000).toISOString(),
        heartbeatAt: new Date(NOW - 2 * HOUR).toISOString(),
      },
      NOW,
    ),
    true,
  );
  assert.equal(missingHeartbeatColumn("column agent_runs.heartbeat_at does not exist"), true);
  assert.equal(missingHeartbeatColumn("permission denied"), false);
});

type Row = {
  id: string;
  agent_id: string;
  status: string;
  started_at: string;
  heartbeat_at: string | null;
  error_message?: string | null;
};

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString();
}

function fakeAdmin(rows: Row[], opts?: { missingHeartbeat?: boolean }) {
  const failedIds: string[] = [];
  let heartbeatSelects = 0;

  function builder(table: string) {
    const state: {
      op: "select" | "update";
      columns: string;
      patch: Record<string, unknown> | null;
      filters: Array<{ kind: string; col: string; val?: unknown; vals?: unknown[] }>;
      orExpr: string | null;
    } = { op: "select", columns: "", patch: null, filters: [], orExpr: null };

    const api = {
      select(columns?: string) {
        state.columns = columns ?? state.columns;
        return api;
      },
      update(patch: Record<string, unknown>) {
        state.op = "update";
        state.patch = patch;
        return api;
      },
      in(col: string, vals: unknown[]) {
        state.filters.push({ kind: "in", col, vals });
        return api;
      },
      eq(col: string, val: unknown) {
        state.filters.push({ kind: "eq", col, val });
        return api;
      },
      lt(col: string, val: unknown) {
        state.filters.push({ kind: "lt", col, val });
        return api;
      },
      gt(col: string, val: unknown) {
        state.filters.push({ kind: "gt", col, val });
        return api;
      },
      or(expr: string) {
        state.orExpr = expr;
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      then(resolve: (value: unknown) => void, reject?: (err: unknown) => void) {
        try {
          resolve(execute());
        } catch (err) {
          reject?.(err);
        }
      },
    };

    function rowValue(row: Row, col: string): unknown {
      return row[col as keyof Row];
    }

    function matches(row: Row): boolean {
      for (const filter of state.filters) {
        const value = rowValue(row, filter.col);
        if (filter.kind === "in" && !filter.vals?.includes(value)) return false;
        if (filter.kind === "eq" && value !== filter.val) return false;
        if (filter.kind === "lt" && !(String(value) < String(filter.val))) return false;
        if (filter.kind === "gt" && !(String(value) > String(filter.val))) return false;
      }
      if (state.orExpr) {
        const cutoff = /heartbeat_at\.lt\."([^"]+)"/.exec(state.orExpr)?.[1] ?? "";
        const fresh = row.heartbeat_at != null && String(row.heartbeat_at) >= cutoff;
        if (fresh) return false;
      }
      return true;
    }

    function execute() {
      if (table === "agents") return { data: null, error: null };
      if (
        state.op === "select" &&
        opts?.missingHeartbeat &&
        state.columns.includes("heartbeat_at")
      ) {
        heartbeatSelects += 1;
        return {
          data: null,
          error: { message: "column agent_runs.heartbeat_at does not exist" },
        };
      }
      const matched = rows.filter(matches).sort((a, b) => a.id.localeCompare(b.id));
      if (state.op === "update" && state.patch) {
        for (const row of matched) {
          if (state.patch.status === "failed") failedIds.push(row.id);
          Object.assign(row, state.patch);
        }
        return { data: matched.map((row) => ({ id: row.id })), error: null };
      }
      return { data: matched, error: null };
    }

    return api;
  }

  return {
    admin: { from: builder } as unknown as SupabaseClient,
    failedIds,
    heartbeatSelects: () => heartbeatSelects,
  };
}

test("reaper fails only runs with no heartbeat for more than an hour", async () => {
  const originalNow = Date.now;
  Date.now = () => NOW;
  try {
    const { admin, failedIds } = fakeAdmin([
      {
        id: "00000000-0000-0000-0000-000000000001",
        agent_id: "agent-a",
        status: "running",
        started_at: hoursAgo(4),
        heartbeat_at: hoursAgo(0.01),
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        agent_id: "agent-b",
        status: "running",
        started_at: hoursAgo(3),
        heartbeat_at: hoursAgo(2),
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        agent_id: "agent-c",
        status: "claimed",
        started_at: hoursAgo(2),
        heartbeat_at: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000004",
        agent_id: "agent-d",
        status: "running",
        started_at: hoursAgo(0.2),
        heartbeat_at: null,
      },
    ]);
    const result = await reapStaleAgentRuns(admin);
    assert.equal(result.failed, 2);
    assert.deepEqual(failedIds.sort(), [
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ]);
    assert.equal(
      failedIds.includes("00000000-0000-0000-0000-000000000001"),
      false,
    );
  } finally {
    Date.now = originalNow;
  }
});

test("without the heartbeat column the reaper still uses started_at", async () => {
  const originalNow = Date.now;
  Date.now = () => NOW;
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  try {
    const { admin, failedIds, heartbeatSelects } = fakeAdmin(
      [
        {
          id: "00000000-0000-0000-0000-00000000000a",
          agent_id: "agent-a",
          status: "running",
          started_at: hoursAgo(3),
          heartbeat_at: hoursAgo(0.01),
        },
      ],
      { missingHeartbeat: true },
    );
    const result = await reapStaleAgentRuns(admin);
    assert.equal(heartbeatSelects(), 1);
    assert.equal(result.failed, 1);
    assert.deepEqual(failedIds, ["00000000-0000-0000-0000-00000000000a"]);
    assert.match(errors.join("\n"), /heartbeat migration/);
    assert.equal(STALE_RUN_REASON.includes("שעה"), true);
  } finally {
    console.error = originalError;
    Date.now = originalNow;
  }
});
