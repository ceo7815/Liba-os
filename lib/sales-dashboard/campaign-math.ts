import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { JERUSALEM_TZ, normalizeExcelText } from "@/lib/sales-dashboard/columns";

export const DEFAULT_PROFIT_THRESHOLD = 0.45;
/** Wage is 0 until an employee agreement is saved. Kept at 0 so old cubes cannot invent salary. */
export const DEFAULT_AGENT_MULTIPLIER = 0;

export type AgentRate = {
  agentName: string;
  multiplier: number;
};

/** Removed: היקף / נפרעים take wage only from a saved agreement. */
export const KNOWN_AGENT_RATES: AgentRate[] = [];

const AGENT_NAME_ALIASES: Record<string, string> = {
  "חן בראון": "חן בר און",
  "סימונה ויינר": "סימונה",
  "סימונה ווינר": "סימונה",
  "רועי ברודוגו": "רועי ברדוגו",
  "רועי ברדוגו": "רועי ברדוגו",
};

export function canonicalAgentName(name: string): string {
  const trimmed = name
    .replace(/בראון/g, "בר און")
    .replace(/\s+/g, " ")
    .trim();
  return AGENT_NAME_ALIASES[trimmed] ?? trimmed;
}

export function mergeAgentRates(saved: AgentRate[]): AgentRate[] {
  const map = new Map<string, number>();
  for (const row of saved) {
    const key = canonicalAgentName(row.agentName);
    if (!key) continue;
    map.set(key, row.multiplier);
  }
  return Array.from(map.entries()).map(([agentName, multiplier]) => ({
    agentName,
    multiplier,
  }));
}

export type ExpenseChannel = "google" | "facebook" | "manual";

export type CampaignExpense = {
  id: string;
  sourceName: string;
  channel: ExpenseChannel;
  amount: number;
  occurredAt: string;
  note: string | null;
};

export type CampaignFlag = {
  sourceName: string;
  included: boolean;
};

export type DatePreset = "ytd" | "month" | "prev" | "90d" | "all" | "custom";

export type DateRange = {
  from: string | null;
  to: string | null;
};

export type ProfitStatus = "profit" | "loss" | "no-cost";

/** Liba Google Ads cube — campaign «ביטוחים». */
export const GOOGLE_ADS_CUBE_SOURCE = "שיחות נכנסות";
/** Shemesh Google Ads cube — campaign «פיננסים». */
export const GOOGLE_ADS_SHEMESH_CUBE_SOURCE = "קמפיין שמש";

export function isLibaGoogleAdsCube(name: string): boolean {
  return canonicalCampaignSource(name) === GOOGLE_ADS_CUBE_SOURCE;
}

export function isShemeshGoogleAdsCube(name: string): boolean {
  return canonicalCampaignSource(name) === GOOGLE_ADS_SHEMESH_CUBE_SOURCE;
}

export function isGoogleAdsCube(name: string): boolean {
  return isLibaGoogleAdsCube(name) || isShemeshGoogleAdsCube(name);
}

/** Excel / DB spelling variants for the same referral cube. */
const CAMPAIGN_SOURCE_ALIASES: Record<string, string> = {
  "רועי אוזלאי": "רועי אזולאי",
  "אושרן משכנתאות": "אורשן משכנתאות",
};

export function canonicalCampaignSource(name: string): string {
  const trimmed = normalizeExcelText(name);
  return CAMPAIGN_SOURCE_ALIASES[trimmed] ?? trimmed;
}

export function sourceMatchesCampaignName(source: string, campaignName: string): boolean {
  return canonicalCampaignSource(source) === canonicalCampaignSource(campaignName);
}

export function resolveCampaignNames(
  sourceNames: string[],
  flags: CampaignFlag[],
): string[] {
  const byName = new Map(
    flags.map((flag) => [canonicalCampaignSource(flag.sourceName), flag.included]),
  );
  const names = new Set<string>();
  for (const name of sourceNames) {
    const trimmed = canonicalCampaignSource(name);
    if (!trimmed) continue;
    if (byName.get(trimmed) === false) continue;
    names.add(trimmed);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, "he"));
}

export const DATE_PRESET_ORDER: DatePreset[] = ["ytd", "all", "month", "prev", "90d", "custom"];

export function jerusalemYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftMonth(ymd: string, delta: number): { year: number; month: number } {
  const [y, m] = ymd.split("-").map(Number);
  const monthIndex = m - 1 + delta;
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return { year, month: month + 1 };
}

/** Excel stamps productions on the last calendar day of the month. */
function lastYmdOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function rangeForPreset(
  preset: DatePreset,
  custom: DateRange,
  today = jerusalemYmd(),
): DateRange {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return custom;
  const [y, m] = today.split("-").map(Number);
  if (preset === "ytd") {
    return { from: `${y}-01-01`, to: lastYmdOfMonth(y, m) };
  }
  if (preset === "month") {
    return {
      from: `${y}-${String(m).padStart(2, "0")}-01`,
      to: lastYmdOfMonth(y, m),
    };
  }
  if (preset === "prev") {
    const prev = shiftMonth(today, -1);
    const mm = String(prev.month).padStart(2, "0");
    return {
      from: `${prev.year}-${mm}-01`,
      to: lastYmdOfMonth(prev.year, prev.month),
    };
  }
  const start = new Date(`${today}T00:00:00+03:00`);
  start.setDate(start.getDate() - 89);
  return { from: jerusalemYmd(start), to: lastYmdOfMonth(y, m) };
}

export function assertDatePresetsCoverExcelMonth(): void {
  const month = rangeForPreset("month", { from: null, to: null }, "2026-09-16");
  if (month.from !== "2026-09-01" || month.to !== "2026-09-30") {
    throw new Error(`expected החודש to cover 1–30 Sep, got ${month.from}–${month.to}`);
  }
  const ytd = rangeForPreset("ytd", { from: null, to: null }, "2026-09-16");
  if (ytd.from !== "2026-01-01" || ytd.to !== "2026-09-30") {
    throw new Error(`expected YTD to include Sep 30 Excel rows, got ${ytd.from}–${ytd.to}`);
  }
  const prev = rangeForPreset("prev", { from: null, to: null }, "2026-09-16");
  if (prev.from !== "2026-08-01" || prev.to !== "2026-08-31") {
    throw new Error(`expected חודש שעבר Aug 1–31, got ${prev.from}–${prev.to}`);
  }
}

export function isoDay(value: unknown): string {
  if (value == null || value === "" || value === "—") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return jerusalemYmd(value);
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

export function inDateRange(isoDate: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const day = isoDay(isoDate);
  if (!day) return false;
  const from = isoDay(range.from) || range.from || "";
  const to = isoDay(range.to) || range.to || "";
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function profitStatus(
  net: number,
  premium: number,
  expenses: number,
): ProfitStatus {
  if (premium <= 0 && expenses <= 0) return "no-cost";
  return net >= 0 ? "profit" : "loss";
}

export function profitRatio(premium: number, expenses: number): number | null {
  if (expenses <= 0) return null;
  return premium / expenses;
}

export function campaignPnl(input: {
  premium: number;
  wageTotal: number;
  adsTotal: number;
  income: number;
}): {
  income: number;
  expenseTotal: number;
  net: number;
  status: ProfitStatus;
} {
  const income = Math.round(Number(input.income) || 0);
  const expenseTotal = input.wageTotal + input.adsTotal;
  const net = income - expenseTotal;
  return {
    income,
    expenseTotal,
    net,
    status: profitStatus(net, input.premium, expenseTotal),
  };
}

export function agentMultiplier(
  agentName: string,
  rates: AgentRate[],
  fallback = DEFAULT_AGENT_MULTIPLIER,
): number {
  const key = canonicalAgentName(agentName);
  if (!key || key === "—") return 0;
  const found = rates.find((row) => canonicalAgentName(row.agentName) === key);
  if (found) return found.multiplier;
  return fallback > 0 ? fallback : 0;
}

export function wageForPremium(premium: number, multiplier: number): number {
  if (premium <= 0 || multiplier <= 0) return 0;
  return Math.round(premium * multiplier);
}

export function wageForProductions(
  rows: { status: string; agent: string; premium: number }[],
  rates: AgentRate[],
  fallback = DEFAULT_AGENT_MULTIPLIER,
): number {
  return rows.reduce((sum, row) => {
    if (row.status !== "active") return sum;
    return sum + wageForPremium(row.premium, agentMultiplier(row.agent, rates, fallback));
  }, 0);
}

export type AgentWageTotal = {
  agentName: string;
  count: number;
  premium: number;
  multiplier: number;
  earned: number;
};

export function agentWageTotals(
  rows: { status: string; agent: string; premium: number }[],
  rates: AgentRate[],
  fallback = DEFAULT_AGENT_MULTIPLIER,
): AgentWageTotal[] {
  const map = new Map<string, { count: number; premium: number }>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const key = canonicalAgentName(row.agent);
    if (!key || key === "—") continue;
    const current = map.get(key) ?? { count: 0, premium: 0 };
    current.count += 1;
    current.premium += row.premium;
    map.set(key, current);
  }
  return Array.from(map.entries())
    .map(([agentName, item]) => {
      const multiplier = agentMultiplier(agentName, rates, fallback);
      const premium = Math.round(item.premium);
      return {
        agentName,
        count: item.count,
        premium,
        multiplier,
        earned: wageForPremium(premium, multiplier),
      };
    })
    .sort((a, b) => b.earned - a.earned);
}

export function wageTotalForEmployee(
  employeeName: string,
  totals: AgentWageTotal[],
  rates: AgentRate[],
  fallback = DEFAULT_AGENT_MULTIPLIER,
): AgentWageTotal {
  const key = canonicalAgentName(employeeName);
  const exact = totals.find((row) => row.agentName === key);
  if (exact) return exact;
  const first = key.split(" ")[0];
  const fuzzy = totals.filter(
    (row) =>
      row.agentName === first ||
      row.agentName.startsWith(`${first} `) ||
      key.startsWith(`${row.agentName} `),
  );
  if (fuzzy.length === 1) return fuzzy[0];
  const multiplier = agentMultiplier(key, rates, fallback);
  return {
    agentName: key,
    count: 0,
    premium: 0,
    multiplier,
    earned: 0,
  };
}

export function formatRatioPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function formatIls(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

export function formatIlsSigned(n: number): string {
  const body = formatIls(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

export const CHANNEL_LABEL: Record<ExpenseChannel, string> = {
  google: "גוגל Ads",
  facebook: "פייסבוק",
  manual: "הוצאה משויכת",
};

export const STATUS_LABEL: Record<MarketingProduction["status"], string> = {
  active: "פעילה",
  pending: "בתהליך",
  cancelled: "בוטלה / גניזה",
  other: "אחר",
};

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  ytd: "מתחילת שנה",
  month: "החודש",
  prev: "חודש שעבר",
  "90d": "90 יום",
  all: "הכל",
  custom: "טווח תאריכים",
};

function heDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function spanOfIsoDates(dates: string[]): DateRange {
  const days = dates
    .map((value) => value.slice(0, 10))
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort();
  if (days.length === 0) return { from: null, to: null };
  return { from: days[0], to: days[days.length - 1] };
}

export type GoogleAdsCampaignRow = {
  googleCampaignId: string;
  googleCampaignName: string;
  status: string;
  sourceName: string | null;
  enabled: boolean;
};

export type GoogleAdsDailyStat = {
  googleCampaignId: string;
  day: string;
  cost: number;
  clicks: number;
  impressions: number;
  leads: number;
};

export type GoogleAdsMappedLine = {
  googleCampaignId: string;
  googleCampaignName: string;
  status: string;
  cost: number;
  clicks: number;
  impressions: number;
};

export const GOOGLE_ADS_STATUS_LABEL: Record<string, string> = {
  ENABLED: "פעיל",
  PAUSED: "מושהה",
  REMOVED: "הוסר",
  UNKNOWN: "לא ידוע",
};

export function googleAdsStatusLabel(status: string): string {
  return GOOGLE_ADS_STATUS_LABEL[status] ?? status;
}

function defaultGoogleCubeForCampaignName(campaignName: string): string {
  const v = normalizeExcelText(campaignName);
  if (v.includes("פיננס")) return GOOGLE_ADS_SHEMESH_CUBE_SOURCE;
  return GOOGLE_ADS_CUBE_SOURCE;
}

export function googleAdsRollup(
  sourceName: string,
  campaigns: GoogleAdsCampaignRow[],
  stats: GoogleAdsDailyStat[],
  range: DateRange,
): {
  cost: number;
  clicks: number;
  impressions: number;
  campaigns: GoogleAdsMappedLine[];
} {
  const mapped = campaigns.filter((row) => {
    if (row.enabled === false) return false;
    const mappedName = row.sourceName ?? (row as { source_name?: string }).source_name;
    if (mappedName && sourceMatchesCampaignName(String(mappedName), sourceName)) {
      return true;
    }
    if (!String(mappedName ?? "").trim()) {
      return (
        canonicalCampaignSource(sourceName) ===
        defaultGoogleCubeForCampaignName(row.googleCampaignName)
      );
    }
    return false;
  });
  const byId = new Map<string, GoogleAdsMappedLine>();
  for (const row of mapped) {
    const id = String(
      row.googleCampaignId ?? (row as { google_campaign_id?: string }).google_campaign_id ?? "",
    ).trim();
    if (!id) continue;
    byId.set(id, {
      googleCampaignId: id,
      googleCampaignName: row.googleCampaignName,
      status: row.status,
      cost: 0,
      clicks: 0,
      impressions: 0,
    });
  }
  let cost = 0;
  let clicks = 0;
  let impressions = 0;
  for (const row of stats) {
    if (!inDateRange(row.day, range)) continue;
    const id = String(
      row.googleCampaignId ?? (row as { google_campaign_id?: string }).google_campaign_id ?? "",
    ).trim();
    const item = byId.get(id);
    if (!item) continue;
    const rowCost = Number(row.cost) || 0;
    item.cost += rowCost;
    item.clicks += Number(row.clicks) || 0;
    item.impressions += Number(row.impressions) || 0;
    cost += rowCost;
    clicks += Number(row.clicks) || 0;
    impressions += Number(row.impressions) || 0;
  }
  return {
    cost,
    clicks,
    impressions,
    campaigns: Array.from(byId.values()).sort(
      (a, b) => b.cost - a.cost || a.googleCampaignName.localeCompare(b.googleCampaignName, "he"),
    ),
  };
}

export type FacebookAdsCampaignRow = {
  facebookCampaignId: string;
  facebookCampaignName: string;
  status: string;
  sourceName: string | null;
  enabled: boolean;
};

export type FacebookAdsDailyStat = {
  facebookCampaignId: string;
  day: string;
  cost: number;
  clicks: number;
  impressions: number;
  leads: number;
};

export type FacebookAdsMappedLine = {
  facebookCampaignId: string;
  facebookCampaignName: string;
  status: string;
  cost: number;
  clicks: number;
  impressions: number;
};

export const FACEBOOK_ADS_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "פעיל",
  PAUSED: "מושהה",
  DELETED: "נמחק",
  ARCHIVED: "בארכיון",
  CAMPAIGN_PAUSED: "מושהה",
  UNKNOWN: "לא ידוע",
};

export function facebookAdsStatusLabel(status: string): string {
  return FACEBOOK_ADS_STATUS_LABEL[status] ?? status;
}

export function googleSpendBySource(
  campaigns: GoogleAdsCampaignRow[],
  stats: GoogleAdsDailyStat[],
  range: DateRange,
): Record<string, number> {
  const names = new Set<string>([
    GOOGLE_ADS_CUBE_SOURCE,
    GOOGLE_ADS_SHEMESH_CUBE_SOURCE,
  ]);
  for (const row of campaigns) {
    if (row.sourceName) names.add(canonicalCampaignSource(row.sourceName));
  }
  const out: Record<string, number> = {};
  for (const name of names) {
    const cost = googleAdsRollup(name, campaigns, stats, range).cost;
    if (cost) out[name] = cost;
  }
  return out;
}

export function facebookSpendBySource(
  campaigns: FacebookAdsCampaignRow[],
  stats: FacebookAdsDailyStat[],
  range: DateRange,
): Record<string, number> {
  const names = new Set<string>();
  for (const row of campaigns) {
    if (row.sourceName) names.add(canonicalCampaignSource(row.sourceName));
  }
  const out: Record<string, number> = {};
  for (const name of names) {
    const cost = facebookAdsRollup(name, campaigns, stats, range).cost;
    if (cost) out[name] = cost;
  }
  return out;
}

export function facebookAdsRollup(
  sourceName: string,
  campaigns: FacebookAdsCampaignRow[],
  stats: FacebookAdsDailyStat[],
  range: DateRange,
): {
  cost: number;
  clicks: number;
  impressions: number;
  campaigns: FacebookAdsMappedLine[];
} {
  const mapped = campaigns.filter(
    (row) =>
      row.enabled !== false &&
      Boolean(row.sourceName) &&
      sourceMatchesCampaignName(row.sourceName ?? "", sourceName),
  );
  const byId = new Map<string, FacebookAdsMappedLine>();
  for (const row of mapped) {
    byId.set(String(row.facebookCampaignId), {
      facebookCampaignId: String(row.facebookCampaignId),
      facebookCampaignName: row.facebookCampaignName,
      status: row.status,
      cost: 0,
      clicks: 0,
      impressions: 0,
    });
  }
  let cost = 0;
  let clicks = 0;
  let impressions = 0;
  for (const row of stats) {
    const id = String(
      row.facebookCampaignId ??
        (row as { facebook_campaign_id?: string }).facebook_campaign_id ??
        "",
    ).trim();
    const item = byId.get(id);
    if (!item) continue;
    if (!inDateRange(row.day, range)) continue;
    const rowCost = Number(row.cost) || 0;
    item.cost += rowCost;
    item.clicks += Number(row.clicks) || 0;
    item.impressions += Number(row.impressions) || 0;
    cost += rowCost;
    clicks += Number(row.clicks) || 0;
    impressions += Number(row.impressions) || 0;
  }
  return {
    cost,
    clicks,
    impressions,
    campaigns: Array.from(byId.values()).sort(
      (a, b) =>
        b.cost - a.cost ||
        a.facebookCampaignName.localeCompare(b.facebookCampaignName, "he"),
    ),
  };
}

export function cubeMarketingTotals(
  sourceName: string,
  expenses: { channel: ExpenseChannel; amount: number }[],
  googleCost: number,
  googleMappedCount: number,
  facebookCost = 0,
  facebookMappedCount = 0,
): { adsTotal: number; byChannel: Record<ExpenseChannel, number> } {
  const skipManualGoogle = isGoogleAdsCube(sourceName) && googleMappedCount > 0;
  const skipManualFacebook = facebookMappedCount > 0;
  const byChannel: Record<ExpenseChannel, number> = {
    google: 0,
    facebook: 0,
    manual: 0,
  };
  for (const row of expenses) {
    if (skipManualGoogle && row.channel === "google") continue;
    if (skipManualFacebook && row.channel === "facebook") continue;
    byChannel[row.channel] += row.amount;
  }
  byChannel.google += googleCost;
  byChannel.facebook += facebookCost;
  return {
    adsTotal: byChannel.google + byChannel.facebook + byChannel.manual,
    byChannel,
  };
}

export function formatRangeDisplay(
  preset: DatePreset,
  range: DateRange,
  dataSpan?: DateRange,
): string {
  const resolved =
    preset === "all" || (!range.from && !range.to) ? (dataSpan ?? range) : range;
  if (resolved.from && resolved.to) {
    if (resolved.from === resolved.to) return heDay(resolved.from);
    return `${heDay(resolved.from)} – ${heDay(resolved.to)}`;
  }
  if (resolved.from) return `מ־${heDay(resolved.from)}`;
  if (resolved.to) return `עד ${heDay(resolved.to)}`;
  return DATE_PRESET_LABEL[preset];
}
