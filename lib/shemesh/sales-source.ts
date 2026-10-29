import { SALES_EXCEL_OBJECT } from "@/lib/sales-dashboard/ingest-store";
import { currentMonthKey, filterDeals, gviyaKpis, type GviyaDeal } from "@/lib/shemesh/gviya";

/** Shemesh sales live in their own workbook. Liba's file is managers.xlsx. */
export const SHEMESH_SALES_TABLE = "shemesh_sales_workbooks";
export const SHEMESH_SALES_OBJECT = "shemesh/live/sales.xlsx";
/** Default Shemesh sales file already stored in shemesh_sales_workbooks. */
export const SHEMESH_SALES_MAIN_FILE = "דוח מכירות שמש פדיונות ראשי.xlsx";
/** Older name. Still read when that file is the one saved in the same table. */
export const SHEMESH_SALES_ALT_FILE = "דוח מכירות שמש פדיונות 2";
export const SHEMESH_SALES_FILE = SHEMESH_SALES_MAIN_FILE;
export const SHEMESH_SALES_FOLDER = "תפעול שמש";

export const SHEMESH_SALES_SOURCE_LABEL = `${SHEMESH_SALES_MAIN_FILE} · ${SHEMESH_SALES_FOLDER}`;

export function shemeshSalesSourceLabel(fileName: string | null | undefined): string {
  const name = fileName?.trim();
  return `${name || SHEMESH_SALES_MAIN_FILE} · ${SHEMESH_SALES_FOLDER}`;
}

/** True when the saved snapshot is older than two days. */
export function shemeshSalesSyncStale(syncedAt: string | null | undefined, today: string): boolean {
  if (!syncedAt) return false;
  const day = syncedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
  return age > 2;
}

export type WorkbookMonthSales = {
  month: string;
  sold: number;
  collected: number;
  count: number;
  cycleDays: number | null;
};

/** Sold, collected, and cycle days for one month. Input is already the Shemesh workbook's deals. */
export function monthSalesFromDeals(deals: GviyaDeal[], month = currentMonthKey()): WorkbookMonthSales {
  const rows = filterDeals(deals, { month, rep: "all", source: "all" });
  const kpis = gviyaKpis(rows, null);
  return {
    month,
    sold: kpis.sold,
    collected: kpis.collected,
    count: kpis.count,
    cycleDays: kpis.cycleDays,
  };
}

export function assertShemeshSalesPathIsSeparate(): void {
  const shemeshObject: string = SHEMESH_SALES_OBJECT;
  const libaObject: string = SALES_EXCEL_OBJECT;
  const shemeshTable: string = SHEMESH_SALES_TABLE;
  if (shemeshObject === libaObject) {
    throw new Error("Shemesh sales storage must not be Liba's managers.xlsx");
  }
  if (shemeshTable === "sales_excel_workbooks") {
    throw new Error("Shemesh sales must not use Liba's workbook table");
  }
  if (!shemeshObject.startsWith("shemesh/")) {
    throw new Error("Shemesh sales object must stay under shemesh/");
  }
  const mainFile: string = SHEMESH_SALES_MAIN_FILE;
  const altFile: string = SHEMESH_SALES_ALT_FILE;
  if (mainFile === altFile) {
    throw new Error("the main Shemesh file and פדיונות 2 must stay distinct");
  }
  if (!shemeshSalesSyncStale("2026-10-21T08:15:00.000Z", "2026-10-29")) {
    throw new Error("a sync older than two days must warn");
  }
  if (shemeshSalesSyncStale("2026-10-28T08:15:00.000Z", "2026-10-29")) {
    throw new Error("a one-day-old sync is not stale");
  }
  const month = monthSalesFromDeals(
    [
      { id: "in", client: "א", rep: "", source: "", status: "", signed: true, dealDate: "2026-10-04", dealAmount: 100, collected: 40, openAmount: null, invoiceDate: "2026-10-06", cycleDays: 2, stage: "lead" },
      { id: "out", client: "ב", rep: "", source: "", status: "", signed: true, dealDate: "2026-09-01", dealAmount: 999, collected: 999, openAmount: null, invoiceDate: null, cycleDays: null, stage: "lead" },
    ],
    "2026-10",
  );
  if (month.count !== 1 || month.sold !== 100 || month.collected !== 40 || month.cycleDays !== 2) {
    throw new Error("Shemesh month sales must follow the workbook deal_date only");
  }
}

assertShemeshSalesPathIsSeparate();
