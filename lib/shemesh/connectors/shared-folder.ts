import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";
import { shemeshExcelFileReady } from "@/lib/shemesh/sales-excel-path";

const readyMessage =
  "דוח המכירות של שמש מחובר מהקובץ. הגיליונות נשמרים כמו שהם, בלי נוסחאות הכנסה.";

export const sharedFolderConnector: ShemeshConnector = {
  id: "shared_folder",
  label: "דוח מכירות",
  pulls: "גבייה, חשבוניות ופיננסים",
  envKeys: ["SHEMESH_EXCEL_LOCAL_PATH", "SHEMESH_EXCEL_DRIVE_ID", "SHEMESH_EXCEL_ITEM_ID"],
  blockedMessage: "אין נתיב לקובץ האקסל של שמש. קובץ המכירות של ליבה לא נקרא לכאן.",
  readyMessage,
  isReady: (env) => shemeshExcelFileReady(env),
  pull: (env) => Promise.resolve(blockedPull(sharedFolderConnector, env, readyMessage)),
};
