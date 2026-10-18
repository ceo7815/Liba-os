import { createAdminClient } from "@/lib/supabase/admin";
import { surenseFetch, surensePost } from "@/lib/surense/client";
import {
  classifyLead,
  classifyWorkflow,
  leadTitles,
  normalizeStatus,
  workflowTitles,
  type ControlItem,
} from "@/lib/lead-control/rules";

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

export type LeadControlSnapshot = {
  fetchedAt: string;
  configured: boolean;
  error: string | null;
  truncated: boolean;
  items: ControlItem[];
};

type SearchPage = {
  results?: Record<string, unknown>[];
  hasNextPage?: boolean;
};

function asRows(payload: unknown): SearchPage {
  if (!payload || typeof payload !== "object") return {};
  return payload as SearchPage;
}

async function searchAll(
  path: string,
  filters: { field: string; operator?: string; value: string }[],
  maxPages = MAX_PAGES,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const rows: Record<string, unknown>[] = [];
  let start = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await surensePost(path, {
      startRow: start,
      endRow: start + PAGE_SIZE,
      filtersOperator: "and",
      filters: filters.map((filter) => ({
        field: filter.field,
        operator: filter.operator ?? "equals",
        value: filter.value,
      })),
    });
    if (!response.ok) {
      throw new Error(`Surense ${path} ${response.status}`);
    }
    const payload = asRows(await response.json());
    const batch = payload.results ?? [];
    rows.push(...batch);
    if (!payload.hasNextPage || batch.length === 0) return { rows, truncated: false };
    start += PAGE_SIZE;
  }
  return { rows, truncated: true };
}

async function mapSources(): Promise<Map<string, string>> {
  const response = await surenseFetch("/customers/sources");
  if (!response.ok) return new Map();
  const payload = (await response.json()) as { id?: string; name?: string; title?: string }[];
  const map = new Map<string, string>();
  for (const source of payload) {
    if (source.id) map.set(source.id, source.name || source.title || "");
  }
  return map;
}

async function statusIds(path: string, titles: Set<string>): Promise<{ id: string; title: string }[]> {
  const response = await surenseFetch(path);
  if (!response.ok) throw new Error(`Surense ${path} ${response.status}`);
  const payload = (await response.json()) as { id?: string; title?: string }[];
  return payload
    .filter((status) => status.id && titles.has(normalizeStatus(status.title ?? "")))
    .map((status) => ({ id: status.id as string, title: normalizeStatus(status.title ?? "") }));
}

function isControlItem(value: unknown): value is ControlItem {
  if (!value || typeof value !== "object") return false;
  const item = value as ControlItem;
  return typeof item.id === "string" && (item.kind === "lead" || item.kind === "workflow");
}

export async function loadLeadControl(): Promise<LeadControlSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lead_control_snapshots")
    .select("synced_at, truncated, error, items")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    return { fetchedAt: "", configured: true, error: null, truncated: false, items: [] };
  }
  const row = data as { synced_at?: string; truncated?: boolean; error?: string | null; items?: unknown };
  const items = Array.isArray(row.items) ? row.items.filter(isControlItem) : [];
  return {
    fetchedAt: row.synced_at ?? "",
    configured: true,
    error: row.error ?? null,
    truncated: Boolean(row.truncated),
    items,
  };
}

export async function syncLeadControlSnapshot(): Promise<LeadControlSnapshot> {
  const snapshot = await pullLeadControl();
  const admin = createAdminClient();
  const { error } = await admin.from("lead_control_snapshots").upsert(
    {
      id: 1,
      synced_at: snapshot.fetchedAt,
      truncated: snapshot.truncated,
      error: snapshot.error,
      items: snapshot.items,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return snapshot;
}

async function pullLeadControl(): Promise<LeadControlSnapshot> {
  const now = Date.now();
  try {
    const wantedLeads = new Set(leadTitles());
    const wantedWorkflows = new Set(workflowTitles().map(normalizeStatus));
    const [sources, leads, workflowNames] = await Promise.all([
      mapSources(),
      statusIds("/leads/statuses", wantedLeads),
      Promise.resolve([...wantedWorkflows]),
    ]);

    const leadJobs = leads.flatMap((status) => {
      const byStatus = { field: "statusId", value: status.id };
      if (status.title !== "חדש") return [searchAll("/leads/search", [byStatus])];
      return [
        searchAll("/leads/search", [byStatus, { field: "assignedUserId", operator: "notEquals", value: "" }], 40),
        searchAll("/leads/search", [byStatus, { field: "assignedUserId", operator: "equals", value: "" }], 8),
      ];
    });
    const [leadPages, workflowPages] = await Promise.all([
      Promise.all(leadJobs),
      Promise.all(
        workflowNames.map(async (title) => {
          try {
            return await searchAll("/workflows/search", [{ field: "statusName", value: title }]);
          } catch {
            return { rows: [], truncated: false };
          }
        }),
      ),
    ]);

    const items: ControlItem[] = [];
    const seen = new Set<string>();
    let truncated = false;
    leadPages.forEach((page) => {
      truncated = truncated || page.truncated;
      for (const row of page.rows) {
        const sourceId = typeof row.sourceId === "string" ? row.sourceId : "";
        const item = classifyLead(row, sources.get(sourceId) || "", now);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    });
    workflowPages.forEach((page) => {
      truncated = truncated || page.truncated;
      for (const row of page.rows) {
        const item = classifyWorkflow(row, now);
        if (item) items.push(item);
      }
    });

    items.sort((a, b) => b.lateMs - a.lateMs || a.name.localeCompare(b.name, "he"));
    return {
      fetchedAt: new Date(now).toISOString(),
      configured: true,
      error: null,
      truncated,
      items,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Surense לא זמין";
    throw new Error(message.includes("not configured") ? "החיבור ל־Surense עדיין לא מוגדר בשרת הזה" : "לא הצלחנו למשוך את הנתונים מ־Surense");
  }
}
