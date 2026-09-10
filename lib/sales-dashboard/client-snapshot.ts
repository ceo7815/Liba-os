import type { DashboardData } from "@/lib/sales-dashboard/types";

export const SOURCE_PNL_SNAPSHOT_KEY = "liba-source-pnl-snapshot";
export const LIVE_DASHBOARD_CACHE_KEY = "liba-sales-dashboard-live";
export const LIVE_DASHBOARD_EVENT = "liba-live-dashboard";

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
      sessionStorage.setItem(key, raw);
      return true;
    } catch {
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

function readStoredLiveDashboard(): DashboardData | null {
  try {
    const raw = readStorage(SOURCE_PNL_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { data?: unknown };
      if (isLiveDashboard(parsed?.data)) return parsed.data;
      if (isLiveDashboard(parsed)) return parsed;
    }
    const legacy = readStorage(LIVE_DASHBOARD_CACHE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      if (isLiveDashboard(parsed)) return parsed;
    }
  } catch {
    /* quota / private mode / bad JSON */
  }
  return null;
}

function persistLiveDashboard(data: DashboardData) {
  const raw = JSON.stringify(data);
  if (!writeStorage(LIVE_DASHBOARD_CACHE_KEY, raw)) {
    void writeIndexedDbDashboard(data);
  }
  try {
    const snapshotRaw = readStorage(SOURCE_PNL_SNAPSHOT_KEY);
    if (!snapshotRaw) return;
    const parsed = JSON.parse(snapshotRaw) as { data?: unknown; savedAt?: string };
    if (!parsed || typeof parsed !== "object") return;
    parsed.data = data;
    parsed.savedAt = data.syncedAt ?? parsed.savedAt;
    writeStorage(SOURCE_PNL_SNAPSHOT_KEY, JSON.stringify(parsed));
  } catch {
    /* nested snapshot may exceed quota; memory + live key still hold Excel */
  }
}

/** Last live Excel snapshot saved after «סנכרן הכל» — never a fresh workbook parse. */
export function readCachedLiveDashboard(): DashboardData | null {
  if (memory && isLiveDashboard(memory)) return memory;
  const stored = readStoredLiveDashboard();
  if (stored) {
    memory = stored;
    return stored;
  }
  return null;
}

/** Keep the last synced workbook in memory until the next «סנכרן הכל». */
export function publishLiveDashboard(data: DashboardData | null | undefined) {
  if (!isLiveDashboard(data)) return;
  memory = data;
  persistLiveDashboard(data);
  notifyLiveDashboard();
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
  window.addEventListener(LIVE_DASHBOARD_EVENT, handler);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LIVE_DASHBOARD_EVENT, handler);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * One network read of the already-parsed snapshot. Skips if this browser
 * already has a live workbook from the last sync.
 */
export async function loadLiveDashboardUntilSync(): Promise<DashboardData | null> {
  const cached = readCachedLiveDashboard();
  if (cached) return cached;
  if (networkInflight) return networkInflight;

  networkInflight = (async () => {
    const fromIdb = await readIndexedDbDashboard();
    if (fromIdb) {
      memory = fromIdb;
      notifyLiveDashboard();
      return fromIdb;
    }

    const res = await fetch("/api/sales-dashboard", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as DashboardData;
    if (!isLiveDashboard(data)) return null;
    publishLiveDashboard(data);
    return data;
  })().finally(() => {
    networkInflight = null;
  });

  return networkInflight;
}
