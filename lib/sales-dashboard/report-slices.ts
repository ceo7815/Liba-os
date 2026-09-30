import { inDateRange, isoDay, type DateRange } from "@/lib/sales-dashboard/campaign-math";
import { normalizeExcelText } from "@/lib/sales-dashboard/columns";
import { isSaleProcess } from "@/lib/sales-dashboard/sales-by-source";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

/**
 * שני תהליכים: מכירה ומינוי.
 * מינוי לא נכנס.
 * מכירה = תהליך מכירה, כל הסטטוסים, לפי תאריך העברה ליצרן.
 * הפקה = תהליך מכירה שעבר לסטטוס פעילה, לפי תאריך תחילת ביטוח.
 */

type SliceRow = Pick<
  MarketingProduction,
  "process" | "status" | "statusRaw" | "startDate" | "transferDate"
>;

export function isAgentAppointmentProcess(process: string): boolean {
  return normalizeExcelText(process).includes("מינוי");
}

/** מכירה: תהליך מכירה, כל סטטוס. מינוי לא נכנס. */
export function isReportSale(row: Pick<SliceRow, "process">): boolean {
  return isSaleProcess(row.process);
}

/** הפקה = הפקה פעילה: תהליך מכירה וסטטוס פעילה. */
export function isActiveProduction(
  row: Pick<SliceRow, "process" | "status">,
): boolean {
  return isSaleProcess(row.process) && row.status === "active";
}

export function isProductionRow(row: Pick<SliceRow, "process" | "status">): boolean {
  return isActiveProduction(row);
}

/** תאריך העברה ליצרן. Empty when that date was not entered. */
export function saleTransferDate(row: Pick<SliceRow, "transferDate">): string {
  return isoDay(row.transferDate);
}

/** תאריך תחילת ביטוח. Empty when that date was not entered. */
export function productionStartDate(row: Pick<SliceRow, "startDate">): string {
  return isoDay(row.startDate);
}

/** מכירות נכנסות לטווח לפי תאריך העברה ליצרן. */
export function inSaleTransferRange(row: Pick<SliceRow, "transferDate">, range: DateRange): boolean {
  return inDateRange(saleTransferDate(row), range);
}

/** הפקות נכנסות לטווח לפי תאריך תחילת ביטוח. */
export function inProductionStartRange(row: Pick<SliceRow, "startDate">, range: DateRange): boolean {
  return inDateRange(productionStartDate(row), range);
}
