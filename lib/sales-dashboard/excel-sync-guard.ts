import { SHEMESH_EXCEL_STORED_COPY_WARNING } from "@/lib/shemesh/sales-excel-source";
import { publicErrorText } from "@/lib/sync-log";

/** Why a forced Excel sync must not replace the numbers already on screen. */
export function salesExcelSyncProblem(
  data: { source?: string | null; error?: string | null } | null | undefined,
): string | null {
  if (!data || typeof data !== "object") return "סנכרון האקסל לא החזיר נתונים";
  const error = typeof data.error === "string" ? data.error.trim() : "";
  if (error) return publicErrorText(error);
  if (data.source !== "live") {
    return "דוח המנהלים לא עודכן. הנתונים שכבר על המסך נשארים.";
  }
  return null;
}

/** HTTP failure for one Excel source. Null means that source succeeded and sync can mark it done. */
export function excelHttpSyncFailure(status: number): string | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return "אין הרשאה לסנכרון אקסל";
  return "סנכרון אקסל נכשל";
}

/**
 * Shemesh workbook sync. A non-OK response fails only that source.
 * The caller keeps going and reports a partial system sync.
 */
export function shemeshExcelSyncFailure(
  status: number,
  body: { error?: string | null } | null | undefined,
): string | null {
  const http = excelHttpSyncFailure(status);
  if (!http) return null;
  if (status === 401) return http;
  const error = typeof body?.error === "string" ? body.error.trim() : "";
  return error ? publicErrorText(error) : http;
}

/** A 200 that kept the stored Shemesh file is not a refresh. */
export function shemeshExcelStoredCopyWarning(
  status: number,
  body: { skipped?: boolean; warning?: string | null } | null | undefined,
): string | null {
  if (status < 200 || status >= 300) return null;
  if (!body?.skipped) return null;
  const warning = typeof body.warning === "string" ? body.warning.trim() : "";
  return publicErrorText(warning || SHEMESH_EXCEL_STORED_COPY_WARNING);
}
