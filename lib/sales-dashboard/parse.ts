import {
  COL,
  HEBREW_MONTHS,
  JERUSALEM_TZ,
  STATUS,
  normalizeExcelText,
  resolveHeader,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import { canonicalCampaignSource } from "@/lib/sales-dashboard/campaign-math";
import {
  collectExcelSellerNames,
  excelAgentDisplay,
  excelAgentKey,
} from "@/lib/employees/excel-sellers";
import type {
  AgentStat,
  CurrentMonth,
  DashboardData,
  MarketingOverview,
  MarketingProduction,
  MarketingProductionStatus,
  MarketingSource,
  NamedCount,
  PendingRow,
  SaleAlert,
  TrendSeries,
} from "@/lib/sales-dashboard/types";
import * as XLSX from "xlsx";
import { inflateRawSync } from "node:zlib";

function decodeXmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function inflateZipXmls(bytes: Uint8Array): Map<string, string> {
  const buf = Buffer.from(bytes);
  const files = new Map<string, string>();
  let i = 0;
  while (i <= buf.length - 30) {
    const sig = buf.readUInt32LE(i);
    if (sig === 0x02014b50) break;
    if (sig !== 0x04034b50) {
      i += 1;
      continue;
    }
    const flags = buf.readUInt16LE(i + 6);
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    if (flags & 0x8) {
      i = dataStart;
      continue;
    }
    const payload = buf.subarray(dataStart, dataStart + compSize);
    i = dataStart + compSize;
    if (!/\.xml$/i.test(name)) continue;
    try {
      const raw = method === 0 ? payload : inflateRawSync(payload);
      files.set(name.replace(/\\/g, "/"), raw.toString("utf8"));
    } catch {
      /* skip corrupt entry */
    }
  }
  return files;
}

function xmlTagValues(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const text = decodeXmlText(match[1].replace(/<[^>]+>/g, "").trim());
    if (text) out.push(text);
  }
  return out;
}

function valuesFromA1Ref(wb: XLSX.WorkBook, ref: string): unknown[] {
  const cleaned = decodeXmlText(ref).replace(/^=/, "").trim();
  if (!cleaned) return [];
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'") && !cleaned.includes("!"))
  ) {
    return cleaned
      .slice(1, -1)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const bang = cleaned.lastIndexOf("!");
  if (bang < 0) return [];
  const sheetName = cleaned
    .slice(0, bang)
    .replace(/^'+|'+$/g, "")
    .replace(/''/g, "'");
  const a1 = cleaned.slice(bang + 1).replace(/\$/g, "");
  const sheet = wb.Sheets[sheetName];
  if (!sheet || !a1) return [];
  try {
    const range = XLSX.utils.decode_range(a1.includes(":") ? a1 : `${a1}:${a1}`);
    const values: unknown[] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const item = sheet[XLSX.utils.encode_cell({ r, c })];
        if (item?.v != null && item.v !== "") values.push(item.v);
      }
    }
    return values;
  } catch {
    return [];
  }
}

function collectDropdownSourceNames(bytes: Uint8Array, wb: XLSX.WorkBook, into: Set<string>): void {
  const add = (raw: unknown) => {
    const name = canonicalCampaignSource(normalizeExcelText(String(raw ?? "")));
    if (!name || name === "null") return;
    if (resolveHeader(name) === COL.source) return;
    if ((Object.values(COL) as string[]).includes(name)) return;
    if (name.length < 2 || name.length > 80) return;
    if (/^\d+([.,]\d+)?$/.test(name)) return;
    into.add(name);
  };

  for (const def of wb.Workbook?.Names ?? []) {
    const label = String(def.Name ?? "");
    const ref = String(def.Ref ?? "");
    if (!ref) continue;
    const relevant = /מקור|source/i.test(label) || /מקור/.test(ref);
    if (!relevant) continue;
    for (const value of valuesFromA1Ref(wb, ref)) add(value);
  }

  const xmls = inflateZipXmls(bytes);
  for (const [path, xml] of xmls) {
    if (/workbook\.xml$/i.test(path)) {
      for (const ref of xmlTagValues(xml, "definedName")) {
        for (const value of valuesFromA1Ref(wb, ref)) add(value);
      }
    }
    if (!/worksheets\/.+\.xml$/i.test(path) && !/\/sheet\d+\.xml$/i.test(path)) continue;
    for (const formula of xmlTagValues(xml, "formula1")) {
      for (const value of valuesFromA1Ref(wb, formula)) add(value);
    }
  }
}

type ExcelRow = Record<string, unknown>;

function cell(row: ExcelRow, key: string): string {
  return normalizeExcelText(String(row[key] ?? ""));
}

function premiumOf(row: ExcelRow): number {
  const value = row[COL.premium];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  if (typeof value === "string") {
    const raw = normalizeExcelText(value);
    const israeli = parseIsraeliDate(raw);
    if (israeli) return israeli;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Managers type dates as 15/08/2026 — `new Date` reads that as US and drops day>12. */
function parseIsraeliDate(raw: string): Date | null {
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s|$)/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function jerusalemYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function labelForKey(key: string): string {
  const [, mm] = key.split("-");
  const year = key.slice(0, 4);
  return `${HEBREW_MONTHS[mm] ?? mm} ${year}`;
}

function isoDate(value: unknown): string {
  const d = toDate(value);
  if (!d) {
    const raw = String(value ?? "").trim();
    return raw ? raw.slice(0, 10) : "—";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : "—";
}

function isActiveStatus(status: string): boolean {
  return status === STATUS.active || status === STATUS.activeShort;
}

function isPendingStatus(status: string): boolean {
  return (
    status === STATUS.pending ||
    status === "ממתין למינוי" ||
    status === "ממתינה" ||
    status === "ממתין"
  );
}

function isCancelledStatus(status: string): boolean {
  return (
    status === STATUS.archived ||
    status === STATUS.cancelled ||
    status === "בוטל" ||
    status === "מבוטלת" ||
    status === "מבוטל"
  );
}

export function policyKey(row: ExcelRow): string {
  return [
    cell(row, COL.client),
    cell(row, COL.product),
    cell(row, COL.agent),
    isoDate(row[COL.transferDate]),
  ].join("|");
}

function groupBySum(rows: ExcelRow[], key: string): AgentStat[] {
  const map = new Map<string, AgentStat>();
  for (const row of rows) {
    const name = cell(row, key) || "אחר";
    const current = map.get(name) ?? { name, count: 0, sum: 0 };
    current.count += 1;
    current.sum += premiumOf(row);
    map.set(name, current);
  }
  return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
}

function countGroup(rows: ExcelRow[], key: string): NamedCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    let name = cell(row, key);
    if (!name || name === "null") continue;
    if (key === COL.source) name = canonicalCampaignSource(name);
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSeries(
  bucket: Record<string, { count: number; sum: number }>,
  keys: string[],
): TrendSeries {
  return {
    labels: keys.map(labelForKey),
    counts: keys.map((k) => bucket[k]?.count ?? 0),
    sums: keys.map((k) => Math.round(bucket[k]?.sum ?? 0)),
  };
}

function saleMonthKey(row: ExcelRow): string | null {
  if (sourcePnlKindForProcess(cell(row, COL.process)) !== "volume") return null;
  const d = toDate(row[COL.startDate]);
  if (!d) return null;
  const { year, month } = jerusalemYearMonth(d);
  let shiftedMonth = month - 1;
  let shiftedYear = year;
  if (shiftedMonth < 1) {
    shiftedMonth = 12;
    shiftedYear -= 1;
  }
  return monthKey(shiftedYear, shiftedMonth);
}

function transferMonthKey(row: ExcelRow): string | null {
  const d = toDate(row[COL.transferDate]);
  if (!d) return null;
  const { year, month } = jerusalemYearMonth(d);
  return monthKey(year, month);
}

function numericMonthLabel(key: string): string {
  const [year, mm] = key.split("-");
  return `${mm}/${year}`;
}

function addStat(map: Map<string, AgentStat>, name: string, premium: number) {
  const key = name.trim() || "אחר";
  const current = map.get(key) ?? { name: key, count: 0, sum: 0 };
  current.count += 1;
  current.sum += premium;
  map.set(key, current);
}

function statsBySum(map: Map<string, AgentStat>): AgentStat[] {
  return Array.from(map.values())
    .map((item) => ({ ...item, sum: Math.round(item.sum) }))
    .sort((a, b) => b.sum - a.sum || b.count - a.count);
}

function statsByMonth(map: Map<string, AgentStat>): AgentStat[] {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => ({
      name: key.includes("-") ? numericMonthLabel(key) : item.name,
      count: item.count,
      sum: Math.round(item.sum),
    }));
}

type SourceBuf = {
  name: string;
  activeCount: number;
  activePremium: number;
  pendingCount: number;
  pendingPremium: number;
  agents: Map<string, AgentStat>;
  months: Map<string, AgentStat>;
  products: Map<string, AgentStat>;
  companies: Map<string, AgentStat>;
};

function emptySourceBuf(name: string): SourceBuf {
  return {
    name,
    activeCount: 0,
    activePremium: 0,
    pendingCount: 0,
    pendingPremium: 0,
    agents: new Map(),
    months: new Map(),
    products: new Map(),
    companies: new Map(),
  };
}

function marketingStatus(status: string): MarketingProductionStatus {
  if (isActiveStatus(status)) return "active";
  if (isPendingStatus(status)) return "pending";
  if (isCancelledStatus(status)) return "cancelled";
  return "other";
}

function isEmptyExcelRow(row: ExcelRow): boolean {
  return Object.values(row).every((value) => {
    if (value == null) return true;
    const text = String(value).trim();
    return text === "" || text === "null";
  });
}

function collectHeaderOrder(rows: ExcelRow[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const header = resolveHeader(key);
      if (!header || seen.has(header)) continue;
      seen.add(header);
      order.push(header);
    }
  }
  return order;
}

function formatField(header: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (header === COL.transferDate || header === COL.startDate) {
    const iso = isoDate(value);
    return iso === "—" ? normalizeExcelText(String(value)) : iso;
  }
  if (header === COL.premium) {
    const n = premiumOf({ [COL.premium]: value });
    return Number.isFinite(n) ? String(n) : normalizeExcelText(String(value));
  }
  if (value instanceof Date) {
    const iso = isoDate(value);
    return iso === "—" ? "" : iso;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = normalizeExcelText(String(value));
  return text === "null" ? "" : text;
}

function rowFields(row: ExcelRow, headers: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const header of headers) {
    const text = formatField(header, row[header]);
    if (text) fields[header] = text;
  }
  return fields;
}

function collectWorkbookSourceNames(wb: XLSX.WorkBook, into: Set<string>): void {
  const reserved = new Set<string>(Object.values(COL));
  const add = (raw: unknown) => {
    const name = canonicalCampaignSource(normalizeExcelText(String(raw ?? "")));
    if (!name || name === "null" || reserved.has(name)) return;
    if (resolveHeader(name) === COL.source) return;
    into.add(name);
  };

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    expandSheetRef(sheet);
    const headerRow = headerRowIndex(sheet);
    const raw = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
      defval: null,
      range: headerRow,
    });
    let foundSourceCol = false;
    for (const row of raw) {
      const mapped: ExcelRow = {};
      for (const key of Object.keys(row)) mapped[resolveHeader(key)] = row[key];
      const value = mapped[COL.source];
      if (value == null || String(value).trim() === "") continue;
      foundSourceCol = true;
      add(value);
    }
    if (foundSourceCol) continue;
    if (!/מקור|רשימ|list|dropdown|lookup|valid/i.test(sheetName)) continue;
    const aoa = XLSX.utils.sheet_to_json<(unknown | null)[]>(sheet, {
      header: 1,
      defval: null,
    });
    for (const line of aoa) {
      if (Array.isArray(line) && line[0] != null) add(line[0]);
    }
  }
}

function buildMarketing(rows: ExcelRow[], wb?: XLSX.WorkBook, bytes?: Uint8Array): MarketingOverview {
  const sources = new Map<string, SourceBuf>();
  const agents = new Map<string, AgentStat>();
  const months = new Map<string, AgentStat>();
  const products = new Map<string, AgentStat>();
  const companies = new Map<string, AgentStat>();
  const productions: MarketingProduction[] = [];
  const sourceCatalog = new Set<string>();
  const excelHeaders = collectHeaderOrder(rows);
  let pendingCount = 0;
  let pendingPremium = 0;
  let cancelledCount = 0;
  let cancelledPremium = 0;

  rows.forEach((row, index) => {
    if (isEmptyExcelRow(row)) return;
    const labeled = canonicalCampaignSource(cell(row, COL.source));
    if (labeled) sourceCatalog.add(labeled);
    const statusRaw = cell(row, COL.status);
    const status = marketingStatus(statusRaw);
    const sourceName = labeled || "ללא מקור";
    const premium = premiumOf(row);
    const source = sources.get(sourceName) ?? emptySourceBuf(sourceName);
    sources.set(sourceName, source);
    productions.push({
      key: `${policyKey(row)}|${index}`,
      source: sourceName,
      client: cell(row, COL.client) || "—",
      agent: cell(row, COL.agent) || "—",
      product: cell(row, COL.product) || "—",
      company: cell(row, COL.company) || "—",
      premium,
      status,
      statusRaw: statusRaw || "—",
      process: cell(row, COL.process),
      startDate: isoDate(row[COL.startDate]),
      transferDate: isoDate(row[COL.transferDate]),
      fields: rowFields(row, excelHeaders),
    });

    if (status === "other") return;

    if (status === "pending") {
      pendingCount += 1;
      pendingPremium += premium;
      source.pendingCount += 1;
      source.pendingPremium += premium;
      return;
    }

    if (status === "cancelled") {
      cancelledCount += 1;
      cancelledPremium += premium;
      return;
    }

    source.activeCount += 1;
    source.activePremium += premium;
    addStat(source.agents, cell(row, COL.agent), premium);
    addStat(source.products, cell(row, COL.product), premium);
    addStat(source.companies, cell(row, COL.company), premium);
    addStat(agents, cell(row, COL.agent), premium);
    addStat(products, cell(row, COL.product), premium);
    addStat(companies, cell(row, COL.company), premium);
    const month = transferMonthKey(row);
    if (month) {
      addStat(source.months, month, premium);
      addStat(months, month, premium);
    }
  });

  if (wb) collectWorkbookSourceNames(wb, sourceCatalog);
  if (wb && bytes) collectDropdownSourceNames(bytes, wb, sourceCatalog);
  if (wb) collectHelperTableSources(wb, new Set(sourceCatalog), sourceCatalog);
  const extraSellers = wb
    ? collectHelperSellerNames(
        wb,
        productions.map((row) => row.agent),
      )
    : [];
  for (const name of sourceCatalog) {
    if (!sources.has(name)) sources.set(name, emptySourceBuf(name));
  }

  const sourceRows: MarketingSource[] = Array.from(sources.values())
    .map((source) => ({
      name: source.name,
      activeCount: source.activeCount,
      activePremium: Math.round(source.activePremium),
      pendingCount: source.pendingCount,
      pendingPremium: Math.round(source.pendingPremium),
      agents: statsBySum(source.agents),
      months: statsByMonth(source.months),
      products: statsBySum(source.products),
      companies: statsBySum(source.companies),
    }))
    .sort((a, b) => b.activePremium - a.activePremium || b.activeCount - a.activeCount);

  const active = sourceRows.reduce(
    (acc, source) => {
      acc.count += source.activeCount;
      acc.premium += source.activePremium;
      return acc;
    },
    { count: 0, premium: 0 },
  );

  return {
    activeCount: active.count,
    activePremium: active.premium,
    pendingCount,
    pendingPremium: Math.round(pendingPremium),
    cancelledCount,
    cancelledPremium: Math.round(cancelledPremium),
    sources: sourceRows,
    sourceCatalog: Array.from(sourceCatalog).sort((a, b) => a.localeCompare(b, "he")),
    sellerCatalog: collectExcelSellerNames({
      marketing: { productions, sellerCatalog: extraSellers },
    } as DashboardData),
    excelHeaders,
    productions,
    agents: statsBySum(agents),
    months: statsByMonth(months),
    products: statsBySum(products),
    companies: statsBySum(companies),
  };
}

function emptyMonth(): CurrentMonth {
  return {
    label: "—",
    totalCount: 0,
    totalSum: 0,
    activeCount: 0,
    activeSum: 0,
  };
}

function emptyMarketing(): MarketingOverview {
  return {
    activeCount: 0,
    activePremium: 0,
    pendingCount: 0,
    pendingPremium: 0,
    cancelledCount: 0,
    cancelledPremium: 0,
    sources: [],
    sourceCatalog: [],
    sellerCatalog: [],
    excelHeaders: [],
    productions: [],
    agents: [],
    months: [],
    products: [],
    companies: [],
  };
}

function cellHasValue(cell: XLSX.CellObject | undefined): boolean {
  if (!cell) return false;
  const value = cell.v;
  if (value == null || value === "") return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

function expandSheetRef(sheet: XLSX.WorkSheet): void {
  const keys = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  if (keys.length === 0) return;
  let minC = Infinity;
  let minR = Infinity;
  let maxC = 0;
  let maxR = 0;
  let found = false;
  for (const key of keys) {
    if (!cellHasValue(sheet[key] as XLSX.CellObject | undefined)) continue;
    const cellRef = XLSX.utils.decode_cell(key);
    found = true;
    if (cellRef.c < minC) minC = cellRef.c;
    if (cellRef.r < minR) minR = cellRef.r;
    if (cellRef.c > maxC) maxC = cellRef.c;
    if (cellRef.r > maxR) maxR = cellRef.r;
  }
  if (!found) return;
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { c: minC, r: minR },
    e: { c: maxC, r: maxR },
  });
}

function headerRowIndex(sheet: XLSX.WorkSheet): number {
  const ref = sheet["!ref"];
  if (!ref) return 0;
  const range = XLSX.utils.decode_range(ref);
  const known = new Set<string>(Object.values(COL));
  let best = range.s.r;
  let bestHits = 0;
  const last = Math.min(range.e.r, range.s.r + 10);
  for (let r = range.s.r; r <= last; r++) {
    let hits = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const value = sheet[XLSX.utils.encode_cell({ r, c })]?.v;
      if (value == null) continue;
      const resolved = resolveHeader(String(value));
      if (known.has(resolved)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = r;
    }
    if (hits >= 5) return r;
  }
  return bestHits >= 3 ? best : range.s.r;
}

function mapSheetRows(sheet: XLSX.WorkSheet): ExcelRow[] {
  expandSheetRef(sheet);
  const headerRow = headerRowIndex(sheet);
  const raw = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: null,
    range: headerRow,
  });
  return raw.map((row) => {
    const next: ExcelRow = {};
    for (const key of Object.keys(row)) {
      next[resolveHeader(key)] = row[key];
    }
    return next;
  });
}

function isReportRows(rows: ExcelRow[]): boolean {
  const headers = collectHeaderOrder(rows);
  return headers.includes(COL.source) && (headers.includes(COL.status) || headers.includes(COL.client));
}

function rowIdentity(row: ExcelRow): string {
  return [
    policyKey(row),
    cell(row, COL.status),
    cell(row, COL.premium),
    cell(row, COL.source),
    cell(row, COL.process),
  ].join("|");
}

function readAllReportRows(wb: XLSX.WorkBook): ExcelRow[] {
  const rows: ExcelRow[] = [];
  const seen = new Set<string>();
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const mapped = mapSheetRows(sheet);
    if (!isReportRows(mapped)) continue;
    for (const row of mapped) {
      if (isEmptyExcelRow(row)) continue;
      const id = rowIdentity(row);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  }
  return rows;
}

function collectHelperSellerNames(wb: XLSX.WorkBook, knownAgents: string[]): string[] {
  const known = new Set(
    knownAgents.map((name) => excelAgentKey(name)).filter(Boolean),
  );
  const extras: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const mapped = mapSheetRows(sheet);
    if (isReportRows(mapped)) continue;
    expandSheetRef(sheet);
    const aoa = XLSX.utils.sheet_to_json<(unknown | null)[]>(sheet, {
      header: 1,
      defval: null,
    });
    const width = aoa.reduce(
      (max, line) => (Array.isArray(line) ? Math.max(max, line.length) : max),
      0,
    );
    for (let c = 0; c < width; c++) {
      const values: string[] = [];
      for (const line of aoa) {
        if (!Array.isArray(line) || line[c] == null) continue;
        const display = excelAgentDisplay(String(line[c]));
        if (!display) continue;
        values.push(display);
      }
      const overlap = values.filter((name) => known.has(excelAgentKey(name))).length;
      if (overlap < 3) continue;
      extras.push(...values);
    }
  }
  return extras;
}

function collectHelperTableSources(
  wb: XLSX.WorkBook,
  knownSources: Set<string>,
  into: Set<string>,
): void {
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const mapped = mapSheetRows(sheet);
    if (isReportRows(mapped)) continue;
    expandSheetRef(sheet);
    const aoa = XLSX.utils.sheet_to_json<(unknown | null)[]>(sheet, {
      header: 1,
      defval: null,
    });
    const width = aoa.reduce(
      (max, line) => (Array.isArray(line) ? Math.max(max, line.length) : max),
      0,
    );
    for (let c = 0; c < width; c++) {
      const values: string[] = [];
      for (const line of aoa) {
        if (!Array.isArray(line) || line[c] == null) continue;
        const name = canonicalCampaignSource(normalizeExcelText(String(line[c])));
        if (!name) continue;
        if (resolveHeader(name) === COL.source) continue;
        if ((Object.values(COL) as string[]).includes(name)) continue;
        values.push(name);
      }
      const overlap = values.filter((name) => knownSources.has(name)).length;
      if (overlap < 3) continue;
      for (const name of values) into.add(name);
    }
  }
}

export function parseSalesWorkbook(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string | null,
  syncedAt?: string | null,
): DashboardData {
  const data =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input);
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  if (!wb.SheetNames[0]) {
    return {
      ...emptyDashboard(fileName),
      error: "הקובץ לא מכיל גיליונות",
    };
  }

  let rows = readAllReportRows(wb);
  if (rows.length === 0) {
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = sheet ? mapSheetRows(sheet) : [];
  }

  const active = rows.filter((r) => isActiveStatus(cell(r, COL.status)));
  const pending = rows.filter((r) => isPendingStatus(cell(r, COL.status)));
  const issues = rows.filter((r) => isCancelledStatus(cell(r, COL.status)));

  const salesMap: Record<string, { count: number; sum: number }> = {};
  const apptMap: Record<string, { count: number; sum: number }> = {};
  for (const row of rows) {
    const proc = cell(row, COL.process);
    const kind = sourcePnlKindForProcess(proc);
    if (kind === "other") continue;
    const d = toDate(row[COL.transferDate]);
    if (!d) continue;
    const { year, month } = jerusalemYearMonth(d);
    const key = monthKey(year, month);
    const bucket = kind === "settled" ? apptMap : salesMap;
    if (!bucket[key]) bucket[key] = { count: 0, sum: 0 };
    bucket[key].count += 1;
    bucket[key].sum += premiumOf(row);
  }

  const allKeys = Array.from(
    new Set([...Object.keys(salesMap), ...Object.keys(apptMap)]),
  )
    .sort()
    .slice(-6);
  const sales = buildSeries(salesMap, allKeys);
  const appointments = buildSeries(apptMap, allKeys);

  const monthBuckets: Record<
    string,
    { totalCount: number; totalSum: number; activeCount: number; activeSum: number }
  > = {};
  for (const row of rows) {
    const key = saleMonthKey(row);
    if (!key) continue;
    if (!monthBuckets[key]) {
      monthBuckets[key] = {
        totalCount: 0,
        totalSum: 0,
        activeCount: 0,
        activeSum: 0,
      };
    }
    const p = premiumOf(row);
    monthBuckets[key].totalCount += 1;
    monthBuckets[key].totalSum += p;
    if (cell(row, COL.status) === STATUS.active) {
      monthBuckets[key].activeCount += 1;
      monthBuckets[key].activeSum += p;
    }
  }

  const nowParts = jerusalemYearMonth(new Date());
  const nowKey = monthKey(nowParts.year, nowParts.month);
  const sortedKeys = Object.keys(monthBuckets).sort();
  const chosenKey = monthBuckets[nowKey]
    ? nowKey
    : (sortedKeys[sortedKeys.length - 1] ?? nowKey);
  const chosenData = monthBuckets[chosenKey] ?? {
    totalCount: 0,
    totalSum: 0,
    activeCount: 0,
    activeSum: 0,
  };
  const currentMonth: CurrentMonth = {
    label: labelForKey(chosenKey),
    ...chosenData,
  };

  const pendingRows: PendingRow[] = pending.slice(0, 20).map((r) => ({
    name: cell(r, COL.client) || "—",
    agent: cell(r, COL.agent) || "—",
    product: cell(r, COL.product) || "—",
    premium: premiumOf(r),
    date: isoDate(r[COL.transferDate]),
  }));

  const activePolicies: SaleAlert[] = rows
    .filter((r) => isActiveStatus(cell(r, COL.status)))
    .map((r) => ({
      key: policyKey(r),
      client: cell(r, COL.client),
      product: cell(r, COL.product),
      company: cell(r, COL.company),
      premium: premiumOf(r),
      agent: cell(r, COL.agent),
    }));

  const premium = Math.round(active.reduce((sum, r) => sum + premiumOf(r), 0));
  const monthRows = rows.filter((r) => saleMonthKey(r) === chosenKey);

  return {
    active: active.length,
    premium,
    pending: pending.length,
    issues: issues.length,
    agents: groupBySum(active, COL.agent).slice(0, 8),
    monthAgents: groupBySum(monthRows, COL.agent).slice(0, 8),
    companies: countGroup(rows, COL.company),
    sources: countGroup(rows, COL.source),
    sales,
    appointments,
    currentMonth,
    pendingRows,
    activePolicies,
    marketing: buildMarketing(rows, wb, data),
    fileName: fileName ?? null,
    syncedAt: syncedAt?.trim() || new Date().toISOString(),
    source: "live",
  };
}

function emptyDashboard(fileName?: string | null): DashboardData {
  const emptyTrend: TrendSeries = { labels: [], counts: [], sums: [] };
  return {
    active: 0,
    premium: 0,
    pending: 0,
    issues: 0,
    agents: [],
    monthAgents: [],
    companies: [],
    sources: [],
    sales: emptyTrend,
    appointments: emptyTrend,
    currentMonth: emptyMonth(),
    pendingRows: [],
    activePolicies: [],
    marketing: emptyMarketing(),
    fileName: fileName ?? null,
    syncedAt: new Date().toISOString(),
    source: "live",
  };
}
