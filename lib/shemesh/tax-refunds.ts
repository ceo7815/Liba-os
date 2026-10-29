import { parseShemeshSalesWorkbook } from "@/lib/shemesh/sales-excel-parse";
import { parseRecordedMoney } from "@/lib/shemesh/revenue-book";
import { parseWorkbookDate, type SalesWorkbookPayload, type WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";

export type TaxRow = {
  id: string;
  name: string;
  status: string;
  amount: number;
  month: string | null;
};

export type TaxReport = {
  fileName: string | null;
  syncedAt: string | null;
  rows: TaxRow[];
  statuses: string[];
};

function ymd(stamp: number): string {
  const date = new Date(stamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function indexOf(headers: string[], needles: string[]): number {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

export function taxRowsFromSheet(sheet: WorkbookSheet): TaxRow[] {
  const name = indexOf(sheet.headers, ["שם", "לקוח"]);
  const status = indexOf(sheet.headers, ["סטטוס", "סטאטוס", "שלב"]);
  const amount = indexOf(sheet.headers, ["סכום", "החזר", "שומה"]);
  const date = indexOf(sheet.headers, ["תאריך"]);
  return sheet.rows
    .map((row) => {
      const stamp = date >= 0 ? parseWorkbookDate(row.cells[date] ?? "") : null;
      const rawAmount = amount >= 0 ? row.cells[amount] ?? "" : "";
      return {
        id: row.id,
        name: (name >= 0 ? row.cells[name] : row.cells[0] ?? "").trim() || "בלי שם",
        status: (status >= 0 ? row.cells[status] : "").trim() || "ללא סטטוס",
        amount: parseRecordedMoney(rawAmount) ?? 0,
        month: stamp == null ? null : ymd(stamp),
      };
    })
    .filter((row) => row.name !== "בלי שם" || row.amount !== 0);
}

export function taxReportFromWorkbook(workbook: SalesWorkbookPayload | null): TaxReport {
  const sheet = workbook?.sheets.find((item) => item.rows.length) ?? null;
  const rows = sheet ? taxRowsFromSheet(sheet) : [];
  return {
    fileName: workbook?.fileName ?? null,
    syncedAt: workbook?.syncedAt ?? null,
    rows,
    statuses: Array.from(new Set(rows.map((row) => row.status))).sort((a, b) => a.localeCompare(b, "he")),
  };
}

function csvSheet(text: string): WorkbookSheet {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const split = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = split(lines[0] ?? "");
  const rows = lines.slice(1).map((line, index) => ({
    id: `csv-${index + 2}`,
    excelRow: index + 2,
    cells: split(line),
  }));
  return { name: "החזרי מס", kind: "report", headers, rows };
}

export function parseTaxRefundUpload(buffer: Buffer, fileName: string): SalesWorkbookPayload {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const sheet = csvSheet(buffer.toString("utf8"));
    return { fileName, syncedAt: new Date().toISOString(), stored: true, sheets: [sheet] };
  }
  const parsed = parseShemeshSalesWorkbook(buffer, fileName);
  return { ...parsed, syncedAt: new Date().toISOString(), stored: true };
}
