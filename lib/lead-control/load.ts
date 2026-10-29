import { createAdminClient } from "@/lib/supabase/admin";
import { surenseFetch, surensePost } from "@/lib/surense/client";
import { publicErrorText } from "@/lib/sync-log";
import {
  classifyLead,
  classifyWorkflow,
  leadTitles,
  normalizeStatus,
  workflowTitles,
  type ControlItem,
} from "@/lib/lead-control/rules";

const PAGE_SIZE = 50;
/** Pages fetched for one query inside a single sync, then the cursor is saved. */
const MAX_PAGES_PER_SYNC = 80;
/** Hard stop so a stuck hasNextPage cannot walk forever across syncs. */
const ABSOLUTE_MAX_PAGES = 1000;
/** Leave room for the server action to persist before the platform cuts it off. */
const SYNC_BUDGET_MS = 22_000;

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

type SearchFilter = { field: string; operator?: string; value: string };

type SearchCursor = { start: number; done: boolean };

type StoredPaging = {
  active?: boolean;
  cursors?: Record<string, { start?: number; done?: boolean }>;
  cycleIds?: string[];
};

type StoredRow = {
  synced_at?: string;
  truncated?: boolean;
  error?: string | null;
  items?: unknown;
  paging?: unknown;
};

function asRows(payload: unknown): SearchPage {
  if (!payload || typeof payload !== "object") return {};
  return payload as SearchPage;
}

function searchKey(path: string, filters: SearchFilter[]): string {
  const body = filters
    .map((filter) => `${filter.field}:${filter.operator ?? "equals"}:${filter.value}`)
    .join("|");
  return `${path}?${body}`;
}

function asPaging(value: unknown): StoredPaging | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredPaging;
}

function cursorFrom(paging: StoredPaging | null, key: string): SearchCursor {
  const raw = paging?.cursors?.[key];
  const start = typeof raw?.start === "number" && raw.start >= 0 ? raw.start : 0;
  return { start, done: raw?.done === true };
}

async function searchAll(
  path: string,
  filters: SearchFilter[],
  cursor: SearchCursor,
  deadline: number,
): Promise<{ rows: Record<string, unknown>[]; cursor: SearchCursor; truncated: boolean }> {
  if (cursor.done) return { rows: [], cursor, truncated: false };
  const rows: Record<string, unknown>[] = [];
  let start = cursor.start;
  let pages = 0;
  while (pages < MAX_PAGES_PER_SYNC && start / PAGE_SIZE < ABSOLUTE_MAX_PAGES) {
    if (Date.now() >= deadline) {
      return { rows, cursor: { start, done: false }, truncated: true };
    }
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
      throw new Error(await surenseFailureMessage(path, response));
    }
    const payload = asRows(await response.json());
    const batch = payload.results ?? [];
    rows.push(...batch);
    pages += 1;
    if (!payload.hasNextPage || batch.length === 0) {
      return { rows, cursor: { start, done: true }, truncated: false };
    }
    start += PAGE_SIZE;
  }
  const hitAbsolute = start / PAGE_SIZE >= ABSOLUTE_MAX_PAGES;
  if (!hitAbsolute) {
    console.info("[surense-sync] paging paused", { path, nextStart: start, pages });
  }
  return {
    rows,
    cursor: { start, done: hitAbsolute },
    truncated: true,
  };
}

async function mapSources(): Promise<Map<string, string>> {
  const response = await surenseFetch("/customers/sources");
  if (!response.ok) {
    await surenseFailureMessage("/customers/sources", response);
    return new Map();
  }
  const payload = (await response.json()) as { id?: string; name?: string; title?: string }[];
  const map = new Map<string, string>();
  for (const source of payload) {
    if (source.id) map.set(source.id, source.name || source.title || "");
  }
  return map;
}

async function statusIds(path: string, titles: Set<string>): Promise<{ id: string; title: string }[]> {
  const response = await surenseFetch(path);
  if (!response.ok) throw new Error(await surenseFailureMessage(path, response));
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

function itemsFrom(value: unknown): ControlItem[] {
  return Array.isArray(value) ? value.filter(isControlItem) : [];
}

function pagingColumnMissing(message: string | undefined): boolean {
  return Boolean(message && /paging/i.test(message));
}

async function readStoredRow(): Promise<{ row: StoredRow | null; pagingSupported: boolean }> {
  const admin = createAdminClient();
  const withPaging = await admin
    .from("lead_control_snapshots")
    .select("synced_at, truncated, error, items, paging")
    .eq("id", 1)
    .maybeSingle();
  if (!withPaging.error) {
    return { row: (withPaging.data as StoredRow | null) ?? null, pagingSupported: true };
  }
  if (!pagingColumnMissing(withPaging.error.message)) {
    return { row: null, pagingSupported: true };
  }
  const fallback = await admin
    .from("lead_control_snapshots")
    .select("synced_at, truncated, error, items")
    .eq("id", 1)
    .maybeSingle();
  if (fallback.error || !fallback.data) return { row: null, pagingSupported: false };
  return { row: fallback.data as StoredRow, pagingSupported: false };
}

export async function loadLeadControl(): Promise<LeadControlSnapshot> {
  const { row } = await readStoredRow();
  if (!row) {
    return { fetchedAt: "", configured: true, error: null, truncated: false, items: [] };
  }
  return {
    fetchedAt: row.synced_at ?? "",
    configured: true,
    error: row.error ?? null,
    truncated: Boolean(row.truncated),
    items: itemsFrom(row.items),
  };
}

/** Keep the last good list, but show the failure on the lead-control screen. */
export async function recordLeadControlSyncError(message: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("lead_control_snapshots").upsert(
    { id: 1, error: message },
    { onConflict: "id" },
  );
  if (error) console.error("[surense-sync] could not store sync error", error.message);
}

export async function syncLeadControlSnapshot(): Promise<LeadControlSnapshot> {
  const stored = await readStoredRow();
  const snapshot = await pullLeadControl(stored.row);
  const admin = createAdminClient();
  const payload: Record<string, unknown> = {
    id: 1,
    synced_at: snapshot.fetchedAt,
    truncated: snapshot.truncated,
    error: snapshot.error,
    items: snapshot.items,
  };
  if (stored.pagingSupported) payload.paging = snapshot.paging;
  const { error } = await admin.from("lead_control_snapshots").upsert(payload, { onConflict: "id" });
  if (error && stored.pagingSupported && pagingColumnMissing(error.message)) {
    delete payload.paging;
    const retry = await admin.from("lead_control_snapshots").upsert(payload, { onConflict: "id" });
    if (retry.error) throw new Error(retry.error.message);
  } else if (error) {
    throw new Error(error.message);
  }
  return {
    fetchedAt: snapshot.fetchedAt,
    configured: snapshot.configured,
    error: snapshot.error,
    truncated: snapshot.truncated,
    items: snapshot.items,
  };
}

type PulledSnapshot = LeadControlSnapshot & { paging: StoredPaging };

async function pullLeadControl(stored: StoredRow | null): Promise<PulledSnapshot> {
  const now = Date.now();
  const previousItems = itemsFrom(stored?.items);
  const previousPaging = asPaging(stored?.paging);
  const continuing = previousPaging?.active === true;
  const pagingSeed = continuing ? previousPaging : null;
  const cycleIds = new Set<string>(
    continuing && Array.isArray(previousPaging?.cycleIds)
      ? previousPaging.cycleIds.filter((id) => typeof id === "string")
      : [],
  );
  const cursors: Record<string, SearchCursor> = {};
  try {
    const wantedLeads = new Set(leadTitles());
    const wantedWorkflows = new Set(workflowTitles().map(normalizeStatus));
    const [sources, leads, workflowNames] = await Promise.all([
      mapSources(),
      statusIds("/leads/statuses", wantedLeads),
      Promise.resolve([...wantedWorkflows]),
    ]);
    const deadline = Date.now() + SYNC_BUDGET_MS;

    const leadJobs = leads.flatMap((status) => {
      const byStatus = { field: "statusId", value: status.id };
      const filters: SearchFilter[][] =
        status.title === "חדש"
          ? [
              [byStatus, { field: "assignedUserId", operator: "notEquals", value: "" }],
              [byStatus, { field: "assignedUserId", operator: "equals", value: "" }],
            ]
          : [[byStatus]];
      return filters.map((filter) => ({ path: "/leads/search", filters: filter }));
    });
    const workflowJobs = workflowNames.map((title) => ({
      path: "/workflows/search",
      filters: [{ field: "statusName", value: title }] as SearchFilter[],
    }));

    const runJob = async (job: { path: string; filters: SearchFilter[] }) => {
      const key = searchKey(job.path, job.filters);
      const cursor = cursorFrom(pagingSeed, key);
      try {
        const page = await searchAll(job.path, job.filters, cursor, deadline);
        return { key, ...page, failed: false };
      } catch (error) {
        if (job.path !== "/workflows/search") throw error;
        const message = publicErrorText(
          error instanceof Error ? error.message : "workflow search failed",
        );
        console.error("[surense-sync] workflow search failed", { title: job.filters[0]?.value, message });
        return {
          key,
          rows: [] as Record<string, unknown>[],
          cursor: { start: cursor.start, done: true },
          truncated: false,
          failed: true,
        };
      }
    };

    const pages = await Promise.all([...leadJobs, ...workflowJobs].map((job) => runJob(job)));
    const itemsById = new Map<string, ControlItem>();
    for (const item of previousItems) itemsById.set(item.id, item);

    let truncated = false;
    let allDone = true;
    for (const page of pages) {
      cursors[page.key] = page.cursor;
      if (!page.cursor.done) allDone = false;
      if (page.truncated) truncated = true;
      const isLead = page.key.startsWith("/leads/search");
      for (const row of page.rows) {
        const item = isLead
          ? classifyLead(
              row,
              sources.get(typeof row.sourceId === "string" ? row.sourceId : "") || "",
              now,
            )
          : classifyWorkflow(row, now);
        if (!item) continue;
        itemsById.set(item.id, item);
        cycleIds.add(item.id);
      }
    }

    let items: ControlItem[];
    let paging: StoredPaging;
    if (allDone) {
      items = [];
      for (const id of cycleIds) {
        const item = itemsById.get(id);
        if (item) items.push(item);
      }
      paging = { active: false, cursors: {}, cycleIds: [] };
    } else {
      items = [...itemsById.values()];
      paging = {
        active: true,
        cursors,
        cycleIds: [...cycleIds],
      };
      truncated = true;
    }

    items.sort((a, b) => b.lateMs - a.lateMs || a.name.localeCompare(b.name, "he"));
    return {
      fetchedAt: new Date(now).toISOString(),
      configured: true,
      error: null,
      truncated,
      items,
      paging,
    };
  } catch (error) {
    const message = publicErrorText(error instanceof Error ? error.message : "Surense לא זמין");
    throw new Error(message);
  }
}

async function surenseFailureMessage(path: string, response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  let detail = "";
  try {
    const payload = JSON.parse(text) as {
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
    };
    const error = typeof payload.error === "string" ? payload.error : "";
    const description =
      typeof payload.error_description === "string"
        ? payload.error_description
        : typeof payload.message === "string"
          ? payload.message
          : "";
    detail = [error, description].filter(Boolean).join(": ");
  } catch {
    detail = text;
  }
  detail = publicErrorText(detail);
  console.error("[surense-sync] request failed", {
    path,
    status: response.status,
    detail: detail || null,
  });
  return detail ? `Surense ${path} ${response.status}: ${detail}` : `Surense ${path} ${response.status}`;
}
