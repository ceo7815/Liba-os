import * as XLSX from "xlsx";
import { parseSalesWorkbookGrid } from "@/lib/sales-dashboard/workbook-parse";
import type { SalesWorkbook, WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";

const PLACEHOLDER_HEADER = /^Column\d+$/i;

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w).trim();
  if (cell.v == null || cell.v === "") return "";
  return String(cell.v).trim();
}

/** Excel sometimes fills a whole header row with Column10…Column16384. Those are not data. */
function stripPlaceholderHeaders(wb: XLSX.WorkBook) {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    for (const key of Object.keys(sheet)) {
      if (key.startsWith("!")) continue;
      const cell = sheet[key] as XLSX.CellObject | undefined;
      if (PLACEHOLDER_HEADER.test(cellText(cell))) delete sheet[key];
    }
  }
}

function looksLikeDataRow(cells: string[]): boolean {
  const filled = cells.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length < 3) return true;
  const dataLike = filled.filter((cell) => {
    const digits = cell.replace(/\D/g, "");
    return digits.length >= 7 || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(cell);
  }).length;
  return dataLike / filled.length >= 0.4;
}

function promoteHeaderRow(sheet: WorkbookSheet): WorkbookSheet {
  if (sheet.kind === "report" || !sheet.rows.length) return sheet;
  const first = sheet.rows[0];
  if (!first || looksLikeDataRow(first.cells)) return sheet;
  const headers = first.cells.map((cell, index) => cell.trim() || XLSX.utils.encode_col(index));
  let last = headers.length - 1;
  while (last > 0 && !headers[last]) last -= 1;
  const width = last + 1;
  const rows = sheet.rows.slice(1).flatMap((row) => {
    const cells = row.cells.slice(0, width);
    if (cells.every((value) => !value.trim())) return [];
    return [{ ...row, cells }];
  });
  return {
    ...sheet,
    kind: "report",
    headers: headers.slice(0, width),
    rows,
  };
}

/** Grid of the Shemesh workbook. Does not interpret Liba productions or income formulas. */
export function parseShemeshSalesWorkbook(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string | null,
): SalesWorkbook {
  const data = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input);
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  stripPlaceholderHeaders(wb);
  const parsed = parseSalesWorkbookGrid(wb, fileName);
  return {
    ...parsed,
    sheets: parsed.sheets.map(promoteHeaderRow),
  };
}
