import type { DashboardData } from "@/lib/sales-dashboard/types";

export const SOURCE_PNL_SNAPSHOT_KEY = "liba-source-pnl-snapshot";
export const LIVE_DASHBOARD_CACHE_KEY = "liba-sales-dashboard-live";
export const LIVE_DASHBOARD_EVENT = "liba-live-dashboard";
/** Carries the fresh DashboardData so UI can update even if storage quota blocks writes. */
export const LIVE_DASHBOARD_DATA_EVENT = "liba-live-dashboard-data";

const IDB_NAME = "liba-os";
const IDB_STORE = "snapshots";
const IDB_KEY = "live-dashboard";

let memory: DashboardData | null = null;
let networkInflight: Promise<DashboardData | null> | null = null;

function isLiveDashboard(value: unknown): value is DashboardData {
  if (!value || typeof value !== "object") return false;
  const data = value as DashboardData;
  return data.source === "live" && Array.isArray(data.marketing?.productions);
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, raw: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, raw);
    sessionStorage.setItem(key, raw);
    return true;
  } catch {
    try {
      // Quota / private mode: drop stale copies so an old Sept snapshot
      // cannot win over IndexedDB / memory after the next reload.
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      sessionStorage.setItem(key, raw);
      return true;
    } catch {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return false;
    }
  }
}

function notifyLiveDashboard() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LIVE_DASHBOARD_EVENT));
}

function openSnapshotDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIndexedDbDashboard(): Promise<DashboardData | null> {
  const db = await openSnapshotDb();
  if (!db) return null;
  try {
    const value = await new Promise<unknown>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
    return isLiveDashboard(value) ? value : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

async function writeIndexedDbDashboard(data: DashboardData): Promise<void> {
  const db = await openSnapshotDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* private mode / quota */
  } finally {
    db.close();
  }
}

function syncedAtMs(data: DashboardData | null | undefined): number {
  if (!data?.syncedAt) return 0;
  const t = Date.parse(data.syncedAt);
  return Number.isFinite(t) ? t : 0;
}

function productionCount(data: DashboardData | null | undefined): number {
  return data?.marketing?.productions?.length ?? 0;
}

function pickNewest(
  ...candidates: Array<DashboardData | null | undefined>
): DashboardData | null {
  let best: DashboardData | null = null;
  for (const candidate of candidates) {
    if (!isLiveDashboard(candidate)) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    const t = syncedAtMs(candidate);
    const bt = syncedAtMs(best);
    const pc = productionCount(candidate);
    const pb = productionCount(best);
    if (pc === 0 && pb > 0) continue;
    // A newer slim/corrupt snapshot must not replace a full workbook.
    if (t > bt) {
      if (pb > 50 && pc < Math.max(50, Math.floor(pb * 0.5))) continue;
      best = candidate;
    } else if (t === bt && pc > pb) {
      best = candidate;
    } else if (t < bt && pc > pb * 1.5) {
      best = candidate;
    }
  }
  return best;
}

function parseStoredDashboard(raw: string | null): DashboardData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { data?: unknown };
    const data = isLiveDashboard(parsed?.data)
      ? parsed.data
      : isLiveDashboard(parsed)
        ? parsed
        : null;
    if (!data) return null;
    // Slim Source P&L cache stores productions: [] to save quota — never treat that as Excel.
    if (productionCount(data) === 0) return null;
    return data;
  } catch {
    /* bad JSON */
  }
  return null;
}

function readStoredLiveDashboard(): DashboardData | null {
  return pickNewest(
    parseStoredDashboard(readStorage(LIVE_DASHBOARD_CACHE_KEY)),
    parseStoredDashboard(readStorage(SOURCE_PNL_SNAPSHOT_KEY)),
  );
}

function persistLiveDashboard(data: DashboardData) {
  const raw = JSON.stringify(data);
  writeStorage(LIVE_DASHBOARD_CACHE_KEY, raw);
  // Always mirror to IndexedDB — large workbooks often exceed localStorage quota.
  void writeIndexedDbDashboard(data);
  // Do not rewrite SOURCE_PNL here: embedding the workbook blows the quota and
  // used to wipe wages + ads. The P&L screen overlays live Excel on read.
}

/** Last live Excel snapshot saved after «סנכרן הכל» — never a fresh workbook parse. */
export function readCachedLiveDashboard(): DashboardData | null {
  const stored = readStoredLiveDashboard();
  const best = pickNewest(memory, stored);
  if (best) {
    memory = best;
    return best;
  }
  return null;
}

/** Keep the last synced workbook in memory until the next «סנכרן הכל». */
export function publishLiveDashboard(data: DashboardData | null | undefined) {
  if (!isLiveDashboard(data)) return;
  memory = data;
  persistLiveDashboard(data);
  notifyLiveDashboard();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LIVE_DASHBOARD_DATA_EVENT, { detail: data }),
    );
  }
}

export function subscribeLiveDashboard(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => onChange();
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === SOURCE_PNL_SNAPSHOT_KEY ||
      event.key === LIVE_DASHBOARD_CACHE_KEY
    ) {
      memory = null;
      handler();
    }
  };
  const onData = (event: Event) => {
    const detail = (event as CustomEvent<DashboardData>).detail;
    if (isLiveDashboard(detail)) {
      memory = detail;
    }
    handler();
  };
  window.addEventListener(LIVE_DASHBOARD_EVENT, handler);
  window.addEventListener(LIVE_DASHBOARD_DATA_EVENT, onData as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LIVE_DASHBOARD_EVENT, handler);
    window.removeEventListener(LIVE_DASHBOARD_DATA_EVENT, onData as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Load the last system sync from the server. Browser cache is only a
 * first paint — dashboard.json on the server is the source of truth.
 */
export async function loadLiveDashboardUntilSync(): Promise<DashboardData | null> {
  if (networkInflight) return networkInflight;

  networkInflight = (async () => {
    const fromIdb = await readIndexedDbDashboard();
    const local = pickNewest(readCachedLiveDashboard(), fromIdb);
    if (fromIdb && syncedAtMs(fromIdb) > syncedAtMs(memory)) {
      memory = fromIdb;
      notifyLiveDashboard();
    }

    try {
      const res = await fetch(`/api/sales-dashboard?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return local;
      const data = (await res.json()) as DashboardData;
      if (!isLiveDashboard(data)) return local;
      publishLiveDashboard(data);
      return data;
    } catch {
      return local;
    }
  })().finally(() => {
    networkInflight = null;
  });

  return networkInflight;
}
