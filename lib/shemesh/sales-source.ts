import { SALES_EXCEL_OBJECT } from "@/lib/sales-dashboard/ingest-store";
import { currentMonthKey, filterDeals, gviyaKpis, type GviyaDeal } from "@/lib/shemesh/gviya";

/** Shemesh sales live in their own workbook. Liba's file is managers.xlsx. */
export const SHEMESH_SALES_TABLE = "shemesh_sales_workbooks";
export const SHEMESH_SALES_OBJECT = "shemesh/live/sales.xlsx";
export const SHEMESH_SALES_FILE = "דוח מכירות שמש פדיונות 2";
export const SHEMESH_SALES_FOLDER = "תפעול שמש";

export const SHEMESH_SALES_SOURCE_LABEL = `${SHEMESH_SALES_FILE} · ${SHEMESH_SALES_FOLDER}`;

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
  const month = monthSalesFromDeals(
    [
      { id: "in", client: "א", rep: "", source: "", status: "", signed: true, dealDate: "2026-10-04", dealAmount: 100, collected: 40, invoiceDate: "2026-10-06", cycleDays: 2, stage: "lead" },
      { id: "out", client: "ב", rep: "", source: "", status: "", signed: true, dealDate: "2026-09-01", dealAmount: 999, collected: 999, invoiceDate: null, cycleDays: null, stage: "lead" },
    ],
    "2026-10",
  );
  if (month.count !== 1 || month.sold !== 100 || month.collected !== 40 || month.cycleDays !== 2) {
    throw new Error("Shemesh month sales must follow the workbook deal_date only");
  }
}

assertShemeshSalesPathIsSeparate();
