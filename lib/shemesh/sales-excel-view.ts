import type { SalesWorkbookPayload, WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";

const SHEET_VIEW: Record<string, { title: string; hint: string; rank: number }> = {
  Gviya: { title: "גבייה", hint: "עסקאות, סטטוס תשלום ונציג", rank: 0 },
  Tiful: { title: "תפעול", hint: "טיפולים לפי לקוח", rank: 1 },
  חשבוניות: { title: "חשבוניות", hint: "חשבוניות שהוצאו", rank: 2 },
  פיננסים: { title: "פיננסים", hint: "גמל, השתלמות ופנסיה", rank: 3 },
  "מעקב גביה": { title: "סיכום גבייה", hint: "סכומים לפי נציג", rank: 4 },
  "מעקב ביטוח": { title: "סיכום ביטוח", hint: "פרמיה לפי נציג", rank: 5 },
  חישובים: { title: "חישובים", hint: "תזרים לפי חודש", rank: 6 },
  Sheet6: { title: "אנשי קשר", hint: "רשימה חופשית", rank: 7 },
  testo: { title: "טיוטה", hint: "גיליון בדיקה", rank: 8 },
};

export function shemeshSheetHint(name: string): string {
  return Object.values(SHEET_VIEW).find((item) => item.title === name)?.hint ?? "שורות מהקובץ";
}

function cleanPivotHeader(raw: string): string {
  const text = raw.trim();
  if (text === "תוויות שורה") return "נציג";
  const sum = text.match(/^Sum of (.+)$/i);
  if (!sum) return text;
  const name = sum[1].trim();
  if (/^balance$/i.test(name)) return "יתרה";
  return name;
}

function repairPivot(sheet: WorkbookSheet): WorkbookSheet {
  const headerAt = sheet.rows.findIndex((row) =>
    row.cells.some((cell) => /תוויות שורה|^Sum of /i.test(cell.trim())),
  );
  if (headerAt < 0) return sheet;
  const headers = sheet.rows[headerAt].cells.map((cell, index) => cleanPivotHeader(cell) || `עמודה ${index + 1}`);
  const width = headers.length;
  const rows = sheet.rows.slice(headerAt + 1).flatMap((row) => {
    const cells = row.cells.slice(0, width);
    if (cells.every((value) => !value.trim())) return [];
    return [{ ...row, cells }];
  });
  return { ...sheet, kind: "report", headers, rows };
}

function repairContacts(sheet: WorkbookSheet): WorkbookSheet {
  if (sheet.kind === "report" || sheet.headers.length !== 5 || !sheet.rows.length) return sheet;
  const phone = sheet.rows[0]?.cells[1]?.replace(/\D/g, "") ?? "";
  if (phone.length < 9 || phone.length > 12) return sheet;
  return {
    ...sheet,
    kind: "report",
    headers: ["שם", "טלפון", "תעודת זהות", "גיל", "תאריך"],
  };
}

function frontRank(header: string): number {
  const h = header.trim();
  if (h.includes("סטטוס")) return 0;
  if (h === "שם מלא" || h === "שם") return 1;
  if (h.includes("תעודת") || h === "ת.ז" || h === "תז") return 2;
  if (h.includes("טלפון")) return 3;
  return 10;
}

function prioritizeColumns(sheet: WorkbookSheet): WorkbookSheet {
  if (sheet.kind !== "report") return sheet;
  const order = sheet.headers.map((_, index) => index);
  order.sort((a, b) => frontRank(sheet.headers[a]) - frontRank(sheet.headers[b]) || a - b);
  if (order.every((index, position) => index === position)) return sheet;
  if (order.every((index) => frontRank(sheet.headers[index]) === 10)) return sheet;
  return {
    ...sheet,
    headers: order.map((index) => sheet.headers[index]),
    rows: sheet.rows.map((row) => ({
      ...row,
      cells: order.map((index) => row.cells[index] ?? ""),
    })),
  };
}

/** Display order and labels for the Shemesh workbook. Stored cells stay unchanged. */
export function presentShemeshWorkbook(workbook: SalesWorkbookPayload): SalesWorkbookPayload {
  const sheets = workbook.sheets
    .map((sheet) => {
      const view = SHEET_VIEW[sheet.name];
      const repaired = prioritizeColumns(repairContacts(repairPivot(sheet)));
      return {
        rank: view?.rank ?? 20,
        sheet: { ...repaired, name: view?.title ?? sheet.name },
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.sheet);
  return { ...workbook, sheets };
}
