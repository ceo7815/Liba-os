import { createAdminClient } from "@/lib/supabase/admin";
import { SALES_EXCEL_BUCKET } from "@/lib/sales-dashboard/ingest-store";
import { parseTaxRefundUpload } from "@/lib/shemesh/tax-refunds";
import type { SalesWorkbookPayload } from "@/lib/sales-dashboard/workbook-grid";

const OBJECT = "shemesh/tax-refunds/workbook.json";

export async function loadTaxRefundWorkbook(): Promise<SalesWorkbookPayload | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(SALES_EXCEL_BUCKET).download(OBJECT);
  if (error || !data) return null;
  const text = await data.text();
  try {
    const parsed = JSON.parse(text) as SalesWorkbookPayload;
    if (!parsed || !Array.isArray(parsed.sheets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveTaxRefundUpload(buffer: Buffer, fileName: string): Promise<SalesWorkbookPayload> {
  const workbook = parseTaxRefundUpload(buffer, fileName);
  if (!workbook.sheets.some((sheet) => sheet.rows.length)) {
    throw new Error("הקובץ לא מכיל שורות");
  }
  const admin = createAdminClient();
  const { error } = await admin.storage.from(SALES_EXCEL_BUCKET).upload(OBJECT, JSON.stringify(workbook), {
    contentType: "application/octet-stream",
    upsert: true,
    cacheControl: "0",
  });
  if (error) throw new Error(error.message);
  return workbook;
}
