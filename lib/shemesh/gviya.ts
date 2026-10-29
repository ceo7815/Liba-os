import { jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import type { SalesWorkbookPayload } from "@/lib/sales-dashboard/workbook-grid";
import { buildRevenueBook, mapCollectionColumns, parseRecordedMoney, type RevenueLedger } from "@/lib/shemesh/revenue-book";
import { presentShemeshWorkbook } from "@/lib/shemesh/sales-excel-view";
import { CASE_STAGES, type CaseStageId } from "@/lib/shemesh/catalog";

export type GviyaDeal = {
  id: string;
  client: string;
  rep: string;
  source: string;
  status: string;
  signed: boolean;
  dealDate: string | null;
  dealAmount: number;
  collected: number;
  /** Explicit open column when the sheet has one. Otherwise the dashboard uses sold minus collected. */
  openAmount: number | null;
  invoiceDate: string | null;
  cycleDays: number | null;
  stage: CaseStageId;
};

export type SheetContact = {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
};

export type GviyaColumnMap = {
  sheet: string;
  date: string | null;
  deal: string | null;
  collected: string | null;
  open: string | null;
};

export type GviyaModel = {
  fileName: string | null;
  syncedAt: string | null;
  deals: GviyaDeal[];
  contacts: SheetContact[];
  reps: string[];
  sources: string[];
  columns: GviyaColumnMap;
};

function ymd(stamp: number): string {
  const date = new Date(stamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function money(row: string[], index: number): number {
  return index < 0 ? 0 : parseRecordedMoney(row[index]) ?? 0;
}

export function normKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function signedValue(raw: string): boolean {
  const value = normKey(raw);
  return value === "כן" || value === "חתום" || value === "v" || value === "✓" || value === "1";
}

function stageOf(input: {
  status: string;
  signed: boolean;
  collected: number;
  invoiced: boolean;
}): CaseStageId {
  const status = input.status;
  if (input.collected > 0 || /נגב|חויב|שולם/.test(status)) return "collected";
  if (/החזר/.test(status)) return "refund";
  if (/מעקב/.test(status)) return "followup";
  if (/הוגש/.test(status)) return "filed";
  if (/מסמכ/.test(status)) return "documents";
  if (input.signed || /ייפוי|יפוי|חתום/.test(status)) return "poa";
  if (/זכאות|בדיק/.test(status)) return "eligibility";
  if (input.invoiced) return "collected";
  return "lead";
}

function findSheet(workbook: SalesWorkbookPayload, title: string) {
  return workbook.sheets.find((sheet) => sheet.name === title) ?? null;
}

export function buildGviyaModel(raw: SalesWorkbookPayload | null): GviyaModel {
  const emptyColumns: GviyaColumnMap = { sheet: "גבייה", date: null, deal: null, collected: null, open: null };
  if (!raw?.sheets.length) {
    return { fileName: null, syncedAt: null, deals: [], contacts: [], reps: [], sources: [], columns: emptyColumns };
  }
  const workbook = presentShemeshWorkbook(raw);
  const book = buildRevenueBook(workbook);
  const collection = book.ledgers.find((ledger) => ledger.id === "collection") ?? null;
  const mapped = collection ? mapCollectionColumns(collection.headers) : null;
  const columns: GviyaColumnMap = mapped
    ? { sheet: "גבייה", ...mapped.labels }
    : emptyColumns;
  const invoices = book.ledgers.find((ledger) => ledger.id === "invoices") ?? null;
  const invoiceDates = invoiceIndex(invoices);
  const deals = (collection?.rows ?? []).map((row) => {
    const client = cell(row.cells, collection?.client ?? -1);
    const stamp = row.day;
    const dealDate = stamp == null ? null : ymd(stamp);
    const invoiceDate = invoiceDates.get(normKey(client)) ?? null;
    const cycleDays =
      dealDate && invoiceDate ? Math.round((Date.parse(invoiceDate) - Date.parse(dealDate)) / 86400000) : null;
    const signed = signedValue(cell(row.cells, collection?.signed ?? -1));
    const collected = money(row.cells, collection?.collected ?? -1);
    const status = cell(row.cells, collection?.status ?? -1);
    return {
      id: row.id,
      client: client || "בלי שם",
      rep: cell(row.cells, collection?.agent ?? -1) || "ללא נציג",
      source: cell(row.cells, collection?.source ?? -1) || "ללא מקור",
      status: status || "ללא סטטוס",
      signed,
      dealDate,
      dealAmount: money(row.cells, collection?.deal ?? -1),
      collected,
      openAmount: mapped && mapped.open >= 0 ? money(row.cells, mapped.open) : null,
      invoiceDate,
      cycleDays: cycleDays != null && cycleDays >= 0 ? cycleDays : null,
      stage: stageOf({ status, signed, collected, invoiced: Boolean(invoiceDate) }),
    };
  });
  const contacts = sheetContacts(findSheet(workbook, "אנשי קשר"));
  return {
    fileName: workbook.fileName,
    syncedAt: workbook.syncedAt,
    deals,
    contacts,
    reps: unique(deals.map((deal) => deal.rep)),
    sources: unique(deals.map((deal) => deal.source)),
    columns,
  };
}

function invoiceIndex(ledger: RevenueLedger | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!ledger) return map;
  for (const row of ledger.rows) {
    const name = normKey(cell(row.cells, ledger.client));
    if (!name || row.day == null) continue;
    const day = ymd(row.day);
    const prev = map.get(name);
    if (!prev || day < prev) map.set(name, day);
  }
  return map;
}

function headerIndex(headers: string[], needles: string[]): number {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function sheetContacts(sheet: { headers: string[]; rows: { id: string; cells: string[] }[] } | null): SheetContact[] {
  if (!sheet) return [];
  const name = headerIndex(sheet.headers, ["שם"]);
  const phone = headerIndex(sheet.headers, ["טלפון", "נייד"]);
  const idNumber = headerIndex(sheet.headers, ["זהות", "ת.ז", "תז"]);
  return sheet.rows
    .map((row) => ({
      id: row.id,
      name: cell(row.cells, name >= 0 ? name : 0),
      phone: cell(row.cells, phone),
      idNumber: cell(row.cells, idNumber),
    }))
    .filter((row) => row.name || row.phone || row.idNumber);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));
}

export type GviyaFilter = {
  month: string;
  rep: string;
  source: string;
};

export function currentMonthKey(now = new Date()): string {
  return jerusalemYmd(now).slice(0, 7);
}

export function filterDeals<T extends GviyaDeal>(deals: T[], filter: GviyaFilter): T[] {
  return deals.filter((deal) => {
    if (filter.month && filter.month !== "all" && deal.dealDate?.slice(0, 7) !== filter.month) return false;
    if (filter.rep && filter.rep !== "all" && deal.rep !== filter.rep) return false;
    if (filter.source && filter.source !== "all" && deal.source !== filter.source) return false;
    return true;
  });
}

export type GviyaKpis = {
  sold: number;
  collected: number;
  count: number;
  average: number | null;
  cycleDays: number | null;
  matched: number;
  unmatched: number;
};

export function gviyaKpis(
  deals: GviyaDeal[],
  match: Map<string, boolean> | null,
): GviyaKpis {
  const sold = deals.reduce((sum, deal) => sum + deal.dealAmount, 0);
  const collected = deals.reduce((sum, deal) => sum + deal.collected, 0);
  const cycles = deals.map((deal) => deal.cycleDays).filter((value): value is number => value != null);
  let matched = 0;
  let unmatched = 0;
  if (match) {
    for (const deal of deals) {
      if (match.get(deal.id)) matched += 1;
      else unmatched += 1;
    }
  }
  return {
    sold,
    collected,
    count: deals.length,
    average: deals.length ? sold / deals.length : null,
    cycleDays: cycles.length ? Math.round(cycles.reduce((sum, value) => sum + value, 0) / cycles.length) : null,
    matched,
    unmatched,
  };
}

export function groupDeals(deals: GviyaDeal[], key: "rep" | "source"): { key: string; count: number; sold: number; collected: number }[] {
  const groups = new Map<string, { count: number; sold: number; collected: number }>();
  for (const deal of deals) {
    const name = deal[key];
    const current = groups.get(name) ?? { count: 0, sold: 0, collected: 0 };
    current.count += 1;
    current.sold += deal.dealAmount;
    current.collected += deal.collected;
    groups.set(name, current);
  }
  return Array.from(groups.entries())
    .map(([name, value]) => ({ key: name, ...value }))
    .sort((a, b) => b.sold - a.sold || b.count - a.count);
}

export function monthlyTrend(deals: GviyaDeal[]): { month: string; sold: number; collected: number; count: number }[] {
  const groups = new Map<string, { sold: number; collected: number; count: number }>();
  for (const deal of deals) {
    if (!deal.dealDate) continue;
    const month = deal.dealDate.slice(0, 7);
    const current = groups.get(month) ?? { sold: 0, collected: 0, count: 0 };
    current.sold += deal.dealAmount;
    current.collected += deal.collected;
    current.count += 1;
    groups.set(month, current);
  }
  return Array.from(groups.entries())
    .map(([month, value]) => ({ month, ...value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function stageCounts(deals: GviyaDeal[]): Record<CaseStageId, number> {
  const counts = Object.fromEntries(CASE_STAGES.map((stage) => [stage.id, 0])) as Record<CaseStageId, number>;
  for (const deal of deals) counts[deal.stage] += 1;
  return counts;
}

function assertMainWorkbookColumns(): void {
  const model = buildGviyaModel({
    fileName: "דוח מכירות שמש פדיונות ראשי.xlsx",
    syncedAt: "2026-10-21T08:15:00.000Z",
    stored: true,
    sheets: [
      {
        name: "Gviya",
        kind: "report",
        headers: ["סטטוס גבייה", "שם מלא", "תאריך", "סכום עסקה", "סכום שנגבה", "שם נציג", "מקור", "יתרה לגבייה"],
        rows: [{ id: "1", excelRow: 2, cells: ["פתוח", "הדגמה", "2026-10-04", "100", "40", "נציג", "קמפיין", "60"] }],
      },
      {
        name: "live/managers.xlsx",
        kind: "helper",
        headers: ["סכום"],
        rows: [{ id: "liba", excelRow: 2, cells: ["99999"] }],
      },
    ],
  });
  const deal = model.deals[0];
  if (!deal || deal.dealAmount !== 100 || deal.collected !== 40 || deal.openAmount !== 60 || deal.dealDate !== "2026-10-04") {
    throw new Error("Gviya columns must drive sold, collected, and open");
  }
  if (model.columns.deal !== "סכום עסקה" || model.columns.collected !== "סכום שנגבה" || model.columns.open !== "יתרה לגבייה") {
    throw new Error("column labels drifted");
  }
  if (model.deals.some((row) => row.dealAmount === 99999)) throw new Error("Liba sheet must not enter Shemesh sales");
  const alt = buildGviyaModel({
    fileName: "דוח מכירות שמש פדיונות 2",
    syncedAt: "2026-10-28T00:00:00.000Z",
    stored: true,
    sheets: [{
      name: "גבייה",
      kind: "report",
      headers: ["סטטוס", "לקוח", "תאריך עסקה", "סכום עסקה", "נגבה", "נציג", "מקור ליד"],
      rows: [{ id: "2", excelRow: 2, cells: ["פתוח", "הדגמה", "2026-10-04", "80", "10", "נציג", "שיחה"] }],
    }],
  });
  if (alt.deals[0]?.dealAmount !== 80 || alt.deals[0]?.collected !== 10 || alt.deals[0]?.openAmount != null) {
    throw new Error("פדיונות 2 headers must still map, with open derived");
  }
}

assertMainWorkbookColumns();
