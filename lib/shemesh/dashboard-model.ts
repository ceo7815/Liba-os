import { CASE_STAGES, type CaseStageId } from "@/lib/shemesh/catalog";
import type { GviyaDeal } from "@/lib/shemesh/gviya";
import { formatShemeshDay } from "@/lib/shemesh/format";
import { daysBetween } from "@/lib/shemesh/lifecycle";

export type DashRange = { from: string; to: string };

export type DashCase = {
  id: string;
  clientName: string;
  stage: string;
  status: string;
  handler: string;
  openedOn: string;
  deadline: string | null;
  overdue: boolean;
  missingDocs: number;
};

export type DashLedger = {
  id: string;
  client: string;
  status: string;
  fee: number | null;
  day: string;
};

export type DashDraft = {
  id: string;
  period: string;
  status: "draft" | "approved" | "paid";
  liba: number | null;
  insurance: number | null;
  redemption: number | null;
};

export type DashCampaign = { name: string; channel: string; spend: number; leads: number; cpl: number | null };

export type DashAudit = { id: string; summary: string; createdAt: string };

export type DashInput = {
  hasWorkbook: boolean;
  deals: GviyaDeal[];
  cases: DashCase[];
  ledger: DashLedger[];
  ratesPending: boolean;
  slaDays: number | null;
  drafts: DashDraft[];
  campaigns: DashCampaign[];
  audit: DashAudit[];
  today: string;
};

export type AttentionItem = { id: string; title: string; detail: string; href: string };

export type DashView = {
  salesReady: boolean;
  sold: number | null;
  soldPrev: number | null;
  collected: number | null;
  collectedPrev: number | null;
  openToCollect: number | null;
  openToCollectPrev: number | null;
  dealCount: number | null;
  sparkSold: number[];
  sparkCollected: number[];
  activeCases: number;
  activeCasesPrev: number;
  slaBreaches: number;
  attention: {
    sla: AttentionItem[];
    docs: AttentionItem[];
    deadlines: AttentionItem[];
    unassigned: AttentionItem[];
    stale: AttentionItem[];
    stalePending: boolean;
  };
  funnel: { id: CaseStageId; label: string; count: number; conversion: number | null; avgDays: number | null }[];
  trend: { month: string; collected: number }[];
  feesPending: boolean;
  openFeeRows: number;
  openFeeKnown: number | null;
  settlement: DashDraft | null;
  sources: { name: string; deals: number; cases: number }[];
  cpl: number | null;
  leadToCase: number | null;
  team: { handler: string; cases: number; sla: number }[];
  activity: DashAudit[];
};

const ACTIVE = new Set(["open", "waiting", "on_hold"]);

export function previousRange(range: DashRange): DashRange | null {
  const span = daysBetween(range.from, range.to);
  if (span == null) return null;
  const length = span + 1;
  const to = shiftIso(range.from, -1);
  const from = shiftIso(to, -(length - 1));
  return { from, to };
}

export function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inRange(iso: string | null | undefined, range: DashRange): boolean {
  return Boolean(iso && iso >= range.from && iso <= range.to);
}

function dealsIn(deals: GviyaDeal[], range: DashRange, source: string): GviyaDeal[] {
  return deals.filter((deal) => inRange(deal.dealDate, range) && (source === "all" || deal.source === source));
}

function sumSales(deals: GviyaDeal[]) {
  const sold = deals.reduce((sum, deal) => sum + deal.dealAmount, 0);
  const collected = deals.reduce((sum, deal) => sum + deal.collected, 0);
  const open = deals.reduce((sum, deal) => sum + Math.max(0, deal.dealAmount - deal.collected), 0);
  return { sold, collected, open, count: deals.length };
}

function activeIn(cases: DashCase[], range: DashRange): DashCase[] {
  return cases.filter((item) => ACTIVE.has(item.status) && inRange(item.openedOn, range));
}

export function buildDashboard(input: DashInput, range: DashRange, source: string): DashView {
  const prev = previousRange(range);
  const currentDeals = input.hasWorkbook ? dealsIn(input.deals, range, source) : [];
  const previousDeals = input.hasWorkbook && prev ? dealsIn(input.deals, prev, source) : [];
  const now = input.hasWorkbook ? sumSales(currentDeals) : null;
  const before = input.hasWorkbook && prev ? sumSales(previousDeals) : null;
  const months = new Map<string, { sold: number; collected: number }>();
  if (input.hasWorkbook) {
    for (const deal of input.deals) {
      if (!deal.dealDate || (source !== "all" && deal.source !== source)) continue;
      const month = deal.dealDate.slice(0, 7);
      const row = months.get(month) ?? { sold: 0, collected: 0 };
      row.sold += deal.dealAmount;
      row.collected += deal.collected;
      months.set(month, row);
    }
  }
  const trend = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const active = activeIn(input.cases, range);
  const activePrev = prev ? activeIn(input.cases, prev).length : 0;
  const slaCases = input.cases.filter((item) => item.overdue && (inRange(item.deadline, range) || inRange(item.openedOn, range)));
  const docCases = input.cases.filter((item) => item.missingDocs > 0 && ACTIVE.has(item.status) && (inRange(item.openedOn, range) || inRange(item.deadline, range)));
  const dueCases = input.cases.filter((item) => ACTIVE.has(item.status) && inRange(item.deadline, range));
  const unassigned = input.cases.filter((item) => ACTIVE.has(item.status) && !item.handler.trim() && inRange(item.openedOn, range));
  const stalePending = input.slaDays == null;
  const stale = stalePending
    ? []
    : input.cases.filter((item) => {
        if (item.stage !== "lead" || !ACTIVE.has(item.status) || !item.openedOn) return false;
        const age = daysBetween(item.openedOn, input.today);
        return age != null && age > (input.slaDays as number) && inRange(item.openedOn, range);
      });

  const stageCases = input.cases.filter((item) => item.status !== "cancelled" && inRange(item.openedOn, range));
  const funnel = CASE_STAGES.map((stage, index) => {
    const rows = stageCases.filter((item) => item.stage === stage.id);
    const previous = index === 0 ? null : stageCases.filter((item) => item.stage === CASE_STAGES[index - 1].id).length;
    const ages = rows
      .map((item) => daysBetween(item.openedOn, input.today))
      .filter((value): value is number => value != null);
    return {
      id: stage.id,
      label: stage.label,
      count: rows.length,
      conversion: previous != null && previous > 0 ? Math.round((rows.length / previous) * 100) : null,
      avgDays: ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : null,
    };
  });

  const openRows = input.ledger.filter((row) => row.status === "open" || row.status === "waiting");
  const knownFees = openRows.map((row) => row.fee).filter((fee): fee is number => fee != null);
  const bySource = new Map<string, { deals: number; cases: number }>();
  if (input.hasWorkbook) {
    for (const deal of currentDeals) {
      const name = deal.source || "בלי מקור";
      const row = bySource.get(name) ?? { deals: 0, cases: 0 };
      row.deals += 1;
      bySource.set(name, row);
    }
  }
  const adSpend = input.campaigns.reduce((sum, row) => sum + row.spend, 0);
  const adLeads = input.campaigns.reduce((sum, row) => sum + row.leads, 0);
  const handlers = new Map<string, { cases: number; sla: number }>();
  for (const item of active) {
    const name = item.handler.trim() || "בלי מטפל";
    const row = handlers.get(name) ?? { cases: 0, sla: 0 };
    row.cases += 1;
    if (item.overdue) row.sla += 1;
    handlers.set(name, row);
  }

  const link = (id: string, focus: string) => `/shemesh/cases?focus=${focus}&open=${id}`;
  return {
    salesReady: input.hasWorkbook,
    sold: now?.sold ?? null,
    soldPrev: before?.sold ?? null,
    collected: now?.collected ?? null,
    collectedPrev: before?.collected ?? null,
    openToCollect: now?.open ?? null,
    openToCollectPrev: before?.open ?? null,
    dealCount: now?.count ?? null,
    sparkSold: trend.map((row) => row[1].sold),
    sparkCollected: trend.map((row) => row[1].collected),
    activeCases: active.length,
    activeCasesPrev: activePrev,
    slaBreaches: slaCases.length,
    attention: {
      sla: slaCases.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.clientName,
        detail: item.deadline ? `יעד ${formatShemeshDay(item.deadline)}` : "בלי יעד",
        href: link(item.id, "sla"),
      })),
      docs: docCases.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.clientName,
        detail: `${item.missingDocs} מסמכים חסרים`,
        href: link(item.id, "docs"),
      })),
      deadlines: dueCases.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.clientName,
        detail: item.deadline ? formatShemeshDay(item.deadline) : "",
        href: link(item.id, "week"),
      })),
      unassigned: unassigned.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.clientName,
        detail: "בלי מטפל",
        href: link(item.id, "unassigned"),
      })),
      stale: stale.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.clientName,
        detail: `נפתח ${formatShemeshDay(item.openedOn)}`,
        href: link(item.id, "stale"),
      })),
      stalePending,
    },
    funnel,
    trend: trend.map(([month, row]) => ({ month, collected: row.collected })),
    feesPending: input.ratesPending || openRows.some((row) => row.fee == null),
    openFeeRows: openRows.length,
    openFeeKnown: input.ratesPending || knownFees.length !== openRows.length ? null : knownFees.reduce((sum, fee) => sum + fee, 0),
    settlement: input.drafts[0] ?? null,
    sources: [...bySource.entries()].map(([name, row]) => ({ name, deals: row.deals, cases: row.cases })).sort((a, b) => b.deals - a.deals),
    cpl: adLeads > 0 ? Math.round((adSpend / adLeads) * 100) / 100 : null,
    leadToCase: adLeads > 0 ? Math.round((active.length / adLeads) * 100) : null,
    team: [...handlers.entries()].map(([handler, row]) => ({ handler, ...row })).sort((a, b) => b.cases - a.cases || b.sla - a.sla),
    activity: input.audit.filter((row) => inRange(row.createdAt.slice(0, 10), range)).slice(0, 8),
  };
}

function assertDashboardMath(): void {
  const range = { from: "2026-10-01", to: "2026-10-31" };
  const prev = previousRange(range);
  if (!prev || prev.to !== "2026-09-30" || daysBetween(prev.from, prev.to) !== 30) {
    throw new Error("previous period must match the selected length");
  }
  const deal = (date: string, amount: number, collected: number, source = "א"): GviyaDeal => ({
    id: date,
    client: "ל",
    rep: "מ",
    source,
    status: "",
    signed: true,
    dealDate: date,
    dealAmount: amount,
    collected,
    invoiceDate: null,
    cycleDays: null,
    stage: "lead",
  });
  const view = buildDashboard(
    {
      hasWorkbook: true,
      deals: [deal("2026-10-04", 100, 40), deal("2026-09-02", 999, 999, "ב")],
      cases: [{
        id: "1",
        clientName: "מיכל",
        stage: "documents",
        status: "open",
        handler: "",
        openedOn: "2026-10-12",
        deadline: "2026-10-08",
        overdue: true,
        missingDocs: 1,
      }],
      ledger: [{ id: "l", client: "מיכל", status: "open", fee: null, day: "2026-10-12" }],
      ratesPending: true,
      slaDays: 7,
      drafts: [],
      campaigns: [],
      audit: [],
      today: "2026-10-29",
    },
    range,
    "all",
  );
  if (view.sold !== 100 || view.collected !== 40 || view.openToCollect !== 60) {
    throw new Error("dashboard sales must follow the workbook inside the range");
  }
  if (view.openFeeKnown != null) throw new Error("pending fee rate must not invent an open fee");
  if (view.attention.unassigned.length !== 1 || view.slaBreaches !== 1) {
    throw new Error("attention must come from the case rows");
  }
  const empty = buildDashboard(
    { hasWorkbook: false, deals: [deal("2026-10-04", 100, 40)], cases: [], ledger: [], ratesPending: true, slaDays: null, drafts: [], campaigns: [], audit: [], today: "2026-10-29" },
    range,
    "all",
  );
  if (empty.sold != null || empty.collected != null) throw new Error("missing workbook must stay pending");
}

assertDashboardMath();
