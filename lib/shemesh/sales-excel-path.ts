import { existsSync } from "node:fs";

/** Same machine path the office watcher reads. Override with SHEMESH_EXCEL_LOCAL_PATH. */
export const DEFAULT_SHEMESH_EXCEL_PATH =
  "C:\\Users\\Beo-syestems\\Liba\\OneDrive - liba cnt\\שמש מימוש זכויות\\תפעול שמש\\דוח מכירות שמש פדיונות 2 .xlsx";

export function shemeshExcelLocalPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.SHEMESH_EXCEL_LOCAL_PATH?.trim() || DEFAULT_SHEMESH_EXCEL_PATH;
}

export function shemeshExcelFileReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const drive = Boolean(env.SHEMESH_EXCEL_DRIVE_ID?.trim() && env.SHEMESH_EXCEL_ITEM_ID?.trim());
  if (drive) return true;
  const path = shemeshExcelLocalPath(env);
  return Boolean(path) && existsSync(path);
}
