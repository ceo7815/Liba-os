export type NamedCount = {
  name: string;
  count: number;
};

export type AgentStat = {
  name: string;
  count: number;
  sum: number;
};

export type TrendSeries = {
  labels: string[];
  counts: number[];
  sums: number[];
};

export type CurrentMonth = {
  label: string;
  totalCount: number;
  totalSum: number;
  activeCount: number;
  activeSum: number;
};

export type PendingRow = {
  name: string;
  agent: string;
  product: string;
  premium: number;
  date: string;
};

export type SaleAlert = {
  key: string;
  client: string;
  product: string;
  company: string;
  premium: number;
  agent: string;
};

export type DashboardSource = "live" | "demo";

/** Referral-source rollup for the marketing dashboard. Premium is active-only. */
export type MarketingProductionStatus = "active" | "pending" | "cancelled" | "other";

export type MarketingProduction = {
  key: string;
  source: string;
  client: string;
  agent: string;
  product: string;
  company: string;
  premium: number;
  status: MarketingProductionStatus;
  statusRaw: string;
  process: string;
  startDate: string;
  transferDate: string;
  /** Every Excel column for this row, original header → display value. */
  fields: Record<string, string>;
};

export type MarketingSource = {
  name: string;
  activeCount: number;
  activePremium: number;
  pendingCount: number;
  pendingPremium: number;
  agents: AgentStat[];
  months: AgentStat[];
  products: AgentStat[];
  companies: AgentStat[];
};

export type MarketingOverview = {
  activeCount: number;
  activePremium: number;
  pendingCount: number;
  pendingPremium: number;
  cancelledCount: number;
  cancelledPremium: number;
  sources: MarketingSource[];
  /** Every מקור הפנייה value in the workbook, including rows we don't count yet. */
  sourceCatalog: string[];
  /** Every distinct משווק (and helper-list people) — exact Excel spelling. */
  sellerCatalog: string[];
  /** Excel column headers in file order — shown in the source popup. */
  excelHeaders: string[];
  productions: MarketingProduction[];
  agents: AgentStat[];
  months: AgentStat[];
  products: AgentStat[];
  companies: AgentStat[];
};

export type DashboardData = {
  active: number;
  premium: number;
  pending: number;
  issues: number;
  agents: AgentStat[];
  monthAgents: AgentStat[];
  companies: NamedCount[];
  sources: NamedCount[];
  sales: TrendSeries;
  appointments: TrendSeries;
  currentMonth: CurrentMonth;
  pendingRows: PendingRow[];
  activePolicies: SaleAlert[];
  marketing?: MarketingOverview;
  fileName: string | null;
  syncedAt: string;
  source: DashboardSource;
  error?: string;
};

export function hasMarketingOverview(
  data: DashboardData | null | undefined,
): data is DashboardData & { marketing: MarketingOverview } {
  return Boolean(data?.marketing);
}
