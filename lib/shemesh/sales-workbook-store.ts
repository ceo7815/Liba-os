import { createAdminClient } from "@/lib/supabase/admin";
import { SALES_EXCEL_BUCKET } from "@/lib/sales-dashboard/ingest-store";
import { workbookStats } from "@/lib/sales-dashboard/workbook-store";
import type { SalesWorkbook, SalesWorkbookPayload, WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";
import { parseShemeshSalesWorkbook } from "@/lib/shemesh/sales-excel-parse";

import { SHEMESH_SALES_OBJECT, SHEMESH_SALES_TABLE } from "@/lib/shemesh/sales-source";

const FILE_OBJECT = SHEMESH_SALES_OBJECT;
const META_OBJECT = "shemesh/live/meta.json";
const SNAPSHOT_CONTENT_TYPE = "application/octet-stream";

type WorkbookRow = {
  file_name: string | null;
  synced_at: string;
  sheets: unknown;
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

export type ShemeshSalesIngestResult = {
  fileName: string | null;
  syncedAt: string;
  rowCount: number;
  sheetCount: number;
  sheetNames: string[];
};

export async function saveShemeshSalesWorkbook(input: {
  fileName: string | null;
  buffer: Buffer;
  workbook: SalesWorkbook;
}): Promise<ShemeshSalesIngestResult> {
  const sheets = input.workbook.sheets ?? [];
  if (!sheets.length) throw new Error("האקסל לא מכיל גיליונות");
  const stats = workbookStats(sheets);
  const syncedAt = new Date().toISOString();
  const fileName = input.fileName ?? input.workbook.fileName;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage.from(SALES_EXCEL_BUCKET).upload(FILE_OBJECT, input.buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
    cacheControl: "0",
  });
  if (uploadError) throw new Error(uploadError.message);

  await admin.storage.from(SALES_EXCEL_BUCKET).upload(
    META_OBJECT,
    JSON.stringify({ fileName, uploadedAt: syncedAt }),
    { contentType: SNAPSHOT_CONTENT_TYPE, upsert: true, cacheControl: "0" },
  );

  const { error } = await admin.from(SHEMESH_SALES_TABLE).upsert(
    {
      id: 1,
      file_name: fileName,
      synced_at: syncedAt,
      last_modified: syncedAt,
      sheets,
      row_count: stats.rowCount,
      sheet_count: stats.sheetCount,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);

  return {
    fileName,
    syncedAt,
    rowCount: stats.rowCount,
    sheetCount: stats.sheetCount,
    sheetNames: sheets.map((sheet) => sheet.name),
  };
}

export async function ingestShemeshSalesBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ShemeshSalesIngestResult> {
  const workbook = parseShemeshSalesWorkbook(buffer, fileName);
  return saveShemeshSalesWorkbook({ fileName, buffer, workbook });
}

export async function shemeshSalesSyncStamp(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from(SHEMESH_SALES_TABLE)
    .select("synced_at")
    .eq("id", 1)
    .maybeSingle();
  const iso = (data as { synced_at?: string } | null)?.synced_at;
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function loadShemeshSalesWorkbook(): Promise<SalesWorkbookPayload | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(SHEMESH_SALES_TABLE)
    .select("file_name, synced_at, sheets")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as WorkbookRow;
  const sheets = Array.isArray(row.sheets) ? row.sheets.filter(isSheet) : [];
  if (!sheets.length) return null;
  return {
    fileName: row.file_name,
    sheets,
    syncedAt: row.synced_at,
    stored: true,
  };
}
