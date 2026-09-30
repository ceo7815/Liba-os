import * as XLSX from "xlsx";
import { COL, normalizeExcelText, resolveHeader } from "@/lib/sales-dashboard/columns";
import { excelCalendarIso } from "@/lib/sales-dashboard/excel-date";
import {
  isReportHeader,
  type SalesWorkbook,
  type WorkbookRow,
  type WorkbookSheet,
  type WorkbookSheetKind,
} from "@/lib/sales-dashboard/workbook-grid";

const KNOWN_HEADERS = new Set<string>(Object.values(COL));

function formatExcelDate(date: Date): string {
  const iso = excelCalendarIso(date);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}.${year.slice(2)}`;
}

function originCell(sheet: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  const direct = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  if (direct && direct.v != null && direct.v !== "") return direct;
  const merges = sheet["!merges"];
  if (!merges) return direct;
  for (const merge of merges) {
    if (r < merge.s.r || r > merge.e.r || c < merge.s.c || c > merge.e.c) continue;
    return (
      (sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })] as XLSX.CellObject | undefined) ??
      direct
    );
  }
  return direct;
}

function cellDisplay(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = originCell(sheet, r, c);
  if (!cell) return "";
  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) return formatExcelDate(cell.v);
  if (cell.t === "n" && typeof cell.v === "number") {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    const format = String(cell.z ?? "");
    if (
      parsed &&
      parsed.y >= 1990 &&
      parsed.y <= 2100 &&
      /d/i.test(format) &&
      /m/i.test(format)
    ) {
      return `${parsed.d}.${parsed.m}.${String(parsed.y % 100).padStart(2, "0")}`;
    }
  }
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w).trim();
  if (cell.v == null || cell.v === "") return "";
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
    const value = sheet[key] as XLSX.CellObject | undefined;
    if (!value || value.v == null || value.v === "") continue;
    if (typeof value.v === "string" && value.v.trim() === "") continue;
    if (ref.c < minC) minC = ref.c;
    if (ref.r < minR) minR = ref.r;
    if (ref.c > maxC) maxC = ref.c;
    if (ref.r > maxR) maxR = ref.r;
  }
  if (!Number.isFinite(minC) || !Number.isFinite(minR)) return null;
  for (const merge of sheet["!merges"] ?? []) {
    const overlaps = merge.e.r >= minR && merge.s.r <= maxR && merge.e.c >= minC && merge.s.c <= maxC;
    if (!overlaps) continue;
    if (merge.s.c < minC) minC = merge.s.c;
    if (merge.s.r < minR) minR = merge.s.r;
    if (merge.e.c > maxC) maxC = merge.e.c;
    if (merge.e.r > maxR) maxR = merge.e.r;
  }
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
    if (headers.filter(Boolean).length >= 3) {
      const rows: WorkbookRow[] = [];
      for (let r = bounds.minR; r <= bounds.maxR; r++) {
        if (r === headerAt) continue;
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
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  return parseSalesWorkbookGrid(wb, fileName);
}
