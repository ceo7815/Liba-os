import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingRelation } from "@/lib/shemesh/db";
import { isShemeshSourceName } from "@/lib/finance/operating-brand";
import { SHEMESH_HANDLERS } from "@/lib/shemesh/catalog";
import { normKey } from "@/lib/shemesh/gviya";

export type ShemeshSurenseRow = {
  id: string;
  name: string;
  source: string;
  assignee: string;
  status: string;
  kind: string;
};

export type ShemeshSurenseView = {
  missing: boolean;
  error: string | null;
  syncedAt: string | null;
  rows: ShemeshSurenseRow[];
};

function handlerMatches(value: string): boolean {
  const key = normKey(value);
  if (!key) return false;
  return SHEMESH_HANDLERS.some((name) => key === normKey(name) || key.includes(normKey(name)));
}

export async function loadShemeshSurenseView(): Promise<ShemeshSurenseView> {
  const empty: ShemeshSurenseView = { missing: false, error: null, syncedAt: null, rows: [] };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("lead_control_snapshots")
      .select("synced_at, items")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) {
        return { ...empty, missing: true };
      }
      return { ...empty, error: error.message };
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    const rows: ShemeshSurenseRow[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as {
        id?: unknown;
        name?: unknown;
        source?: unknown;
        assignee?: unknown;
        status?: unknown;
        kind?: unknown;
      };
      const source = typeof row.source === "string" ? row.source : "";
      const assignee = typeof row.assignee === "string" ? row.assignee : "";
      const sourceOk = isShemeshSourceName(source);
      const handlerOk = handlerMatches(assignee);
      if (source && assignee && !(sourceOk && handlerOk)) continue;
      if (!sourceOk && !handlerOk) continue;
      rows.push({
        id: typeof row.id === "string" ? row.id : `${rows.length}`,
        name: typeof row.name === "string" ? row.name : "",
        source,
        assignee,
        status: typeof row.status === "string" ? row.status : "",
        kind: row.kind === "workflow" ? "תהליך" : "ליד",
      });
    }
    return {
      missing: false,
      error: null,
      syncedAt: typeof data?.synced_at === "string" ? data.synced_at : null,
      rows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "שורנס לא נקרא";
    if (isMissingRelation(message) || /missing supabase|missing next_public/i.test(message)) return { ...empty, missing: true };
    return { ...empty, error: message };
  }
}
