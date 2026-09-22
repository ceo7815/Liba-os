import { matchesSourcePnlKind, normalizeExcelText } from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import {
  canonicalCampaignSource,
  facebookAdsRollup,
  googleAdsRollup,
  inDateRange,
  isoDay,
  sourceMatchesCampaignName,
  type DateRange,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";

/** Below 50% premium vs ads is a loss (red). At 50% and above is green. */
export const SALES_BY_SOURCE_MARGIN_THRESHOLD = 0.5;
export const UNLABELED_SALES_SOURCE = "ללא מקור";

export const SALES_STATUS_LABEL: Record<MarketingProduction["status"], string> = {
  active: "נשלמה",
  pending: "עוד לא הופקה",
  cancelled: "נפלה",
  other: "עוד לא הופקה",
};

export type SalesMarginTone = "green" | "red" | "gray";
export type SaleDateKind = "transfer" | "start" | "none";

export type SalesAdsLine = {
  channel: "google" | "facebook";
  name: string;
  cost: number;
};

export type SalesAgentRollup = {
  agent: string;
  count: number;
  pendingCount: number;
  activatedCount: number;
  premium: number;
};

export function isSaleProcess(process: string): boolean {
  return matchesSourcePnlKind(process, "volume");
}

export function isCountedStatus(status: MarketingProduction["status"]): boolean {
  return status !== "cancelled";
}

export type SalePipelineStage = "pending" | "active" | "cancelled";

/** Completed sale vs not-yet-produced, from parsed status and Excel raw status. */
export function salePipelineStage(
  row: Pick<MarketingProduction, "status" | "statusRaw">,
): SalePipelineStage {
  const raw = normalizeExcelText(row.statusRaw || "");
  if (row.status === "active" || raw === "פעילה" || raw === "פעיל") return "active";
  if (
    row.status === "cancelled" ||
    raw === "גניזה" ||
    raw.includes("בוטל") ||
    raw.includes("דחי") ||
    raw.includes("נדח")
  ) {
    return "cancelled";
  }
  return "pending";
}

export function isCompletedSale(row: Pick<MarketingProduction, "status" | "statusRaw">): boolean {
  return salePipelineStage(row) === "active";
}

export function isAwaitingProduction(
  row: Pick<MarketingProduction, "status" | "statusRaw">,
): boolean {
  return salePipelineStage(row) === "pending";
}

/** Campaign date: transfer to insurer, else policy start so pending still counts. */
export function saleDateOf(
  row: Pick<MarketingProduction, "transferDate" | "startDate">,
): string {
  return isoDay(row.transferDate) || isoDay(row.startDate);
}

export function saleDateKind(
  row: Pick<MarketingProduction, "transferDate" | "startDate">,
): SaleDateKind {
  if (isoDay(row.transferDate)) return "transfer";
  if (isoDay(row.startDate)) return "start";
  return "none";
}

export function namedSalesSource(source: string): string {
  return canonicalCampaignSource(source) || UNLABELED_SALES_SOURCE;
}

/** Premium vs source ads. 2000 premium + 4000 ads = 50%. */
export function salesAdsShare(premium: number, ads: number): number | null {
  if (!(ads > 0)) return null;
  if (!(premium > 0)) return 0;
  return premium / ads;
}

/** Integer percent shown on the cube. Color uses this same number. */
export function salesAdsPercent(premium: number, ads: number): number | null {
  const share = salesAdsShare(premium, ads);
  if (share == null) return null;
  return Math.round(share * 100);
}

export function salesAdsTone(premium: number, ads: number): SalesMarginTone {
  if (premium > 0 && !(ads > 0)) return "green";
  const percent = salesAdsPercent(premium, ads);
  if (percent == null) return "gray";
  return percent >= 50 ? "green" : "red";
}

export function formatIsoDayHe(iso: string): string {
  const day = isoDay(iso);
  if (!day) return "—";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

export function formatSaleDateHe(
  row: Pick<MarketingProduction, "transferDate" | "startDate">,
): { day: string; kind: SaleDateKind } {
  const kind = saleDateKind(row);
  return { day: formatIsoDayHe(saleDateOf(row)), kind };
}

const STATUS_SORT: Record<MarketingProduction["status"], number> = {
  pending: 0,
  active: 1,
  cancelled: 2,
  other: 3,
};

export function sortSalesPipelineRows(
  rows: MarketingProduction[],
): MarketingProduction[] {
  return [...rows].sort((a, b) => {
    const status = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (status) return status;
    const dayA = saleDateOf(a);
    const dayB = saleDateOf(b);
    if (dayA !== dayB) return dayB.localeCompare(dayA);
    const agent = a.agent.localeCompare(b.agent, "he");
    if (agent) return agent;
    return a.client.localeCompare(b.client, "he");
  });
}

export function groupSalesByAgent(rows: MarketingProduction[]): SalesAgentRollup[] {
  const map = new Map<string, SalesAgentRollup>();
  for (const row of rows) {
    if (salePipelineStage(row) === "cancelled") continue;
    const agent = row.agent?.trim() || "—";
    const current = map.get(agent) ?? {
      agent,
      count: 0,
      pendingCount: 0,
      activatedCount: 0,
      premium: 0,
    };
    current.count += 1;
    current.premium += row.premium;
    if (isAwaitingProduction(row)) current.pendingCount += 1;
    if (isCompletedSale(row)) current.activatedCount += 1;
    map.set(agent, current);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.premium - a.premium || a.agent.localeCompare(b.agent, "he"),
  );
}

export function spendForSource(
  map: Record<string, number> | undefined,
  sourceName: string,
): number {
  if (!map) return 0;
  return map[canonicalCampaignSource(sourceName)] ?? 0;
}

export type SalesBySourceCube = {
  name: string;
  rows: MarketingProduction[];
  countedRows: MarketingProduction[];
  agents: SalesAgentRollup[];
  adsLines: SalesAdsLine[];
  countedCount: number;
  pendingCount: number;
  activatedCount: number;
  leakedCount: number;
  pendingPremium: number;
  activatedPremium: number;
  countedPremium: number;
  leakedPremium: number;
  adsTotal: number;
  googleAds: number;
  facebookAds: number;
  /** מכירה premium ÷ ads (pending + produced, once). */
  marginRatio: number | null;
  /** Rounded percent shown on the cube — same number as the color. */
  percent: number | null;
  tone: SalesMarginTone;
};

export function buildSalesBySourceCube(input: {
  name: string;
  productions: MarketingProduction[];
  range: DateRange;
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: GoogleAdsDailyStat[];
  googleSpendBySource?: Record<string, number>;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: FacebookAdsDailyStat[];
  facebookSpendBySource?: Record<string, number>;
  includeGoogleAds: boolean;
  includeFacebookAds: boolean;
}): SalesBySourceCube {
  const inRange = input.productions.filter(
    (row) =>
      sourceMatchesCampaignName(namedSalesSource(row.source), input.name) &&
      inDateRange(saleDateOf(row), input.range),
  );
  const pending = inRange.filter((row) => isAwaitingProduction(row));
  const activated = inRange.filter((row) => isCompletedSale(row));
  const leaked = inRange.filter((row) => salePipelineStage(row) === "cancelled");
  const countedRows = sortSalesPipelineRows([...pending, ...activated]);
  const pendingPremium = pending.reduce((sum, row) => sum + row.premium, 0);
  const activatedPremium = activated.reduce((sum, row) => sum + row.premium, 0);
  const countedPremium = pendingPremium + activatedPremium;
  const leakedPremium = leaked.reduce((sum, row) => sum + row.premium, 0);

  const google = input.includeGoogleAds
    ? googleAdsRollup(
        input.name,
        input.googleCampaigns,
        input.googleStats,
        input.range,
      )
    : { cost: 0, campaigns: [] as { googleCampaignName: string; cost: number }[] };
  const facebook = input.includeFacebookAds
    ? facebookAdsRollup(
        input.name,
        input.facebookCampaigns,
        input.facebookStats,
        input.range,
      )
    : {
        cost: 0,
        campaigns: [] as { facebookCampaignName: string; cost: number }[],
      };

  const googleAds = input.includeGoogleAds
    ? spendForSource(input.googleSpendBySource, input.name) || google.cost
    : 0;
  const facebookAds = input.includeFacebookAds
    ? spendForSource(input.facebookSpendBySource, input.name) || facebook.cost
    : 0;
  const adsTotal = googleAds + facebookAds;
  const adsLines: SalesAdsLine[] = [
    ...google.campaigns
      .filter((row) => row.cost > 0)
      .map((row) => ({
        channel: "google" as const,
        name: row.googleCampaignName,
        cost: row.cost,
      })),
    ...facebook.campaigns
      .filter((row) => row.cost > 0)
      .map((row) => ({
        channel: "facebook" as const,
        name: row.facebookCampaignName,
        cost: row.cost,
      })),
  ].sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name, "he"));

  return {
    name: input.name,
    rows: sortSalesPipelineRows([...countedRows, ...leaked]),
    countedRows,
    agents: groupSalesByAgent(countedRows),
    adsLines,
    countedCount: countedRows.length,
    pendingCount: pending.length,
    activatedCount: activated.length,
    leakedCount: leaked.length,
    pendingPremium,
    activatedPremium,
    countedPremium,
    leakedPremium,
    adsTotal,
    googleAds,
    facebookAds,
    marginRatio: salesAdsShare(countedPremium, adsTotal),
    percent: salesAdsPercent(countedPremium, adsTotal),
    tone: salesAdsTone(countedPremium, adsTotal),
  };
}

export function isEmptySalesCube(card: SalesBySourceCube): boolean {
  return card.countedCount === 0 && card.leakedCount === 0 && card.adsTotal <= 0;
}

export function sumSalesBySourceCubes(cubes: SalesBySourceCube[]): {
  countedCount: number;
  pendingCount: number;
  activatedCount: number;
  leakedCount: number;
  pendingPremium: number;
  activatedPremium: number;
  countedPremium: number;
  adsTotal: number;
  googleAds: number;
  facebookAds: number;
  tone: SalesMarginTone;
  marginRatio: number | null;
  percent: number | null;
} {
  const totals = cubes.reduce(
    (acc, card) => ({
      countedCount: acc.countedCount + card.countedCount,
      pendingCount: acc.pendingCount + card.pendingCount,
      activatedCount: acc.activatedCount + card.activatedCount,
      leakedCount: acc.leakedCount + card.leakedCount,
      pendingPremium: acc.pendingPremium + card.pendingPremium,
      activatedPremium: acc.activatedPremium + card.activatedPremium,
      countedPremium: acc.countedPremium + card.countedPremium,
      adsTotal: acc.adsTotal + card.adsTotal,
      googleAds: acc.googleAds + card.googleAds,
      facebookAds: acc.facebookAds + card.facebookAds,
    }),
    {
      countedCount: 0,
      pendingCount: 0,
      activatedCount: 0,
      leakedCount: 0,
      pendingPremium: 0,
      activatedPremium: 0,
      countedPremium: 0,
      adsTotal: 0,
      googleAds: 0,
      facebookAds: 0,
    },
  );
  return {
    ...totals,
    marginRatio: salesAdsShare(totals.countedPremium, totals.adsTotal),
    percent: salesAdsPercent(totals.countedPremium, totals.adsTotal),
    tone: salesAdsTone(totals.countedPremium, totals.adsTotal),
  };
}
