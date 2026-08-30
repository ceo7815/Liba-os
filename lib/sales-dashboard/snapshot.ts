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
import { assertSampleWorkbookParses } from "@/lib/sales-dashboard/sample-workbook";
import type { DashboardData } from "@/lib/sales-dashboard/types";

let cache: {
  data: DashboardData;
  etag: string | null;
} | null = null;

let inflight: Promise<DashboardData> | null = null;

export function replaceSalesDashboardSnapshot(data: DashboardData) {
  cache = { data, etag: null };
}

export async function getSalesDashboardSnapshot(): Promise<DashboardData> {
  if (inflight) return inflight;
  inflight = refreshSnapshot().finally(() => {
    inflight = null;
  });
  return inflight;
}

let selfTested = false;

function remember(data: DashboardData, etag: string | null) {
  cache = { data, etag: normalizeExcelEtag(etag) };
  return data;
}

async function refreshFromGraph(): Promise<DashboardData> {
  const meta = await getSalesExcelMeta();
  const etag = meta.etag;

  if (etag && cache?.etag === etag) {
    return cache.data;
  }

  const stored = await loadParsedDashboardSnapshot();
  if (etag && stored?.etag && stored.etag === etag) {
    return remember(stored.data, etag);
  }

  const file = await downloadSalesExcel(meta);
  const data = parseSalesWorkbook(
    file.buffer,
    file.fileName,
    file.lastModified,
  );
  remember(data, file.etag);
  void saveParsedDashboardSnapshot({
    etag: file.etag,
    lastModified: file.lastModified,
    fileName: file.fileName,
    data,
  }).catch(() => undefined);
  return data;
}

async function refreshSnapshot(): Promise<DashboardData> {
  if (process.env.NODE_ENV !== "production" && !selfTested) {
    assertSampleWorkbookParses();
    selfTested = true;
  }

  try {
    if (isGraphConfigured()) {
      return await refreshFromGraph();
    }

    const ingested = await loadIngestedWorkbook();
    if (ingested) {
      const data = parseSalesWorkbook(
        ingested.buffer,
        ingested.fileName,
        ingested.lastModified,
      );
      return remember(data, ingested.lastModified);
    }

    return remember(getDemoDashboard(), null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "שגיאה בטעינת קובץ המכירות";
    if (cache) {
      return { ...cache.data, error: message };
    }
    const stored = await loadParsedDashboardSnapshot().catch(() => null);
    if (stored?.data) {
      return { ...stored.data, error: message };
    }
    return { ...getDemoDashboard(), error: message };
  }
}
