import {
  productionDateOf,
  productionMonthKey,
  wageMonthKeyFromIso,
} from "@/lib/employees/contract";
import { formatIls, jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import { HEBREW_MONTHS, matchesSourcePnlKind } from "@/lib/sales-dashboard/columns";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";

export type ControlCenterLeader = {
  name: string;
  count: number;
  premium: number;
};

export type ControlCenterSnapshot = {
  monthKey: string;
  monthLabel: string;
  /** Active sales (מכירה) in the wage/production month. */
  productions: number;
  /** Premium of those active sales. */
  premium: number;
  premiumLabel: string;
  /** Open pending appointments (pipeline). */
  pending: number;
  /** Cancelled rows in the month. */
  cancelled: number;
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
  | "cancelled"
  | "agent"
  | "product"
  | "source"
  | "company";

export type ControlCenterDetailRow = {
  key: string;
  date: string;
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

function currentWageMonthKey(now = new Date()): string {
  return wageMonthKeyFromIso(jerusalemYmd(now));
}

function isActiveSale(row: MarketingProduction): boolean {
  return row.status === "active" && matchesSourcePnlKind(row.process, "volume");
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

function toDetailRow(row: MarketingProduction): ControlCenterDetailRow {
  return {
    key: row.key,
    date: productionDateOf(row),
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

type MonthSlices = {
  monthKey: string;
  monthLabel: string;
  productions: MarketingProduction[];
  inMonth: MarketingProduction[];
  activeSales: MarketingProduction[];
  cancelledRows: MarketingProduction[];
  pendingRows: MarketingProduction[];
};

function slicesFrom(
  data: DashboardData,
  now = new Date(),
): MonthSlices {
  const monthKey = currentWageMonthKey(now);
  const productions = data.marketing?.productions ?? [];
  const inMonth = productions.filter((row) => productionMonthKey(row) === monthKey);
  return {
    monthKey,
    monthLabel: monthLabelHe(monthKey),
    productions,
    inMonth,
    activeSales: inMonth.filter(isActiveSale),
    cancelledRows: inMonth.filter((row) => row.status === "cancelled"),
    pendingRows: productions.filter((row) => row.status === "pending"),
  };
}

/** Display-only rollup from the last synced workbook — no wage formulas. */
export function buildControlCenterSnapshot(
  data: DashboardData | null | undefined,
  now = new Date(),
): ControlCenterSnapshot | null {
  if (!data || data.source !== "live") return null;

  const { monthKey, monthLabel, activeSales, cancelledRows, pendingRows } =
    slicesFrom(data, now);
  const premium = Math.round(
    activeSales.reduce((sum, row) => sum + (row.premium || 0), 0),
  );

  return {
    monthKey,
    monthLabel,
    productions: activeSales.length,
    premium,
    premiumLabel: formatIls(premium),
    pending: pendingRows.length || data.pending || 0,
    cancelled: cancelledRows.length,
    topAgent: leaderFrom(activeSales, (row) => row.agent),
    topProduct: leaderFrom(activeSales, (row) => row.product),
    topSource: leaderFrom(activeSales, (row) => row.source),
    topCompany: leaderFrom(activeSales, (row) => row.company),
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
): ControlCenterDetail {
  const detailRows = sortDetailRows(rows.map(toDetailRow));
  const premium = Math.round(detailRows.reduce((sum, row) => sum + row.premium, 0));
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
): ControlCenterDetail | null {
  if (!data || data.source !== "live") return null;
  const { monthLabel, activeSales, cancelledRows, pendingRows } = slicesFrom(data, now);

  switch (kind) {
    case "premium":
    case "productions":
      return detailFromRows(
        kind,
        kind === "premium" ? "פרמיה פעילה החודש" : "הפקות החודש",
        monthLabel,
        "מכירות פעילות (סוג תהליך מכירה + סטטוס פעילה) לפי חודש הפקה/שכר. סכום הפרמיה הוא סכום השורות האלה.",
        monthLabel,
        activeSales,
        leadersFrom(activeSales, (row) => row.agent).slice(0, 8),
      );
    case "pending":
      return detailFromRows(
        kind,
        "ממתינות למינוי",
        "צינור פתוח",
        "כל ההפקות בסטטוס ממתין / בתהליך מהסנכרון האחרון — גם אם תאריך ההפקה בחודש אחר.",
        monthLabel,
        pendingRows,
      );
    case "cancelled":
      return detailFromRows(
        kind,
        "ביטולים החודש",
        monthLabel,
        "הפקות שבוטלו / בגניזה בחודש ההפקה הנוכחי.",
        monthLabel,
        cancelledRows,
      );
    case "agent": {
      const ranking = leadersFrom(activeSales, (row) => row.agent);
      const top = ranking[0];
      const rows = top
        ? activeSales.filter((row) => (row.agent.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "עובד מוביל",
        top?.name ?? "—",
        "העובד עם סכום הפרמיה הגבוה ביותר ממכירות פעילות בחודש. למטה הדירוג המלא וההפקות שלו.",
        monthLabel,
        rows,
        ranking.slice(0, 10),
      );
    }
    case "product": {
      const ranking = leadersFrom(activeSales, (row) => row.product);
      const top = ranking[0];
      const rows = top
        ? activeSales.filter((row) => (row.product.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "מוצר מוביל",
        top?.name ?? "—",
        "המוצר עם סכום הפרמיה הגבוה ביותר ממכירות פעילות בחודש.",
        monthLabel,
        rows,
        ranking.slice(0, 10),
      );
    }
    case "source": {
      const ranking = leadersFrom(activeSales, (row) => row.source);
      const top = ranking[0];
      const rows = top
        ? activeSales.filter((row) => (row.source.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "מקור מוביל",
        top?.name ?? "—",
        "מקור הפנייה עם סכום הפרמיה הגבוה ביותר ממכירות פעילות בחודש.",
        monthLabel,
        rows,
        ranking.slice(0, 10),
      );
    }
    case "company": {
      const ranking = leadersFrom(activeSales, (row) => row.company);
      const top = ranking[0];
      const rows = top
        ? activeSales.filter((row) => (row.company.trim() || "—") === top.name)
        : [];
      return detailFromRows(
        kind,
        "חברת ביטוח מובילה",
        top?.name ?? "—",
        "חברת הביטוח עם סכום הפרמיה הגבוה ביותר ממכירות פעילות בחודש.",
        monthLabel,
        rows,
        ranking.slice(0, 10),
      );
    }
    default:
      return null;
  }
}
