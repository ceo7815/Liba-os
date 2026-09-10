import { getDemoDashboard } from "@/lib/sales-dashboard/demo";
import {
  downloadSalesExcel,
  getSalesExcelMeta,
  isGraphConfigured,
  normalizeExcelEtag,
} from "@/lib/sales-dashboard/graph";
import {
  loadIngestedWorkbook,
  loadParsedDashboardSnapshot,
  saveParsedDashboardSnapshot,
} from "@/lib/sales-dashboard/ingest-store";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import type { DashboardData } from "@/lib/sales-dashboard/types";

let cache: {
  data: DashboardData;
  etag: string | null;
} | null = null;

let inflight: Promise<DashboardData> | null = null;

function hasProductions(data: DashboardData | null | undefined): boolean {
  return Array.isArray(data?.marketing?.productions);
}

function remember(data: DashboardData, etag: string | null) {
  cache = { data, etag: normalizeExcelEtag(etag) };
  return data;
}

function sameEtag(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeExcelEtag(a);
  const right = normalizeExcelEtag(b);
  return Boolean(left && right && left === right);
}

export function replaceSalesDashboardSnapshot(data: DashboardData) {
  cache = { data, etag: null };
}

/** Persist a parsed workbook so later screens reuse it instead of re-reading Excel. */
export async function persistSalesDashboardSnapshot(
  data: DashboardData,
  extra?: { etag?: string | null; lastModified?: string | null; fileName?: string | null },
): Promise<DashboardData> {
  return persist(data, extra?.etag ?? extra?.lastModified ?? null, extra);
}

export async function getSalesDashboardSnapshot(): Promise<DashboardData> {
  if (cache?.data && hasProductions(cache.data)) {
    return cache.data;
  }

  if (inflight) return inflight;
  inflight = hydrateSnapshot().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Manual sync only — always re-downloads and re-parses, even if the etag looks unchanged. */
export async function forceRefreshSalesDashboard(): Promise<DashboardData> {
  if (inflight) {
    await inflight.catch(() => undefined);
  }
  inflight = refreshSnapshot({ force: true }).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function hydrateSnapshot(): Promise<DashboardData> {
  const stored = await loadParsedDashboardSnapshot().catch(() => null);
  if (stored?.data && hasProductions(stored.data)) {
    return remember(stored.data, stored.etag);
  }

  // Never re-parse the ingested xlsx here. Manual «סנכרן הכל» is the only
  // path that downloads / parses Excel and writes dashboard.json.
  if (cache?.data) return cache.data;
  return remember(getDemoDashboard(), null);
}

async function persist(data: DashboardData, etag: string | null, extra?: {
  lastModified?: string | null;
  fileName?: string | null;
}) {
  remember(data, etag);
  await saveParsedDashboardSnapshot({
    etag: normalizeExcelEtag(etag),
    lastModified: extra?.lastModified ?? data.syncedAt,
    fileName: extra?.fileName ?? data.fileName,
    data,
  });
  return data;
}

async function refreshFromGraph(force: boolean): Promise<DashboardData> {
  const meta = await getSalesExcelMeta();
  const etag = meta.etag;

  if (!force && etag && cache?.data && hasProductions(cache.data) && sameEtag(cache.etag, etag)) {
    return cache.data;
  }

  if (!force) {
    const stored = await loadParsedDashboardSnapshot().catch(() => null);
    if (
      stored?.data &&
      hasProductions(stored.data) &&
      etag &&
      sameEtag(stored.etag, etag)
    ) {
      return remember(stored.data, etag);
    }
  }

  const file = await downloadSalesExcel(meta);
  const data = parseSalesWorkbook(
    file.buffer,
    file.fileName,
    new Date().toISOString(),
  );
  return persist(data, file.etag ?? etag, {
    lastModified: file.lastModified,
    fileName: file.fileName,
  });
}

async function refreshSnapshot(options?: { force?: boolean }): Promise<DashboardData> {
  const force = Boolean(options?.force);
  try {
    if (isGraphConfigured()) {
      return await refreshFromGraph(force);
    }

    if (!force) {
      if (cache?.data && hasProductions(cache.data)) return cache.data;
      const stored = await loadParsedDashboardSnapshot().catch(() => null);
      if (stored?.data && hasProductions(stored.data)) {
        return remember(stored.data, stored.etag);
      }
      return remember(getDemoDashboard(), null);
    }

    const ingested = await loadIngestedWorkbook();
    if (ingested) {
      const data = parseSalesWorkbook(
        ingested.buffer,
        ingested.fileName,
        new Date().toISOString(),
      );
      return persist(data, ingested.lastModified, {
        lastModified: ingested.lastModified,
        fileName: ingested.fileName,
      });
    }

    return remember(getDemoDashboard(), null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "שגיאה בטעינת קובץ המכירות";
    if (cache?.data) {
      return { ...cache.data, error: message };
    }
    const stored = await loadParsedDashboardSnapshot().catch(() => null);
    if (stored?.data) {
      return { ...stored.data, error: message };
    }
    return { ...getDemoDashboard(), error: message };
  }
}
