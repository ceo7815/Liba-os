import {
  agreementForDate,
  agentBelongsToEmployee,
  countsForVolumeCommission,
  emptyPayContract,
  filterFreelancers4PayProductions,
  isPartnershipSource,
  freelancerPaysLeadCosts,
  isEmployeeWageMonth,
  productionMonthKey,
  profileUsesHubProductions,
  type EmployeePayProfile,
  type WageInputRow,
} from "@/lib/employees/contract";
import { defaultGoogleAdsCubeForCampaign } from "@/lib/finance/operating-brand";
import {
  canonicalCampaignSource,
  type FacebookAdsCampaignRow,
  type FacebookAdsDailyStat,
  type GoogleAdsCampaignRow,
  type GoogleAdsDailyStat,
} from "@/lib/sales-dashboard/campaign-math";
import { normalizeExcelText } from "@/lib/sales-dashboard/columns";

/** Freelancer pays half of that source-month's cost-per-lead, per produced sale. */
export const FREELANCER_LEAD_SHARE = 0.5;

export type LeadCplChannel = "google" | "facebook" | "both" | "manual" | "roy" | "alexander";

export type LeadCostFormula = "cpl" | "premium" | "alexander" | "alexander-unproduced";

/** ₪60 per Alexander lead — produced close or received-and-not-produced. */
export const ALEXANDER_LEAD_RATE = 60;

export type LeadCplRate = {
  cpl: number;
  spend: number;
  leads: number;
  channel: LeadCplChannel;
};

export type LeadCplMap = Record<string, number | LeadCplRate>;

export type AlexanderUnproducedRow = {
  employeeId: string;
  month: string;
  leads: number;
};

export function groupAlexanderUnproducedByEmployeeId(
  rows: AlexanderUnproducedRow[],
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!row.employeeId || !/^\d{4}-\d{2}$/.test(row.month)) continue;
    const current = map.get(row.employeeId) ?? {};
    current[row.month] = Math.max(0, Math.round(Number(row.leads) || 0));
    map.set(row.employeeId, current);
  }
  return map;
}

export type AdsLeadSnapshot = {
  googleCampaigns: GoogleAdsCampaignRow[];
  googleStats: Array<GoogleAdsDailyStat & { leads?: number }>;
  facebookCampaigns: FacebookAdsCampaignRow[];
  facebookStats: Array<FacebookAdsDailyStat & { leads?: number }>;
};

export const EMPTY_ADS_LEAD_SNAPSHOT: AdsLeadSnapshot = {
  googleCampaigns: [],
  googleStats: [],
  facebookCampaigns: [],
  facebookStats: [],
};

/** Until a fixed rate is set, Alexander is not billed from Ads Manager. */
const MANUAL_LEAD_CPL: Record<string, number> = {};

export function leadCplKey(source: string, month: string): string {
  return `${canonicalCampaignSource(source)}::${month}`;
}

export function isManualLeadCplSource(source: string): boolean {
  return normalizeExcelText(source).includes("אלכסנדר");
}

/** Calendar month of the source/campaign — transfer date, else start date. Not wage-shifted production month. */
export function sourceLeadMonthKey(row: Pick<WageInputRow, "transferDate" | "startDate">): string | null {
  const iso = String(row.transferDate || row.startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
}

export function cplRateOf(cpl: LeadCplMap | null | undefined, source: string, month: string): LeadCplRate {
  const value = cpl?.[leadCplKey(source, month)];
  if (typeof value === "number" && value > 0) {
    return { cpl: value, spend: 0, leads: 0, channel: "manual" };
  }
  if (value && typeof value === "object" && Number(value.cpl) > 0) {
    return {
      cpl: Number(value.cpl) || 0,
      spend: Number(value.spend) || 0,
      leads: Math.max(0, Math.round(Number(value.leads) || 0)),
      channel: value.channel || "manual",
    };
  }
  return { cpl: 0, spend: 0, leads: 0, channel: "manual" };
}

export function leadChannelLabel(channel: LeadCplChannel): string {
  if (channel === "google") return "גוגל Ads · שיחה נכנסת = ליד";
  if (channel === "facebook") return "פייסבוק · טופס באתר = ליד";
  if (channel === "both") return "גוגל Ads + פייסבוק";
  if (channel === "roy") return "רועי אזולאי · פרמיה שהופקה = החיוב";
  if (channel === "alexander") return "קמפיין אלכסנדר · ₪60 לליד";
  return "תעריף ידני";
}

export function isRoyAzulaiSource(source: string): boolean {
  return canonicalCampaignSource(source).includes("רועי אזולאי");
}

function googleSourceName(row: GoogleAdsCampaignRow): string {
  const mapped = String(row.sourceName ?? "").trim();
  if (mapped) return canonicalCampaignSource(mapped);
  return canonicalCampaignSource(defaultGoogleAdsCubeForCampaign(row.googleCampaignName));
}

type MonthSpend = { spend: number; leads: number; google: boolean; facebook: boolean };

function addMonthSpend(
  acc: Map<string, MonthSpend>,
  source: string,
  day: string,
  spend: number,
  leads: number,
  channel: "google" | "facebook",
) {
  const month = String(day).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const name = canonicalCampaignSource(source);
  if (!name || isManualLeadCplSource(name)) return;
  const key = leadCplKey(name, month);
  const cur = acc.get(key) ?? { spend: 0, leads: 0, google: false, facebook: false };
  cur.spend += Number(spend) || 0;
  cur.leads += Math.max(0, Math.round(Number(leads) || 0));
  if (channel === "google") cur.google = true;
  if (channel === "facebook") cur.facebook = true;
  acc.set(key, cur);
}

function channelOf(row: MonthSpend): LeadCplChannel {
  if (row.google && row.facebook) return "both";
  if (row.google) return "google";
  if (row.facebook) return "facebook";
  return "manual";
}

export function buildLeadCplBySourceMonth(ads: AdsLeadSnapshot | null | undefined): LeadCplMap {
  const acc = new Map<string, MonthSpend>();
  const out: LeadCplMap = {};
  for (const [key, value] of Object.entries(MANUAL_LEAD_CPL)) {
    out[key] = { cpl: value, spend: 0, leads: 0, channel: "manual" };
  }
  if (!ads) return out;

  const googleById = new Map(
    ads.googleCampaigns
      .filter((row) => row.enabled !== false)
      .map((row) => [String(row.googleCampaignId), row]),
  );
  for (const row of ads.googleStats) {
    const campaign = googleById.get(String(row.googleCampaignId));
    if (!campaign) continue;
    addMonthSpend(acc, googleSourceName(campaign), row.day, row.cost, row.leads ?? 0, "google");
  }

  const facebookById = new Map(
    ads.facebookCampaigns
      .filter((row) => row.enabled !== false && Boolean(row.sourceName))
      .map((row) => [String(row.facebookCampaignId), row]),
  );
  for (const row of ads.facebookStats) {
    const campaign = facebookById.get(String(row.facebookCampaignId));
    if (!campaign?.sourceName) continue;
    addMonthSpend(acc, campaign.sourceName, row.day, row.cost, row.leads ?? 0, "facebook");
  }

  for (const [key, value] of acc) {
    if (!(value.leads > 0) || !(value.spend > 0)) continue;
    out[key] = {
      cpl: value.spend / value.leads,
      spend: value.spend,
      leads: value.leads,
      channel: channelOf(value),
    };
  }
  return out;
}

export type LeadCostProductionLine = {
  date: string;
  client: string;
  product: string;
  source: string;
  month: string;
  premium: number;
  cpl: number;
  amount: number;
};

export type LeadCostSourceMonth = {
  key: string;
  source: string;
  month: string;
  spend: number;
  adsLeads: number;
  channel: LeadCplChannel;
  formula: LeadCostFormula;
  cpl: number;
  share: number;
  unit: number;
  count: number;
  amount: number;
  lines: LeadCostProductionLine[];
};

export type LeadCostCharge = {
  total: number;
  count: number;
  byMonth: Record<string, { count: number; amount: number }>;
  groups: LeadCostSourceMonth[];
};

const EMPTY_LEAD_CHARGE: LeadCostCharge = { total: 0, count: 0, byMonth: {}, groups: [] };

function productionsForLeadCosts(
  profile: EmployeePayProfile,
  rows: WageInputRow[],
): WageInputRow[] {
  return profileUsesHubProductions(profile)
    ? filterFreelancers4PayProductions(rows)
    : rows.filter((row) => agentBelongsToEmployee(row.agent, profile.fullName));
}

function productionClient(row: WageInputRow): string {
  return String((row as WageInputRow & { client?: string }).client ?? "").trim();
}

function addMonthBucket(
  byMonth: Record<string, { count: number; amount: number }>,
  month: string,
  amount: number,
  count = 1,
) {
  const bucket = byMonth[month] ?? { count: 0, amount: 0 };
  bucket.count += count;
  bucket.amount += amount;
  byMonth[month] = bucket;
}

function addGroupLine(
  grouped: Map<string, LeadCostSourceMonth>,
  seed: Omit<LeadCostSourceMonth, "count" | "amount" | "lines">,
  line: LeadCostProductionLine | null,
  amount: number,
  count = 1,
) {
  const group = grouped.get(seed.key) ?? { ...seed, count: 0, amount: 0, lines: [] };
  group.count += count;
  group.amount += amount;
  if (line) group.lines.push(line);
  grouped.set(seed.key, group);
}

export function freelancerLeadCosts(
  profile: EmployeePayProfile | null | undefined,
  rows: WageInputRow[],
  cpl: LeadCplMap | null | undefined,
  months?: string[] | null,
): LeadCostCharge {
  if (!profile) return EMPTY_LEAD_CHARGE;
  const monthFilter = months?.length ? new Set(months) : null;
  const byMonth: Record<string, { count: number; amount: number }> = {};
  const grouped = new Map<string, LeadCostSourceMonth>();
  let total = 0;
  let count = 0;

  const push = (
    month: string,
    amount: number,
    seed: Omit<LeadCostSourceMonth, "count" | "amount" | "lines">,
    line: LeadCostProductionLine | null,
    pieces = 1,
  ) => {
    if (!(amount > 0) || !isEmployeeWageMonth(month)) return;
    if (monthFilter && !monthFilter.has(month)) return;
    addMonthBucket(byMonth, month, amount, pieces);
    addGroupLine(grouped, seed, line, amount, pieces);
    total += amount;
    count += pieces;
  };

  for (const row of productionsForLeadCosts(profile, rows)) {
    if (isPartnershipSource(row.source)) continue;
    if (!countsForVolumeCommission(row)) continue;
    const date = String(row.transferDate || row.startDate || "").slice(0, 10);
    const wageMonth = productionMonthKey(row);
    const terms = agreementForDate(profile.agreements ?? [], date || (wageMonth ? `${wageMonth}-15` : ""));
    if (terms?.employmentKind !== "freelancer") continue;
    if (!freelancerPaysLeadCosts(terms.contract)) continue;
    const source = canonicalCampaignSource(row.source ?? "");
    if (!source) continue;
    const premium = Math.round(Number(row.premium) || 0);
    const lineBase = {
      date,
      client: productionClient(row),
      product: String(row.product ?? "").trim(),
      source,
      month: wageMonth,
      premium,
    };

    if (isRoyAzulaiSource(source) && wageMonth && premium > 0) {
      push(
        wageMonth,
        premium,
        {
          key: `${leadCplKey(source, wageMonth)}::premium`,
          source,
          month: wageMonth,
          spend: 0,
          adsLeads: 0,
          channel: "roy",
          formula: "premium",
          cpl: premium,
          share: 1,
          unit: premium,
        },
        { ...lineBase, cpl: premium, amount: premium },
      );
      continue;
    }

    if (isManualLeadCplSource(source) && wageMonth) {
      push(
        wageMonth,
        ALEXANDER_LEAD_RATE,
        {
          key: `${leadCplKey("קמפיין אלכסנדר", wageMonth)}::close`,
          source: "קמפיין אלכסנדר",
          month: wageMonth,
          spend: 0,
          adsLeads: 0,
          channel: "alexander",
          formula: "alexander",
          cpl: ALEXANDER_LEAD_RATE,
          share: 1,
          unit: ALEXANDER_LEAD_RATE,
        },
        { ...lineBase, month: wageMonth, source: "קמפיין אלכסנדר", cpl: ALEXANDER_LEAD_RATE, amount: ALEXANDER_LEAD_RATE },
      );
      continue;
    }

    const adsMonth = sourceLeadMonthKey(row);
    if (!adsMonth || !cpl) continue;
    const rate = cplRateOf(cpl, source, adsMonth);
    if (!(rate.cpl > 0)) continue;
    const amount = Math.round(rate.cpl * FREELANCER_LEAD_SHARE);
    push(
      adsMonth,
      amount,
      {
        key: leadCplKey(source, adsMonth),
        source,
        month: adsMonth,
        spend: rate.spend,
        adsLeads: rate.leads,
        channel: rate.channel,
        formula: "cpl",
        cpl: rate.cpl,
        share: FREELANCER_LEAD_SHARE,
        unit: amount,
      },
      { ...lineBase, month: adsMonth, cpl: rate.cpl, amount },
    );
  }

  for (const [month, raw] of Object.entries(profile.alexanderUnproducedByMonth ?? {})) {
    const extra = Math.max(0, Math.round(Number(raw) || 0));
    if (!(extra > 0)) continue;
    const terms = agreementForDate(profile.agreements ?? [], `${month}-15`);
    if (terms?.employmentKind !== "freelancer") continue;
    if (!freelancerPaysLeadCosts(terms.contract)) continue;
    push(
      month,
      extra * ALEXANDER_LEAD_RATE,
      {
        key: `${leadCplKey("קמפיין אלכסנדר", month)}::unproduced`,
        source: "קמפיין אלכסנדר",
        month,
        spend: 0,
        adsLeads: extra,
        channel: "alexander",
        formula: "alexander-unproduced",
        cpl: ALEXANDER_LEAD_RATE,
        share: 1,
        unit: ALEXANDER_LEAD_RATE,
      },
      {
        date: `${month}-01`,
        client: "לידים שהתקבלו ולא הופקו",
        product: "לא הופק",
        source: "קמפיין אלכסנדר",
        month,
        premium: 0,
        cpl: ALEXANDER_LEAD_RATE,
        amount: extra * ALEXANDER_LEAD_RATE,
      },
      extra,
    );
  }

  const groups = Array.from(grouped.values()).sort(
    (a, b) => b.month.localeCompare(a.month) || b.amount - a.amount || a.source.localeCompare(b.source, "he"),
  );
  for (const group of groups) {
    group.lines.sort(
      (a, b) => a.date.localeCompare(b.date) || a.client.localeCompare(b.client, "he"),
    );
  }
  return { total, count, byMonth, groups };
}

export function assertLeadCostRules(): void {
  const cpl: LeadCplMap = {
    [leadCplKey("שיחות נכנסות", "2026-08")]: { cpl: 100, spend: 1000, leads: 10, channel: "google" },
  };
  const contract = { ...emptyPayContract(), volumePercent: 50 };
  const profile: EmployeePayProfile = {
    fullName: "ניב קובי",
    employmentKind: "freelancer",
    contract,
    agreements: [{ id: "open", from: "", to: "", employmentKind: "freelancer", contract }],
  };
  const closes: WageInputRow[] = [1, 2, 3].map((n) => ({
    status: "active",
    agent: "ניב קובי",
    premium: 200,
    process: "מכירה",
    source: "שיחות נכנסות",
    transferDate: `2026-08-0${n}`,
    startDate: "2026-09-01",
    product: "בריאות",
  }));
  const charged = freelancerLeadCosts(profile, closes, cpl);
  if (charged.total !== 150 || charged.count !== 3) {
    throw new Error(`expected 3×50 lead costs, got ${charged.count}/${charged.total}`);
  }
  const group = charged.groups[0];
  if (
    !group ||
    group.source !== "שיחות נכנסות" ||
    group.month !== "2026-08" ||
    group.spend !== 1000 ||
    group.adsLeads !== 10 ||
    group.unit !== 50 ||
    group.lines.length !== 3
  ) {
    throw new Error("lead cost breakdown must show source, spend, leads and each production");
  }
  const pending = freelancerLeadCosts(
    profile,
    [{ ...closes[0], status: "pending" }],
    cpl,
  );
  if (pending.total !== 0) {
    throw new Error("pending production must not charge lead cost");
  }
  const organic = freelancerLeadCosts(
    profile,
    [{ ...closes[0], source: "לקוחות ליבה" }],
    cpl,
  );
  if (organic.total !== 0) {
    throw new Error("organic source must not charge lead cost");
  }
  if (sourceLeadMonthKey({ transferDate: "2026-08-15", startDate: "2026-09-01" }) !== "2026-08") {
    throw new Error("lead month must follow transfer date, not insurance start");
  }

  const roy = freelancerLeadCosts(
    profile,
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 2000,
        process: "מכירה",
        source: "רועי אזולאי",
        transferDate: "2026-02-10",
        startDate: "2026-02-15",
      },
      {
        status: "active",
        agent: "ניב קובי",
        premium: 500,
        process: "מכירה",
        source: "קו 2 רועי אזולאי",
        transferDate: "2026-02-20",
        startDate: "2026-02-20",
      },
    ],
    null,
  );
  if (roy.total !== 2500 || roy.count !== 2) {
    throw new Error(`expected Roy Azulai 1:1 premium 2500, got ${roy.count}/${roy.total}`);
  }

  const stacked = freelancerLeadCosts(
    profile,
    [
      closes[0],
      {
        status: "active",
        agent: "ניב קובי",
        premium: 2000,
        process: "מכירה",
        source: "רועי אזולאי",
        transferDate: "2026-08-15",
        startDate: "2026-08-15",
      },
    ],
    cpl,
  );
  if (stacked.total !== 50 + 2000 || stacked.count !== 2) {
    throw new Error(`expected ads CPL plus Roy to stack, got ${stacked.count}/${stacked.total}`);
  }

  const alexander = freelancerLeadCosts(
    { ...profile, alexanderUnproducedByMonth: { "2026-02": 88 } },
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 400,
        process: "מכירה",
        source: "קמפיין אלכסנדר",
        transferDate: "2026-02-12",
        startDate: "2026-02-12",
      },
    ],
    null,
  );
  if (alexander.total !== 60 + 88 * 60 || alexander.count !== 89) {
    throw new Error(`expected Alexander 1 close + 88 extra at 60, got ${alexander.count}/${alexander.total}`);
  }

  const avichaiContract = { ...emptyPayContract(), freelancerFormula: "freelancers_4" as const };
  const avichai = freelancerLeadCosts(
    {
      fullName: "אביחי יוסף",
      employmentKind: "freelancer",
      contract: avichaiContract,
      agreements: [{ id: "open4", from: "", to: "", employmentKind: "freelancer", contract: avichaiContract }],
      alexanderUnproducedByMonth: { "2026-08": 20 },
    },
    [
      ...closes,
      {
        status: "active",
        agent: "אביחי יוסף",
        premium: 2000,
        process: "מכירה",
        source: "רועי אזולאי",
        transferDate: "2026-08-15",
        startDate: "2026-08-15",
      },
      {
        status: "active",
        agent: "אביחי יוסף",
        premium: 400,
        process: "מכירה",
        source: "קמפיין אלכסנדר",
        transferDate: "2026-08-12",
        startDate: "2026-08-12",
      },
    ],
    cpl,
  );
  if (avichai.total !== 0 || avichai.count !== 0) {
    throw new Error(`expected עצמאים 4 to skip lead costs, got ${avichai.count}/${avichai.total}`);
  }
}
