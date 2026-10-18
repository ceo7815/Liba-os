import { recognizeShemeshIncome } from "@/lib/shemesh/formulas";
import {
  AD_PLATFORMS,
  EXPENSE_KINDS,
  INCOME_KINDS,
  LEAD_STATUSES,
  type AdPlatform,
  type ExpenseKind,
  type IncomeKind,
  type LeadStatus,
  type ShemeshFilter,
  type ShemeshSnapshot,
  type ShemeshSourceId,
} from "@/lib/shemesh/model";

type ExternalRow = { sourceId: string; externalId: string };

export function dedupeRows<T extends ExternalRow>(rows: T[]): { rows: T[]; dropped: number } {
  const seen = new Set<string>();
  const kept: T[] = [];
  let dropped = 0;
  for (const row of rows) {
    const key = `${row.sourceId}\0${row.externalId}`;
    if (seen.has(key)) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    kept.push(row);
  }
  return { rows: kept, dropped };
}

export function prepareSnapshot(snapshot: ShemeshSnapshot): {
  snapshot: ShemeshSnapshot;
  dropped: number;
} {
  const leads = dedupeRows(snapshot.leads);
  const spend = dedupeRows(snapshot.spend);
  const revenue = dedupeRows(snapshot.revenue);
  const expenses = dedupeRows(snapshot.expenses);
  return {
    snapshot: {
      leads: leads.rows,
      spend: spend.rows,
      revenue: revenue.rows,
      expenses: expenses.rows,
    },
    dropped: leads.dropped + spend.dropped + revenue.dropped + expenses.dropped,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function inRange(day: string, filter: ShemeshFilter): boolean {
  return day >= filter.from && day <= filter.to;
}

function matchesPlatform(platform: AdPlatform | null, filter: ShemeshFilter): boolean {
  return filter.adPlatform === "all" || platform === filter.adPlatform;
}

function matchesCampaign(campaignId: string | null, filter: ShemeshFilter): boolean {
  return filter.campaignId === "all" || campaignId === filter.campaignId;
}

function monthKey(day: string): string {
  return day.slice(0, 7);
}

export type ShemeshView = {
  droppedDuplicates: number;
  marketing: {
    spend: number | null;
    leads: number | null;
    cpl: number | null;
    byPlatform: { platform: AdPlatform; spend: number; leads: number; cpl: number | null }[];
    byCampaign: { campaignId: string; campaignName: string; spend: number; leads: number; cpl: number | null }[];
  };
  leads: {
    total: number | null;
    converted: number | null;
    conversionRate: number | null;
    byStatus: { status: LeadStatus; count: number }[];
    byOrigin: { sourceId: ShemeshSourceId; count: number }[];
    byDay: { day: string; count: number }[];
  };
  revenue: {
    recorded: number | null;
    byKind: { kind: IncomeKind; amount: number | null }[];
    recognition: ReturnType<typeof recognizeShemeshIncome>;
  };
  expenses: {
    total: number | null;
    salaryCount: number | null;
    byKind: { kind: ExpenseKind; amount: number | null }[];
  };
  reports: {
    mode: "company" | "media";
    recordedIncome: number | null;
    adSpend: number | null;
    expenses: number | null;
    result: number | null;
    byMonth: {
      month: string;
      recordedIncome: number;
      adSpend: number;
      expenses: number;
      result: number;
    }[];
    byPlatform: {
      platform: AdPlatform;
      recordedIncome: number;
      adSpend: number;
      mediaResult: number;
    }[];
  };
};

function cpl(spend: number, leads: number): number | null {
  if (leads <= 0) return null;
  return roundMoney(spend / leads);
}

export function buildShemeshView(input: ShemeshSnapshot, filter: ShemeshFilter): ShemeshView {
  const prepared = prepareSnapshot(input);
  const snapshot = prepared.snapshot;
  const companyScope =
    filter.adPlatform === "all" && filter.campaignId === "all" && filter.incomeKind === "all";

  const leads = snapshot.leads.filter(
    (row) =>
      inRange(row.arrivedOn, filter) &&
      matchesPlatform(row.adPlatform, filter) &&
      matchesCampaign(row.campaignId, filter),
  );
  const spend = snapshot.spend.filter(
    (row) =>
      inRange(row.day, filter) &&
      matchesPlatform(row.adPlatform, filter) &&
      matchesCampaign(row.campaignId, filter),
  );
  const revenue = snapshot.revenue.filter(
    (row) =>
      inRange(row.day, filter) &&
      matchesPlatform(row.adPlatform, filter) &&
      matchesCampaign(row.campaignId, filter) &&
      (filter.incomeKind === "all" || row.kind === filter.incomeKind),
  );
  const expenses = snapshot.expenses.filter((row) => inRange(row.day, filter));

  const spendTotal = snapshot.spend.length === 0 ? null : sum(spend.map((row) => row.spend));
  const leadTotal = snapshot.leads.length === 0 ? null : leads.length;
  const recorded =
    snapshot.revenue.length === 0 ? null : sum(revenue.map((row) => row.amount));
  const expenseTotal =
    snapshot.expenses.length === 0 ? null : sum(expenses.map((row) => row.amount));

  const byPlatform = AD_PLATFORMS.map((platform) => {
    const platformSpend = sum(
      spend.filter((row) => row.adPlatform === platform).map((row) => row.spend),
    );
    const platformLeads = leads.filter((row) => row.adPlatform === platform).length;
    return {
      platform,
      spend: platformSpend,
      leads: platformLeads,
      cpl: cpl(platformSpend, platformLeads),
    };
  }).filter((row) => row.spend !== 0 || row.leads !== 0);

  const campaigns = new Map<string, { campaignName: string; spend: number; leads: number }>();
  for (const row of spend) {
    const current = campaigns.get(row.campaignId) ?? {
      campaignName: row.campaignName,
      spend: 0,
      leads: 0,
    };
    current.spend = roundMoney(current.spend + row.spend);
    current.campaignName = row.campaignName || current.campaignName;
    campaigns.set(row.campaignId, current);
  }
  for (const row of leads) {
    if (!row.campaignId) continue;
    const current = campaigns.get(row.campaignId) ?? {
      campaignName: row.campaignName ?? row.campaignId,
      spend: 0,
      leads: 0,
    };
    current.leads += 1;
    if (row.campaignName) current.campaignName = row.campaignName;
    campaigns.set(row.campaignId, current);
  }

  const originCounts = new Map<ShemeshSourceId, number>();
  for (const row of leads) {
    originCounts.set(row.sourceId, (originCounts.get(row.sourceId) ?? 0) + 1);
  }
  const dayCounts = new Map<string, number>();
  for (const row of leads) {
    dayCounts.set(row.arrivedOn, (dayCounts.get(row.arrivedOn) ?? 0) + 1);
  }

  const converted = leads.filter((row) => row.status === "converted").length;
  const incomeByMonth = new Map<string, number>();
  const spendByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  for (const row of revenue) {
    const key = monthKey(row.day);
    incomeByMonth.set(key, roundMoney((incomeByMonth.get(key) ?? 0) + row.amount));
  }
  for (const row of spend) {
    const key = monthKey(row.day);
    spendByMonth.set(key, roundMoney((spendByMonth.get(key) ?? 0) + row.spend));
  }
  if (companyScope) {
    for (const row of expenses) {
      const key = monthKey(row.day);
      expenseByMonth.set(key, roundMoney((expenseByMonth.get(key) ?? 0) + row.amount));
    }
  }

  const months = [...new Set([...incomeByMonth.keys(), ...spendByMonth.keys(), ...expenseByMonth.keys()])].sort();

  const result = companyResult(recorded, spendTotal, expenseTotal, companyScope);

  return {
    droppedDuplicates: prepared.dropped,
    marketing: {
      spend: spendTotal,
      leads: leadTotal,
      cpl: spendTotal == null || leadTotal == null ? null : cpl(spendTotal, leadTotal),
      byPlatform,
      byCampaign: [...campaigns.entries()].map(([campaignId, row]) => ({
        campaignId,
        campaignName: row.campaignName,
        spend: row.spend,
        leads: row.leads,
        cpl: cpl(row.spend, row.leads),
      })),
    },
    leads: {
      total: leadTotal,
      converted: snapshot.leads.length === 0 ? null : converted,
      conversionRate:
        leadTotal == null || leadTotal === 0 ? null : roundMoney(converted / leadTotal),
      byStatus: LEAD_STATUSES.map((status) => ({
        status,
        count: leads.filter((row) => row.status === status).length,
      })),
      byOrigin: [...originCounts.entries()].map(([sourceId, count]) => ({ sourceId, count })),
      byDay: [...dayCounts.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    },
    revenue: {
      recorded,
      byKind: INCOME_KINDS.map((kind) => ({
        kind,
        amount:
          snapshot.revenue.length === 0
            ? null
            : sum(revenue.filter((row) => row.kind === kind).map((row) => row.amount)),
      })),
      recognition: recognizeShemeshIncome(),
    },
    expenses: {
      total: expenseTotal,
      salaryCount:
        snapshot.expenses.length === 0
          ? null
          : expenses.filter((row) => row.kind === "salary").length,
      byKind: EXPENSE_KINDS.map((kind) => ({
        kind,
        amount:
          snapshot.expenses.length === 0
            ? null
            : sum(expenses.filter((row) => row.kind === kind).map((row) => row.amount)),
      })),
    },
    reports: {
      mode: companyScope ? "company" : "media",
      recordedIncome: recorded,
      adSpend: spendTotal,
      expenses: companyScope ? expenseTotal : null,
      result,
      byMonth: months.map((month) => {
        const recordedIncome = incomeByMonth.get(month) ?? 0;
        const adSpend = spendByMonth.get(month) ?? 0;
        const monthExpenses = companyScope ? expenseByMonth.get(month) ?? 0 : 0;
        return {
          month,
          recordedIncome,
          adSpend,
          expenses: monthExpenses,
          result: roundMoney(recordedIncome - adSpend - monthExpenses),
        };
      }),
      byPlatform: AD_PLATFORMS.map((platform) => {
        const recordedIncome = sum(
          revenue.filter((row) => row.adPlatform === platform).map((row) => row.amount),
        );
        const adSpend = sum(
          spend.filter((row) => row.adPlatform === platform).map((row) => row.spend),
        );
        return {
          platform,
          recordedIncome,
          adSpend,
          mediaResult: roundMoney(recordedIncome - adSpend),
        };
      }).filter((row) => row.recordedIncome !== 0 || row.adSpend !== 0),
    },
  };
}

function companyResult(
  income: number | null,
  spend: number | null,
  expenses: number | null,
  companyScope: boolean,
): number | null {
  if (income == null && spend == null && expenses == null) return null;
  if (!companyScope) {
    if (income == null && spend == null) return null;
    return roundMoney((income ?? 0) - (spend ?? 0));
  }
  return roundMoney((income ?? 0) - (spend ?? 0) - (expenses ?? 0));
}

export function campaignOptions(snapshot: ShemeshSnapshot): { id: string; name: string }[] {
  const names = new Map<string, string>();
  for (const row of snapshot.spend) names.set(row.campaignId, row.campaignName);
  for (const row of snapshot.leads) {
    if (row.campaignId && row.campaignName) names.set(row.campaignId, row.campaignName);
  }
  for (const row of snapshot.revenue) {
    if (row.campaignId && !names.has(row.campaignId)) names.set(row.campaignId, row.campaignId);
  }
  return [...names.entries()].map(([id, name]) => ({ id, name }));
}

export function defaultShemeshRange(now = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${day}` };
}
