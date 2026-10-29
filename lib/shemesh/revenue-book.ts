import { parseWorkbookDate } from "@/lib/sales-dashboard/workbook-grid";
import type { SalesWorkbook, WorkbookRow, WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";

export type RevenueLedgerId = "collection" | "invoices" | "finance";

export type RevenueRow = {
  id: string;
  cells: string[];
  day: number | null;
};

export type RevenueLedger = {
  id: RevenueLedgerId;
  title: string;
  hint: string;
  headers: string[];
  rows: RevenueRow[];
  show: number[];
  client: number;
  agent: number;
  status: number;
  source: number;
  signed: number;
  date: number;
  deal: number;
  collected: number;
  invoiceAmount: number;
  invoiceNet: number;
  treatment: number;
  invoiced: number;
  reward: number;
  company: number;
  commission: number;
  settled: number;
};

export type RevenueBook = {
  fileName: string | null;
  syncedAt: string | null;
  ledgers: RevenueLedger[];
};

function col(headers: string[], exact: string): number {
  return headers.findIndex((header) => header.trim() === exact);
}

function colIncludes(headers: string[], needle: string): number {
  return headers.findIndex((header) => header.includes(needle));
}

/** Exact header first, then a longer partial, so «סכום» does not steal «סכום שנגבה». */
export function pickHeader(headers: string[], aliases: string[]): number {
  const trimmed = headers.map((header) => header.trim());
  for (const alias of aliases) {
    const exact = trimmed.findIndex((header) => header === alias);
    if (exact >= 0) return exact;
  }
  const partials = [...aliases].filter((alias) => alias.length >= 4).sort((a, b) => b.length - a.length);
  for (const alias of partials) {
    const partial = trimmed.findIndex((header) => header.includes(alias));
    if (partial >= 0) return partial;
  }
  return -1;
}

export const COLLECTION_ALIASES = {
  status: ["סטטוס גבייה", "סטטוס"],
  signed: ["חתום על ייפוי", "חתום"],
  client: ["שם מלא", "שם לקוח", "לקוח"],
  date: ["תאריך עסקה", "תאריך"],
  deal: ["סכום עסקה"],
  collected: ["סכום שנגבה", "סכום גבייה", "נגבה"],
  open: ["יתרה לגבייה", "פתוח לגבייה", "יתרת גבייה"],
  agent: ["שם נציג", "נציג", "מטפל"],
  source: ["מקור ליד", "מקור"],
} as const;

export type CollectionColumnMap = {
  status: number;
  signed: number;
  client: number;
  date: number;
  deal: number;
  collected: number;
  open: number;
  agent: number;
  source: number;
  labels: {
    date: string | null;
    deal: string | null;
    collected: string | null;
    open: string | null;
  };
};

export function mapCollectionColumns(headers: string[]): CollectionColumnMap {
  const index = {
    status: pickHeader(headers, [...COLLECTION_ALIASES.status]),
    signed: pickHeader(headers, [...COLLECTION_ALIASES.signed]),
    client: pickHeader(headers, [...COLLECTION_ALIASES.client]),
    date: pickHeader(headers, [...COLLECTION_ALIASES.date]),
    deal: pickHeader(headers, [...COLLECTION_ALIASES.deal]),
    collected: pickHeader(headers, [...COLLECTION_ALIASES.collected]),
    open: pickHeader(headers, [...COLLECTION_ALIASES.open]),
    agent: pickHeader(headers, [...COLLECTION_ALIASES.agent]),
    source: pickHeader(headers, [...COLLECTION_ALIASES.source]),
  };
  const label = (at: number) => (at >= 0 ? headers[at]?.trim() || null : null);
  return {
    ...index,
    labels: {
      date: label(index.date),
      deal: label(index.deal),
      collected: label(index.collected),
      open: label(index.open),
    },
  };
}

function labelHeaders(headers: string[]): string[] {
  return headers.map((header, index) => {
    if (header !== "הפקדות") return header;
    const prev = headers[index - 1] ?? "";
    if (prev.includes("גמל")) return "הפקדות לגמל";
    if (prev.includes("פנסיה")) return "הפקדות לפנסיה";
    return header;
  });
}

function rowsOf(sheet: WorkbookSheet, dateCol: number): RevenueRow[] {
  return sheet.rows.map((row: WorkbookRow) => ({
    id: row.id,
    cells: row.cells,
    day: dateCol >= 0 ? parseWorkbookDate(row.cells[dateCol] ?? "") : null,
  }));
}

function emptyLedger(id: RevenueLedgerId, title: string, hint: string): RevenueLedger {
  return {
    id,
    title,
    hint,
    headers: [],
    rows: [],
    show: [],
    client: -1,
    agent: -1,
    status: -1,
    source: -1,
    signed: -1,
    date: -1,
    deal: -1,
    collected: -1,
    invoiceAmount: -1,
    invoiceNet: -1,
    treatment: -1,
    invoiced: -1,
    reward: -1,
    company: -1,
    commission: -1,
    settled: -1,
  };
}

function collectionLedger(sheet: WorkbookSheet): RevenueLedger {
  const headers = sheet.headers;
  const mapped = mapCollectionColumns(headers);
  const ledger = emptyLedger("collection", "גבייה", "סכום עסקה מול מה שנגבה בפועל");
  ledger.headers = headers;
  ledger.status = mapped.status;
  ledger.signed = mapped.signed;
  ledger.client = mapped.client;
  ledger.date = mapped.date;
  ledger.deal = mapped.deal;
  ledger.collected = mapped.collected;
  ledger.agent = mapped.agent;
  ledger.source = mapped.source;
  const paidOn = col(headers, "שולם בתאריך");
  const notes = col(headers, "הערות");
  ledger.show = [
    ledger.status,
    ledger.client,
    ledger.date,
    ledger.deal,
    ledger.collected,
    ledger.agent,
    ledger.source,
    ledger.signed,
    paidOn,
    notes,
  ].filter((index) => index >= 0);
  ledger.rows = rowsOf(sheet, ledger.date);
  return ledger;
}

function invoiceLedger(sheet: WorkbookSheet): RevenueLedger {
  const headers = sheet.headers;
  const ledger = emptyLedger("invoices", "חשבוניות", "חשבוניות שהוצאו, כולל הסכום לפני ואחרי מע״מ");
  ledger.headers = headers;
  ledger.client = col(headers, "שם מלא");
  ledger.date = col(headers, "תאריך");
  ledger.treatment = col(headers, "טיפול");
  ledger.invoiceAmount = col(headers, "סכום");
  ledger.invoiceNet = col(headers, "סכום בהפחתת מעמ");
  ledger.agent = col(headers, "נציג");
  ledger.invoiced = col(headers, "חשבונית");
  ledger.reward = col(headers, "תגמול עובד");
  const reward = ledger.reward;
  const month = col(headers, "חודש");
  const notes = col(headers, "הערות");
  ledger.show = [
    ledger.client,
    ledger.date,
    ledger.treatment,
    ledger.invoiceAmount,
    ledger.invoiceNet,
    ledger.agent,
    ledger.invoiced,
    month,
    reward,
    notes,
  ].filter((index) => index >= 0);
  ledger.rows = rowsOf(sheet, ledger.date);
  return ledger;
}

function financeLedger(sheet: WorkbookSheet): RevenueLedger {
  const headers = labelHeaders(sheet.headers);
  const ledger = emptyLedger("finance", "פיננסים", "צבירה, עמלות ונפרע כפי שנרשמו בגיליון");
  ledger.headers = headers;
  ledger.client = col(headers, "שם מלא");
  ledger.company = col(headers, "חברת מקבלת");
  ledger.commission = colIncludes(headers, "עמלות");
  ledger.settled = colIncludes(headers, "נפרע עד");
  const gemel = col(headers, "גמל השתלמות");
  const gemelDeposits = col(headers, "הפקדות לגמל");
  const pension = col(headers, "פנסיה");
  const pensionDeposits = col(headers, "הפקדות לפנסיה");
  const settledTotal = headers.findIndex((header) => header.includes("נפרע") && header.includes("סה"));
  ledger.show = [
    ledger.client,
    ledger.company,
    gemel,
    gemelDeposits,
    pension,
    pensionDeposits,
    ledger.commission,
    settledTotal,
    ledger.settled,
  ].filter((index) => index >= 0);
  ledger.rows = sheet.rows.map((row) => ({ id: row.id, cells: row.cells, day: null }));
  return ledger;
}

const BUILDERS: Record<string, (sheet: WorkbookSheet) => RevenueLedger> = {
  גבייה: collectionLedger,
  Gviya: collectionLedger,
  gviya: collectionLedger,
  חשבוניות: invoiceLedger,
  פיננסים: financeLedger,
};

export function buildRevenueBook(workbook: SalesWorkbook | null | undefined): RevenueBook {
  const ledgers: RevenueLedger[] = [];
  for (const sheet of workbook?.sheets ?? []) {
    const build = BUILDERS[sheet.name];
    if (build && sheet.rows.length) ledgers.push(build(sheet));
  }
  const order: RevenueLedgerId[] = ["collection", "invoices", "finance"];
  ledgers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return {
    fileName: workbook?.fileName ?? null,
    syncedAt: workbook?.syncedAt ?? null,
    ledgers,
  };
}

export function parseRecordedMoney(value: string | null | undefined): number | null {
  const raw = String(value ?? "")
    .replace(/[₪,\s]/g, "")
    .trim();
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : null;
}

export function sumColumn(rows: RevenueRow[], index: number): number {
  if (index < 0) return 0;
  let total = 0;
  for (const row of rows) total += parseRecordedMoney(row.cells[index]) ?? 0;
  return total;
}

export function groupColumn(
  rows: RevenueRow[],
  keyIndex: number,
  valueIndex: number,
): { key: string; count: number; amount: number }[] {
  const groups = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const key = (keyIndex >= 0 ? row.cells[keyIndex] : "").trim() || "ללא ערך";
    const current = groups.get(key) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += valueIndex >= 0 ? (parseRecordedMoney(row.cells[valueIndex]) ?? 0) : 0;
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
}
