import { COL, normalizeExcelText } from "@/lib/sales-dashboard/columns";
import type { DashboardData } from "@/lib/sales-dashboard/types";

export type WorkbookSheetKind = "report" | "helper";

export type WorkbookRow = {
  id: string;
  excelRow: number;
  cells: string[];
};

export type WorkbookSheet = {
  name: string;
  kind: WorkbookSheetKind;
  headers: string[];
  rows: WorkbookRow[];
};

export type SalesWorkbook = {
  fileName: string | null;
  sheets: WorkbookSheet[];
  syncedAt?: string | null;
};

export type SalesWorkbookPayload = SalesWorkbook & {
  syncedAt: string | null;
  stored: boolean;
};

export const EMPTY_SALES_WORKBOOK: SalesWorkbook = { fileName: null, sheets: [] };

const REPORT_HEADER_HINTS = new Set<string>(Object.values(COL));

export function isReportHeader(raw: string): boolean {
  const header = normalizeExcelText(raw);
  if (!header) return false;
  if (REPORT_HEADER_HINTS.has(header)) return true;
  if (header === "תחילת ביטוח") return true;
  if (header.includes("מקור") && header.includes("פני")) return true;
  if (header.includes("סטאטוס") || header.includes("סטטוס")) return true;
  return false;
}

export function premiumColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => normalizeExcelText(header) === COL.premium);
}

export function headerMatches(header: string, ...needles: string[]): boolean {
  const h = normalizeExcelText(header);
  return needles.some((needle) => h === needle || h.includes(needle));
}

export function findHeaderIndex(headers: string[], ...needles: string[]): number {
  return headers.findIndex((header) => headerMatches(header, ...needles));
}

export function isPolicyHeader(header: string): boolean {
  const h = normalizeExcelText(header);
  return h.includes("מספר פוליסה") || h === "פוליסה";
}

export function isNotesHeader(header: string): boolean {
  return headerMatches(header, "הערות");
}

export function isPhoneHeader(header: string): boolean {
  return headerMatches(header, "נייד", "טלפון");
}

export function isIdHeader(header: string): boolean {
  return headerMatches(header, "ת.ז");
}

export function statusColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => {
    const v = normalizeExcelText(header);
    return v === COL.status || v.includes("סטאטוס") || v.includes("סטטוס");
  });
}

export function parsePremiumCell(value: string): number {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function workbookFromDashboard(data: DashboardData | null | undefined): SalesWorkbook {
  if (data?.workbook?.sheets?.length) return data.workbook;
  const marketing = data?.marketing;
  const productions = marketing?.productions ?? [];
  if (!productions.length) return { fileName: data?.fileName ?? null, sheets: [] };

  const headers =
    (marketing?.excelHeaders?.length ? marketing.excelHeaders : null) ??
    Object.keys(productions[0]?.fields ?? {});
  const rows: WorkbookRow[] = productions.map((row, index) => ({
    id: row.key || `row-${index}`,
    excelRow: index + 2,
    cells: headers.map((header) => {
      const fromFields = row.fields?.[header];
      if (fromFields) return fromFields;
      if (header === COL.agent) return row.agent;
      if (header === COL.client) return row.client;
      if (header === COL.product) return row.product;
      if (header === COL.company) return row.company;
      if (header === COL.source) return row.source;
      if (header === COL.process) return row.process;
      if (header === COL.status) return row.statusRaw;
      if (header === COL.premium) return row.premium ? String(row.premium) : "";
      if (header === COL.startDate) return row.startDate === "—" ? "" : row.startDate;
      if (header === COL.transferDate) return row.transferDate === "—" ? "" : row.transferDate;
      return "";
    }),
  }));

  return {
    fileName: data?.fileName ?? null,
    sheets: [
      {
        name: sheetNameFromFile(data?.fileName) || "2026",
        kind: "report",
        headers,
        rows,
      },
    ],
  };
}

export function sheetNameFromFile(fileName: string | null | undefined): string {
  if (!fileName) return "";
  return fileName.replace(/\.(xlsx|xls)$/i, "").trim();
}

export type CellTone = "none" | "active" | "cancelled" | "pending" | "sale" | "settled";

export function cellTone(header: string, value: string): CellTone {
  const v = normalizeExcelText(value);
  if (!v) return "none";
  const h = normalizeExcelText(header);
  if (h === COL.status || h.includes("סטאטוס") || h.includes("סטטוס")) {
    if (v === "פעילה" || v === "פעיל") return "active";
    if (v.includes("גניז") || v.includes("בוטל") || v.includes("דחי") || v.includes("נדח")) {
      return "cancelled";
    }
    return "pending";
  }
  if (h === COL.process || h.includes("תהליך")) {
    if (v.startsWith("מכירה")) return "sale";
    if (v.includes("מינוי")) return "settled";
  }
  return "none";
}

export function excelColumnWidth(header: string): number {
  const h = normalizeExcelText(header);
  if (h.includes("הערות")) return 280;
  if (h.includes("שם לקוח")) return 170;
  if (h === COL.agent || h === "משווק") return 148;
  if (h === COL.source || h.includes("מקור")) return 160;
  if (h.includes("פרמיה")) return 88;
  if (h.includes("תאריך") || h.includes("תחילת")) return 132;
  if (h.includes("נייד") || h.includes("ת.ז")) return 118;
  if (h.includes("פוליסה")) return 130;
  if (h.includes("שיקוף")) return 120;
  if (!h) return 72;
  return Math.min(200, Math.max(104, h.length * 9 + 36));
}
