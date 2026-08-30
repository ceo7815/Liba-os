import { COL, COL_ALIASES, HEBREW_MONTHS, JERUSALEM_TZ, PROCESS, STATUS } from "@/lib/sales-dashboard/columns";
import type {
  AgentStat,
  CurrentMonth,
  DashboardData,
  NamedCount,
  PendingRow,
  SaleAlert,
  TrendSeries,
} from "@/lib/sales-dashboard/types";
import * as XLSX from "xlsx";

type ExcelRow = Record<string, unknown>;

function cell(row: ExcelRow, key: string): string {
  return String(row[key] ?? "").trim();
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
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
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
    const name = cell(row, key);
    if (!name || name === "null") continue;
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
  if (cell(row, COL.process) !== PROCESS.sale) return null;
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

function emptyMonth(): CurrentMonth {
  return {
    label: "—",
    totalCount: 0,
    totalSum: 0,
    activeCount: 0,
    activeSum: 0,
  };
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
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      ...emptyDashboard(fileName),
      error: "הקובץ לא מכיל גיליונות",
    };
  }

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: null });
  const rows = raw.map((row) => {
    const next: ExcelRow = {};
    for (const key of Object.keys(row)) {
      const trimmed = key.trim();
      next[COL_ALIASES[trimmed] ?? trimmed] = row[key];
    }
    return next;
  });

  const active = rows.filter((r) => cell(r, COL.status) === STATUS.active);
  const pending = rows.filter((r) => cell(r, COL.status) === STATUS.pending);
  const issues = rows.filter((r) => {
    const status = cell(r, COL.status);
    return status === STATUS.archived || status === STATUS.cancelled;
  });

  const salesMap: Record<string, { count: number; sum: number }> = {};
  const apptMap: Record<string, { count: number; sum: number }> = {};
  for (const row of rows) {
    const proc = cell(row, COL.process);
    if (proc !== PROCESS.sale && proc !== PROCESS.appointment) continue;
    const d = toDate(row[COL.transferDate]);
    if (!d) continue;
    const { year, month } = jerusalemYearMonth(d);
    const key = monthKey(year, month);
    const bucket = proc === PROCESS.appointment ? apptMap : salesMap;
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
    sources: countGroup(rows, COL.source).slice(0, 8),
    sales,
    appointments,
    currentMonth,
    pendingRows,
    activePolicies,
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
    fileName: fileName ?? null,
    syncedAt: new Date().toISOString(),
    source: "live",
  };
}
