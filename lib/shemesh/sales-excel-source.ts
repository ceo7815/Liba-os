export const SHEMESH_EXCEL_STORED_COPY_WARNING =
  "הקובץ של שמש לא נמצא במחשב הזה ואין חיבור Graph. מוצג העותק השמור, בלי סנכרון חדש.";

/** Older than this, the Shemesh workbook is called out as stale. Numbers are unchanged. */
export const SHEMESH_WORKBOOK_STALE_MS = 48 * 60 * 60 * 1000;

export type ShemeshExcelRead =
  | { kind: "local" }
  | { kind: "graph"; driveId: string; itemId: string }
  | { kind: "stored" }
  | { kind: "missing" };

/**
 * Where a Shemesh sync should read the workbook.
 * A missing local file must not count as a successful refresh when Graph is unset.
 */
export function chooseShemeshExcelRead(input: {
  localFileExists: boolean;
  driveId?: string | null;
  itemId?: string | null;
  hasStoredWorkbook: boolean;
}): ShemeshExcelRead {
  if (input.localFileExists) return { kind: "local" };
  const driveId = input.driveId?.trim() ?? "";
  const itemId = input.itemId?.trim() ?? "";
  if (driveId && itemId) return { kind: "graph", driveId, itemId };
  if (input.hasStoredWorkbook) return { kind: "stored" };
  return { kind: "missing" };
}

export function shemeshWorkbookStaleWarning(
  syncedAt: string | null | undefined,
  nowMs: number,
): string | null {
  const stamp = syncedAt?.trim() ?? "";
  if (!stamp) return "דוח שמש עדיין לא סונכרן. המספרים כאן לא מקובץ עדכני.";
  const at = Date.parse(stamp);
  if (!Number.isFinite(at)) return "דוח שמש עדיין לא סונכרן. המספרים כאן לא מקובץ עדכני.";
  if (nowMs - at <= SHEMESH_WORKBOOK_STALE_MS) return null;
  return "דוח שמש לא התעדכן יותר מיומיים. המספרים עלולים להיות ישנים.";
}
