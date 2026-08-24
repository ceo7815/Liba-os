import { getDemoDashboard } from "@/lib/sales-dashboard/demo";
import { downloadSalesExcel, isGraphConfigured } from "@/lib/sales-dashboard/graph";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import { assertSampleWorkbookParses } from "@/lib/sales-dashboard/sample-workbook";
import type { DashboardData } from "@/lib/sales-dashboard/types";

const TTL_MS = 30_000;

let cache: {
  data: DashboardData;
  fetchedAt: number;
  etag: string | null;
} | null = null;

let inflight: Promise<DashboardData> | null = null;

export async function getSalesDashboardSnapshot(): Promise<DashboardData> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.data;
  }
  if (inflight) return inflight;

  inflight = refreshSnapshot().finally(() => {
    inflight = null;
  });
  return inflight;
}

let selfTested = false;

async function refreshSnapshot(): Promise<DashboardData> {
  if (process.env.NODE_ENV !== "production" && !selfTested) {
    assertSampleWorkbookParses();
    selfTested = true;
  }

  if (!isGraphConfigured()) {
    const data = getDemoDashboard();
    cache = { data, fetchedAt: Date.now(), etag: null };
    return data;
  }

  try {
    const file = await downloadSalesExcel();
    const data = parseSalesWorkbook(file.buffer, file.fileName);
    cache = { data, fetchedAt: Date.now(), etag: file.etag };
    return data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "שגיאה בטעינת קובץ המכירות";
    if (cache) {
      return { ...cache.data, error: message };
    }
    return { ...getDemoDashboard(), error: message };
  }
}
