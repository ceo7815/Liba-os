import * as XLSX from "xlsx";
import { COL, normalizeExcelText, resolveHeader } from "@/lib/sales-dashboard/columns";
import {
  isReportHeader,
  type SalesWorkbook,
  type WorkbookRow,
  type WorkbookSheet,
  type WorkbookSheetKind,
} from "@/lib/sales-dashboard/workbook-grid";

const KNOWN_HEADERS = new Set<string>(Object.values(COL));

function cellDisplay(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w).trim();
  if (cell.v == null || cell.v === "") return "";
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    const d = cell.v.getUTCDate();
    const m = cell.v.getUTCMonth() + 1;
    const y = cell.v.getUTCFullYear() % 100;
    return `${m}/${d}/${String(y).padStart(2, "0")}`;
  }
  return normalizeExcelText(String(cell.v));
}

function usedBounds(sheet: XLSX.WorkSheet): { minR: number; minC: number; maxR: number; maxC: number } | null {
  const keys = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  if (keys.length === 0) return null;
  let minC = Infinity;
  let minR = Infinity;
  let maxC = 0;
  let maxR = 0;
  for (const key of keys) {
    const ref = XLSX.utils.decode_cell(key);
    if (ref.r > 20000 || ref.c > 80) continue;
    const value = sheet[key] as XLSX.CellObject | undefined;
    if (!value || value.v == null || value.v === "") continue;
    if (typeof value.v === "string" && value.v.trim() === "") continue;
    if (ref.c < minC) minC = ref.c;
    if (ref.r < minR) minR = ref.r;
    if (ref.c > maxC) maxC = ref.c;
    if (ref.r > maxR) maxR = ref.r;
  }
  if (!Number.isFinite(minC) || !Number.isFinite(minR)) return null;
  return { minR, minC, maxR, maxC };
}

function headerRowIndex(sheet: XLSX.WorkSheet, bounds: { minR: number; minC: number; maxR: number; maxC: number }): number {
  let best = bounds.minR;
  let bestHits = 0;
  const last = Math.min(bounds.maxR, bounds.minR + 8);
  for (let r = bounds.minR; r <= last; r++) {
    let hits = 0;
    for (let c = bounds.minC; c <= bounds.maxC; c++) {
      const text = cellDisplay(sheet, r, c);
      if (!text) continue;
      if (isReportHeader(text) || KNOWN_HEADERS.has(resolveHeader(text))) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = r;
    }
    if (hits >= 5) return r;
  }
  return bestHits >= 4 ? best : -1;
}

function parseSheet(name: string, sheet: XLSX.WorkSheet): WorkbookSheet | null {
  const bounds = usedBounds(sheet);
  if (!bounds) return null;
  const headerAt = headerRowIndex(sheet, bounds);
  const kind: WorkbookSheetKind = headerAt >= 0 ? "report" : "helper";

  if (kind === "report") {
    const headers: string[] = [];
    for (let c = bounds.minC; c <= bounds.maxC; c++) {
      headers.push(cellDisplay(sheet, headerAt, c));
    }
    while (headers.length && !headers[headers.length - 1]) headers.pop();
    if (headers.length < 3) return null;
    const rows: WorkbookRow[] = [];
    for (let r = headerAt + 1; r <= bounds.maxR; r++) {
      const cells = headers.map((_, i) => cellDisplay(sheet, r, bounds.minC + i));
      if (cells.every((value) => !value)) continue;
      rows.push({
        id: `${name}:${r}`,
        excelRow: r + 1,
        cells,
      });
    }
    return { name: name.trim() || name, kind, headers, rows };
  }

  const colCount = bounds.maxC - bounds.minC + 1;
  const headers = Array.from({ length: colCount }, (_, i) =>
    XLSX.utils.encode_col(bounds.minC + i),
  );
  const rows: WorkbookRow[] = [];
  for (let r = bounds.minR; r <= bounds.maxR; r++) {
    const cells = headers.map((_, i) => cellDisplay(sheet, r, bounds.minC + i));
    if (cells.every((value) => !value)) continue;
    rows.push({
      id: `${name}:${r}`,
      excelRow: r + 1,
      cells,
    });
  }
  if (!rows.length) return null;
  return { name: name.trim() || name, kind, headers, rows };
}

export function parseSalesWorkbookGrid(
  wb: XLSX.WorkBook,
  fileName?: string | null,
): SalesWorkbook {
  const sheets: WorkbookSheet[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const parsed = parseSheet(name, sheet);
    if (parsed) sheets.push(parsed);
  }
  return { fileName: fileName ?? null, sheets };
}

export function parseSalesWorkbookGridFromBytes(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string | null,
): SalesWorkbook {
  const data =
    input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input);
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  return parseSalesWorkbookGrid(wb, fileName);
}
