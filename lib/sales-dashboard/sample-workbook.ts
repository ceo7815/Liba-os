/**
 * Smoke-check that Hebrew Excel headers parse into dashboard KPIs.
 * Run: node --import tsx/esm  is not required; invoked from tsc-checked parse via next build.
 */
import { COL, PROCESS, STATUS } from "@/lib/sales-dashboard/columns";
import { parseSalesWorkbook } from "@/lib/sales-dashboard/parse";
import * as XLSX from "xlsx";

export function buildSampleSalesWorkbook(): Uint8Array {
  const rows = [
    {
      [COL.status]: STATUS.active,
      [COL.premium]: 1000,
      [COL.process]: PROCESS.sale,
      [COL.transferDate]: new Date(2026, 2, 12),
      [COL.startDate]: new Date(2026, 3, 1),
      [COL.client]: "לקוח א",
      [COL.agent]: "ניב קובי",
      [COL.product]: "בריאות",
      [COL.company]: "מגדל",
      [COL.source]: "שיחות נכנסות",
    },
    {
      [COL.status]: STATUS.pending,
      [COL.premium]: 500,
      [COL.process]: PROCESS.appointment,
      [COL.transferDate]: new Date(2026, 2, 15),
      [COL.startDate]: new Date(2026, 3, 1),
      [COL.client]: "לקוח ב",
      [COL.agent]: "שמש",
      [COL.product]: "משכנתא",
      [COL.company]: "הראל",
      [COL.source]: "לקוחות ליבה",
    },
    {
      [COL.status]: STATUS.cancelled,
      [COL.premium]: 200,
      [COL.process]: PROCESS.sale,
      [COL.transferDate]: new Date(2026, 1, 2),
      [COL.startDate]: new Date(2026, 2, 1),
      [COL.client]: "לקוח ג",
      [COL.agent]: "אסף בר און",
      [COL.product]: "תאונות",
      [COL.company]: "מגדל",
      [COL.source]: "לידים קרים",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Report");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function assertSampleWorkbookParses() {
  const parsed = parseSalesWorkbook(buildSampleSalesWorkbook(), "sample.xlsx");
  if (parsed.active !== 1) throw new Error(`expected 1 active, got ${parsed.active}`);
  if (parsed.pending !== 1) throw new Error(`expected 1 pending, got ${parsed.pending}`);
  if (parsed.issues !== 1) throw new Error(`expected 1 issue, got ${parsed.issues}`);
  if (parsed.premium !== 1000) throw new Error(`expected premium 1000, got ${parsed.premium}`);
  if (parsed.agents[0]?.name !== "ניב קובי") {
    throw new Error("expected leaderboard to start with ניב קובי");
  }
  return parsed;
}
