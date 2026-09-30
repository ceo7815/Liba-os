import { productionDateOf, shiftCalendarMonth } from "@/lib/employees/contract";
import { excelAgentKey } from "@/lib/employees/excel-sellers";
import type { OperatingBrandId } from "@/lib/finance/operating-brand";
import {
  formatIls,
  jerusalemYmd,
  rangeForPreset,
  type DateRange,
} from "@/lib/sales-dashboard/campaign-math";
import { HEBREW_MONTHS } from "@/lib/sales-dashboard/columns";
import {
  inProductionStartRange,
  inSaleTransferRange,
  isActiveProduction,
  isAgentAppointmentProcess,
  isReportSale,
  productionStartDate,
  saleTransferDate,
} from "@/lib/sales-dashboard/report-slices";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";

export type ControlCenterLeader = {
  name: string;
  count: number;
  premium: number;
};

export type ControlCenterSnapshot = {
  monthKey: string;
  monthLabel: string;
  /** הפקה פעילה count in the calendar sale month. */
  productions: number;
  /** Premium of those active sales. */
  premium: number;
  /** הפקות: every מכירה row in the same month. */
  productionAll: number;
  productionAllPremiumLabel: string;
  premiumLabel: string;
  /** Open pending appointments (pipeline). */
  pending: number;
  /** Cancelled rows in the month. */
  cancelled: number;
  /** Every workbook row dated in this production month, not only active sales. */
  monthRows: number;
  /** Premium on every row dated this month. */
  monthPremium: number;
  /** מכירה rows this calendar month, excluding cancellations. */
  salesCount: number;
  salesPremium: number;
  /** מינוי סוכן: process מינוי in the report, by transfer date. Sales excluded. */
  agentAppointmentCount: number;
  agentAppointmentPremium: number;
  agentAppointmentPremiumLabel: string;
  /** Calendar month of the sales cube, same window as פילוח «החודש». */
  salesRangeLabel: string;
  /** Pending rows whose production date is in this month. */
  pendingInMonth: number;
  /** Rows in the month that are not an active sale, a pending row, or a cancellation. */
  otherInMonth: number;
  /** Premium on pending rows dated this month. */
  pendingPremium: number;
  /** Active sales whose insurance start is the 1st of the next month. */
  upcomingDate: string;
  upcomingDateLabel: string;
  upcomingCount: number;
  upcomingPremium: number;
  upcomingPremiumLabel: string;
  /** Active productions on the 1st whose transfer is in the viewed month. */
  upcomingMonthCount: number;
  upcomingMonthPremium: number;
  upcomingMonthPremiumLabel: string;
  /** Active 1st-of-next-month productions sold in the previous 3 months. */
  carriedCount: number;
  carriedPremium: number;
  carriedPremiumLabel: string;
  carriedRangeLabel: string;
  topAgent: ControlCenterLeader | null;
  topProduct: ControlCenterLeader | null;
  topSource: ControlCenterLeader | null;
  topCompany: ControlCenterLeader | null;
  syncedAt: string | null;
};

export type ControlCenterDetailKind =
  | "premium"
  | "productions"
  | "pending"
  | "pendingMonth"
  | "cancelled"
  | "monthSales"
  | "agentAppointment"
  | "agent"
  | "product"
  | "source"
  | "company"
  | "upcoming"
  | "carried";

export type ControlCenterDetailRow = {
  key: string;
  date: string;
  /** תאריך תחילת ביטוח. Empty when that date was not entered. */
  startDate: string;
  /** תאריך העברה ליצרן, as entered on the sales report. */
  transferDate: string;
  client: string;
  agent: string;
  product: string;
  company: string;
  source: string;
  process: string;
  status: MarketingProduction["status"];
  statusRaw: string;
  premium: number;
};

export type ControlCenterDetail = {
  kind: ControlCenterDetailKind;
  title: string;
  subtitle: string;
  explanation: string;
  monthLabel: string;
  count: number;
  premium: number;
  premiumLabel: string;
  rows: ControlCenterDetailRow[];
  /** Ranking that explains why a leader won (when relevant). */
  ranking: ControlCenterLeader[];
};

function monthLabelHe(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return key;
  const mm = key.slice(5, 7);
  const year = key.slice(0, 4);
  const he = HEBREW_MONTHS[mm] ?? mm;
  return `${he} ${year}`;
}

export function formatControlMonth(monthKey: string): string {
  return monthLabelHe(monthKey);
}

/** Period slice for the מינוי סוכן cube only. */
export type AgentAppointmentPeriod =
  | { preset: "month" | "prev" | "ytd" }
  | { preset: "pick"; monthKey: string };

function monthKeyRange(monthKey: string): DateRange {
  const [year, month] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(last).padStart(2, "0")}`,
  };
}

function appointmentSlice(
  productions: MarketingProduction[],
  now: Date,
  period: AgentAppointmentPeriod,
): { rows: MarketingProduction[]; label: string } {
  const today = jerusalemYmd(now);
  const empty = { from: null, to: null };
  let range: DateRange;
  let label: string;
  if (period.preset === "prev") {
    range = rangeForPreset("prev", empty, today);
    label = monthLabelHe((range.from ?? today).slice(0, 7));
  } else if (period.preset === "ytd") {
    range = rangeForPreset("ytd", empty, today);
    label = "מתחילת שנה";
  } else if (period.preset === "pick" && /^\d{4}-\d{2}$/.test(period.monthKey)) {
    range = monthKeyRange(period.monthKey);
    label = monthLabelHe(period.monthKey);
  } else {
    range = rangeForPreset("month", empty, today);
    label = monthLabelHe(today.slice(0, 7));
  }
  return {
    label,
    rows: productions.filter(
      (row) => isAgentAppointmentProcess(row.process) && inSaleTransferRange(row, range),
    ),
  };
}

/** Months that have a מינוי row, plus the current month. Newest first. */
export function agentAppointmentMonthKeys(
  data: DashboardData | null | undefined,
  now = new Date(),
): string[] {
  const keys = new Set<string>([jerusalemYmd(now).slice(0, 7)]);
  for (const row of data?.marketing?.productions ?? []) {
    if (!isAgentAppointmentProcess(row.process)) continue;
    const day = saleTransferDate(row);
    if (/^\d{4}-\d{2}/.test(day)) keys.add(day.slice(0, 7));
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export type ControlCenterBrandScope = {
  brand: OperatingBrandId;
  shemeshEmployeeNames: readonly string[];
};

const ALL_BRANDS: ControlCenterBrandScope = {
  brand: "all",
  shemeshEmployeeNames: [],
};

function firstOfFollowingMonth(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function carrySpanLabel(monthKey: string): string {
  const from = shiftCalendarMonth(monthKey, -3);
  const to = shiftCalendarMonth(monthKey, -1);
  const fromName = HEBREW_MONTHS[from.slice(5, 7)] ?? from.slice(5, 7);
  const toName = HEBREW_MONTHS[to.slice(5, 7)] ?? to.slice(5, 7);
  return `${fromName}–${toName} ${to.slice(0, 4)}`;
}

function numericDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}.${year}`;
}

/** מכירות לפי העברה ליצרן. הפקות לפי תחילת ביטוח. אותו חודש קלנדרי. */
function monthWindow(productions: MarketingProduction[], now: Date) {
  const today = jerusalemYmd(now);
  const range = rangeForPreset("month", { from: null, to: null }, today);
  const monthKey = today.slice(0, 7);
  const upcomingDate = firstOfFollowingMonth(monthKey);
  const salesRows = productions.filter(
    (row) => isReportSale(row) && inSaleTransferRange(row, range),
  );
  const agentAppointmentRows = productions.filter(
    (row) => isAgentAppointmentProcess(row.process) && inSaleTransferRange(row, range),
  );
  const activeRows = productions.filter(
    (row) => isActiveProduction(row) && inProductionStartRange(row, range),
  );
  const upcomingRows = productions.filter(
    (row) => isActiveProduction(row) && productionStartDate(row) === upcomingDate,
  );
  const upcomingMonthRows = upcomingRows.filter(
    (row) => saleTransferDate(row).slice(0, 7) === monthKey,
  );
  const carriedMonths = new Set(
    [1, 2, 3].map((monthsBack) => shiftCalendarMonth(monthKey, -monthsBack)),
  );
  const carriedRows = upcomingRows.filter((row) =>
    carriedMonths.has(saleTransferDate(row).slice(0, 7)),
  );
  return {
    monthKey,
    rangeLabel: monthLabelHe(monthKey),
    inMonth: productions.filter(
      (row) => inSaleTransferRange(row, range) || inProductionStartRange(row, range),
    ),
    salesRows,
    agentAppointmentRows,
    activeRows,
    upcomingDate,
    upcomingRows,
    upcomingMonthRows,
    carriedRows,
    carriedRangeLabel: carrySpanLabel(monthKey),
    productionRows: activeRows,
    cancelledRows: productions.filter(
      (row) => row.status === "cancelled" && inSaleTransferRange(row, range),
    ),
    pendingInMonth: productions.filter(
      (row) => row.status === "pending" && isReportSale(row) && inSaleTransferRange(row, range),
    ),
  };
}

function leadersFrom(
  rows: MarketingProduction[],
  pick: (row: MarketingProduction) => string,
): ControlCenterLeader[] {
  const map = new Map<string, { count: number; premium: number }>();
  for (const row of rows) {
    const name = pick(row).trim() || "—";
    const cur = map.get(name) ?? { count: 0, premium: 0 };
    cur.count += 1;
    cur.premium += row.premium;
    map.set(name, cur);
  }
  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      premium: Math.round(stats.premium),
    }))
    .sort((a, b) => b.premium - a.premium || b.count - a.count);
}

function leaderFrom(
  rows: MarketingProduction[],
  pick: (row: MarketingProduction) => string,
): ControlCenterLeader | null {
  return leadersFrom(rows, pick)[0] ?? null;
}

function toDetailRow(
  row: MarketingProduction,
  dateOf: (row: MarketingProduction) => string = productionDateOf,
): ControlCenterDetailRow {
  return {
    key: row.key,
    date: dateOf(row),
    startDate: productionStartDate(row),
    transferDate: saleTransferDate(row),
    client: row.client || "—",
    agent: row.agent || "—",
    product: row.product || "—",
    company: row.company || "—",
    source: row.source || "—",
    process: row.process || "—",
    status: row.status,
    statusRaw: row.statusRaw || row.status,
    premium: Math.round(row.premium || 0),
  };
}

function sortDetailRows(rows: ControlCenterDetailRow[]): ControlCenterDetailRow[] {
  return [...rows].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.premium - a.premium ||
      a.client.localeCompare(b.client, "he"),
  );
}

function sumPremium(rows: MarketingProduction[]): number {
  return Math.round(rows.reduce((sum, row) => sum + (row.premium || 0), 0));
}

/** Display rollup from the last synced sales report. */
export function buildControlCenterSnapshot(
  data: DashboardData | null | undefined,
  now = new Date(),
  scope: ControlCenterBrandScope = ALL_BRANDS,
): ControlCenterSnapshot | null {
  if (!data || data.source !== "live") return null;

  const productions = data.marketing?.productions ?? [];
  const window = monthWindow(productions, now);
  const pendingRows = productions.filter((row) => row.status === "pending" && isReportSale(row));
  const premium = sumPremium(window.activeRows);
  const productionAllPremium = sumPremium(window.productionRows);
  const upcomingPremium = sumPremium(window.upcomingRows);
  const upcomingMonthPremium = sumPremium(window.upcomingMonthRows);
  const carriedPremium = sumPremium(window.carriedRows);

  return {
    monthKey: window.monthKey,
    monthLabel: monthLabelHe(window.monthKey),
    productions: window.activeRows.length,
    premium,
    premiumLabel: formatIls(premium),
    productionAll: window.productionRows.length,
    productionAllPremiumLabel: formatIls(productionAllPremium),
    pending: pendingRows.length || data.pending || 0,
    cancelled: window.cancelledRows.length,
    monthRows: window.inMonth.length,
    monthPremium: sumPremium(window.inMonth),
    salesCount: window.salesRows.length,
    salesPremium: sumPremium(window.salesRows),
    agentAppointmentCount: window.agentAppointmentRows.length,
    agentAppointmentPremium: sumPremium(window.agentAppointmentRows),
    agentAppointmentPremiumLabel: formatIls(sumPremium(window.agentAppointmentRows)),
    salesRangeLabel: window.rangeLabel,
    pendingInMonth: window.pendingInMonth.length,
    otherInMonth: Math.max(
      0,
      window.productionRows.length -
        window.activeRows.length -
        window.pendingInMonth.length -
        window.cancelledRows.length,
    ),
    pendingPremium: sumPremium(window.pendingInMonth),
    upcomingDate: window.upcomingDate,
    upcomingDateLabel: numericDayLabel(window.upcomingDate),
    upcomingCount: window.upcomingRows.length,
    upcomingPremium,
    upcomingPremiumLabel: formatIls(upcomingPremium),
    upcomingMonthCount: window.upcomingMonthRows.length,
    upcomingMonthPremium,
    upcomingMonthPremiumLabel: formatIls(upcomingMonthPremium),
    carriedCount: window.carriedRows.length,
    carriedPremium,
    carriedPremiumLabel: formatIls(carriedPremium),
    carriedRangeLabel: window.carriedRangeLabel,
    topAgent: leaderFrom(window.salesRows, (row) => excelAgentKey(row.agent) || "—"),
    topProduct: leaderFrom(window.salesRows, (row) => row.product),
    topSource: leaderFrom(window.salesRows, (row) => row.source),
    topCompany: leaderFrom(window.salesRows, (row) => row.company),
    syncedAt: data.syncedAt ?? null,
  };
}

function detailFromRows(
  kind: ControlCenterDetailKind,
  title: string,
  subtitle: string,
  explanation: string,
  monthLabel: string,
  rows: MarketingProduction[],
  ranking: ControlCenterLeader[] = [],
  dateOf: (row: MarketingProduction) => string = productionDateOf,
): ControlCenterDetail {
  const detailRows = sortDetailRows(rows.map((row) => toDetailRow(row, dateOf)));
  const premium = Math.round(rows.reduce((sum, row) => sum + (row.premium || 0), 0));
  return {
    kind,
    title,
    subtitle,
    explanation,
    monthLabel,
    count: detailRows.length,
    premium,
    premiumLabel: formatIls(premium),
    rows: detailRows,
    ranking,
  };
}

/** Full drill-down for a control-center cube — same filters as the KPI. */
export function buildControlCenterDetail(
  data: DashboardData | null | undefined,
  kind: ControlCenterDetailKind,
  now = new Date(),
  scope: ControlCenterBrandScope = ALL_BRANDS,
  appointmentPeriod: AgentAppointmentPeriod = { preset: "month" },
): ControlCenterDetail | null {
  if (!data || data.source !== "live") return null;
  const productions = data.marketing?.productions ?? [];
  const window = monthWindow(productions, now);
  const monthLabel = window.rangeLabel;
  const pendingRows = productions.filter((row) => row.status === "pending" && isReportSale(row));
  const saleLeaders = leadersFrom(window.salesRows, (row) => excelAgentKey(row.agent) || "—");

  switch (kind) {
    case "carried":
      return detailFromRows(
        kind,
        "נגררות",
        window.carriedRangeLabel,
        `הפקות פעילות שתחילת הביטוח שלהן ${numericDayLabel(window.upcomingDate)}, וההעברה ליצרן שלהן ב־${window.carriedRangeLabel}. עד שלושה חודשים אחורה.`,
        monthLabel,
        window.carriedRows,
        leadersFrom(window.carriedRows, (row) => excelAgentKey(row.agent) || "—"),
        productionStartDate,
      );
    case "upcoming":
      return detailFromRows(
        kind,
        `הפקות ב־${numericDayLabel(window.upcomingDate)}`,
        numericDayLabel(window.upcomingDate),
        "מכירות שכבר בסטטוס פעילה, ותאריך תחילת הביטוח שלהן הוא ה־1 לחודש הבא.",
        monthLabel,
        window.upcomingRows,
        leadersFrom(window.upcomingRows, (row) => excelAgentKey(row.agent) || "—"),
        productionStartDate,
      );
    case "premium":
      return detailFromRows(
        kind,
        "הפקה פעילה",
        monthLabel,
        "הפקה פעילה לפי תאריך תחילת ביטוח בחודש הקלנדרי.",
        monthLabel,
        window.activeRows,
        leadersFrom(window.activeRows, (row) => excelAgentKey(row.agent) || "—"),
        productionStartDate,
      );
    case "productions":
      return detailFromRows(
        kind,
        "הפקות",
        monthLabel,
        "הפקה פעילה לפי תאריך תחילת ביטוח בחודש הקלנדרי.",
        monthLabel,
        window.productionRows,
        leadersFrom(window.productionRows, (row) => excelAgentKey(row.agent) || "—"),
        productionStartDate,
      );
    case "pending":
      return detailFromRows(
        kind,
        "בתהליך",
        "כל הדוח",
        "כל שורת מכירה בסטטוס ממתין או בתהליך, מכל התאריכים בסנכרון האחרון.",
        monthLabel,
        pendingRows,
        [],
        saleTransferDate,
      );
    case "pendingMonth":
      return detailFromRows(
        kind,
        "בתהליך החודש",
        monthLabel,
        "שורות מכירה שעוד לא נסגרו, לפי תאריך העברה ליצרן בחודש.",
        monthLabel,
        window.pendingInMonth,
        [],
        saleTransferDate,
      );
    case "cancelled":
      return detailFromRows(
        kind,
        "ביטולים החודש",
        monthLabel,
        "שורות תהליך מכירה שנגנזו או בוטלו, לפי תאריך העברה ליצרן. הן נספרות כמכירה. הן לא הפקה.",
        monthLabel,
        window.cancelledRows,
        [],
        saleTransferDate,
      );
    case "monthSales":
      return detailFromRows(
        kind,
        "מכירות ללא מינוי",
        monthLabel,
        "כל שורת תהליך מכירה, בכל סטטוס. מינוי לא נכנס. התאריך הוא תאריך העברה ליצרן.",
        monthLabel,
        window.salesRows,
        saleLeaders,
        saleTransferDate,
      );
    case "agentAppointment": {
      const slice = appointmentSlice(productions, now, appointmentPeriod);
      return detailFromRows(
        kind,
        "מינוי סוכן",
        slice.label,
        "רק תהליך מינוי, בכל סטטוס, לפי תאריך העברה ליצרן. מכירה לא נכנסת.",
        slice.label,
        slice.rows,
        leadersFrom(slice.rows, (row) => excelAgentKey(row.agent) || "—"),
        saleTransferDate,
      );
    }
    case "agent": {
      const top = saleLeaders[0];
      const rows = top
        ? window.salesRows.filter((row) => (excelAgentKey(row.agent) || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "עובד מוביל",
        top?.name ?? "—",
        "העובד עם סכום הפרמיה הגבוה ביותר ממכירות בחודש. אותו מספר כמו בפילוח לפי עובד.",
        monthLabel,
        rows,
        saleLeaders,
        saleTransferDate,
      );
    }
    case "product": {
      const ranking = leadersFrom(window.salesRows, (row) => row.product);
      const top = ranking[0];
      const rows = top
        ? window.salesRows.filter((row) => (row.product.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "מוצר מוביל",
        top?.name ?? "—",
        "המוצר עם סכום הפרמיה הגבוה ביותר ממכירות בחודש.",
        monthLabel,
        rows,
        ranking,
        saleTransferDate,
      );
    }
    case "source": {
      const ranking = leadersFrom(window.salesRows, (row) => row.source);
      const top = ranking[0];
      const rows = top
        ? window.salesRows.filter((row) => (row.source.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "מקור מוביל",
        top?.name ?? "—",
        "מקור הפנייה עם סכום הפרמיה הגבוה ביותר ממכירות בחודש.",
        monthLabel,
        rows,
        ranking,
        saleTransferDate,
      );
    }
    case "company": {
      const ranking = leadersFrom(window.salesRows, (row) => row.company);
      const top = ranking[0];
      const rows = top
        ? window.salesRows.filter((row) => (row.company.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "חברת ביטוח מובילה",
        top?.name ?? "—",
        "חברת הביטוח עם סכום הפרמיה הגבוה ביותר ממכירות בחודש.",
        monthLabel,
        rows,
        ranking,
        saleTransferDate,
      );
    }
    default:
      return null;
  }
}
