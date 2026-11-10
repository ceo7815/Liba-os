import * as XLSX from "xlsx";
import { COL, PROCESS, STATUS } from "@/lib/sales-dashboard/columns";

/** Synthetic managers workbook. Names are tokens, not client data. */
const HEADERS = [
  COL.status,
  COL.premium,
  COL.process,
  COL.transferDate,
  COL.startDate,
  COL.client,
  COL.agent,
  COL.product,
  COL.company,
  COL.source,
];

const ROWS = [
  [STATUS.active, 1200, PROCESS.sale, "2026-03-02", "2026-03-01", "לקוח א", "ניב קובי", "בריאות", "מגדל", "שיחות נכנסות"],
  [STATUS.active, 800, PROCESS.sale, "2026-03-05", "2026-03-04", "לקוח ב", "שמש", "חיים", "הראל", "קמפיין שמש"],
  [STATUS.pending, 450, PROCESS.appointment, "2026-03-08", "2026-03-10", "לקוח ג", "ניב - שמש", "משכנתא", "כלל", "לידים קרים"],
  [STATUS.cancelled, 300, PROCESS.sale, "2026-02-11", "2026-02-01", "לקוח ד", "בן סגל", "תאונות", "מגדל", "שיחות נכנסות"],
];

const HELPER = [
  ["מכירה", "שיחות נכנסות", "ניב קובי"],
  ["מינוי", "קמפיין שמש", "שמש"],
  ["", "לידים קרים", "ניב - שמש"],
  ["", "התפתחות מגדל", "בן סגל"],
];

function workbookBytes(headers: (string | number)[]): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...ROWS]);
  const helper = XLSX.utils.aoa_to_sheet(HELPER);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "2026");
  XLSX.utils.book_append_sheet(wb, helper, "טבלת עזר");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function buildGoldenSalesWorkbook(): Uint8Array {
  return workbookBytes(HEADERS);
}

/** Sheet 2026 keeps every other header and replaces «פרמיה» with the number 64. */
export function buildMissingPremiumWorkbook(): Uint8Array {
  return workbookBytes(HEADERS.map((header) => (header === COL.premium ? 64 : header)));
}
