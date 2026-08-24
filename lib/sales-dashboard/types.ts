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
  fileName: string | null;
  syncedAt: string;
  source: DashboardSource;
  error?: string;
};
