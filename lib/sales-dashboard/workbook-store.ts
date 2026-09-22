import { createAdminClient } from "@/lib/supabase/admin";
import { loadIngestedWorkbook } from "@/lib/sales-dashboard/ingest-store";
import { parseSalesWorkbookGridFromBytes } from "@/lib/sales-dashboard/workbook-parse";
import {
  EMPTY_SALES_WORKBOOK,
  type SalesWorkbook,
  type SalesWorkbookPayload,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";
import type { DashboardData } from "@/lib/sales-dashboard/types";

type WorkbookRow = {
  file_name: string | null;
  synced_at: string;
  last_modified: string | null;
  sheets: unknown;
  row_count: number;
  sheet_count: number;
};

function isSheet(value: unknown): value is WorkbookSheet {
  if (!value || typeof value !== "object") return false;
  const sheet = value as WorkbookSheet;
  return (
    typeof sheet.name === "string" &&
    (sheet.kind === "report" || sheet.kind === "helper") &&
    Array.isArray(sheet.headers) &&
    Array.isArray(sheet.rows)
  );
}

function sheetsFromJson(value: unknown): WorkbookSheet[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSheet);
}

export function workbookStats(sheets: WorkbookSheet[]) {
  return {
    sheetCount: sheets.length,
    rowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
  };
}

export async function saveSalesExcelWorkbook(input: {
  fileName: string | null;
  syncedAt?: string | null;
  lastModified?: string | null;
  workbook: SalesWorkbook;
}): Promise<void> {
  const sheets = input.workbook.sheets ?? [];
  if (!sheets.length) return;
  const stats = workbookStats(sheets);
  const syncedAt = input.syncedAt || input.lastModified || new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("sales_excel_workbooks").upsert(
    {
      id: 1,
      file_name: input.fileName ?? input.workbook.fileName,
      synced_at: syncedAt,
      last_modified: input.lastModified ?? syncedAt,
      sheets,
      row_count: stats.rowCount,
      sheet_count: stats.sheetCount,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

export async function loadSalesExcelWorkbook(): Promise<SalesWorkbookPayload | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sales_excel_workbooks")
    .select("file_name, synced_at, last_modified, sheets, row_count, sheet_count")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as WorkbookRow;
  const sheets = sheetsFromJson(row.sheets);
  if (!sheets.length) return null;
  return {
    fileName: row.file_name,
    sheets,
    syncedAt: row.synced_at,
    stored: true,
  };
}

export async function persistWorkbookFromDashboard(data: DashboardData): Promise<void> {
  if (!data.workbook?.sheets.length) return;
  await saveSalesExcelWorkbook({
    fileName: data.fileName ?? data.workbook.fileName,
    syncedAt: data.syncedAt,
    lastModified: data.syncedAt,
    workbook: data.workbook,
  });
}

/** Last synced grid from Postgres. Hydrates once from snapshot / ingested xlsx if empty. */
export async function resolveSalesExcelWorkbook(
  snapshot?: DashboardData | null,
): Promise<SalesWorkbookPayload> {
  const stored = await loadSalesExcelWorkbook().catch(() => null);
  if (stored?.sheets.length) return stored;

  if (snapshot?.workbook?.sheets.length) {
    await saveSalesExcelWorkbook({
      fileName: snapshot.fileName ?? snapshot.workbook.fileName,
      syncedAt: snapshot.syncedAt,
      lastModified: snapshot.syncedAt,
      workbook: snapshot.workbook,
    }).catch(() => undefined);
    return {
      fileName: snapshot.fileName ?? snapshot.workbook.fileName,
      sheets: snapshot.workbook.sheets,
      syncedAt: snapshot.syncedAt,
      stored: true,
    };
  }

  const ingested = await loadIngestedWorkbook().catch(() => null);
  if (ingested) {
    const workbook = parseSalesWorkbookGridFromBytes(ingested.buffer, ingested.fileName);
    if (workbook.sheets.length) {
      const syncedAt = ingested.lastModified ?? new Date().toISOString();
      await saveSalesExcelWorkbook({
        fileName: ingested.fileName,
        syncedAt,
        lastModified: ingested.lastModified,
        workbook,
      }).catch(() => undefined);
      return {
        fileName: ingested.fileName,
        sheets: workbook.sheets,
        syncedAt,
        stored: true,
      };
    }
  }

  return { ...EMPTY_SALES_WORKBOOK, syncedAt: null, stored: false };
}
