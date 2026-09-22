/**
 * Live Phoenix contract: volume tiers, no GAMACH, mortgage 50% weight for the ladder only.
 * Mortgage is still paid at the full tier rate. Settled 24% is on sales;
 * agent appointments are not defined yet.
 * שוטף 60 from production. Migdal / Ayalon settled rates stay 22%.
 */
import { productionDateOf } from "@/lib/employees/contract";
import {
  normalizeExcelText,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export const PHOENIX_COMPANY_TOKEN = "פניקס";
export const PHOENIX_ANNUAL_MONTHS = 12;
export const PHOENIX_MORTGAGE_WEIGHT = 0.5;
export const PHOENIX_BASE_VOLUME_RATE = 0.8;
export const PHOENIX_SETTLED_RATE = 0.24;
/** שוטף 60 = two calendar months after the production month. */
export const PHOENIX_PAY_DELAY_MONTHS = 2;

export type PhoenixVolumeTier = {
  id: "r80" | "r85" | "r88" | "r90" | "r92";
  from: number;
  to: number | null;
  rate: number;
  cashRate: number;
  gamachRate: number;
  retroFromBase: number;
};

export const PHOENIX_VOLUME_TIERS: readonly PhoenixVolumeTier[] = [
  {
    id: "r80",
    from: 1,
    to: 599_999,
    rate: 0.8,
    cashRate: 0.8,
    gamachRate: 0,
    retroFromBase: 0,
  },
  {
    id: "r85",
    from: 600_000,
    to: 999_999,
    rate: 0.85,
    cashRate: 0.85,
    gamachRate: 0,
    retroFromBase: 0.05,
  },
  {
    id: "r88",
    from: 1_000_000,
    to: 1_200_000,
    rate: 0.88,
    cashRate: 0.88,
    gamachRate: 0,
    retroFromBase: 0.08,
  },
  {
    id: "r90",
    from: 1_200_001,
    to: 1_500_000,
    rate: 0.9,
    cashRate: 0.9,
    gamachRate: 0,
    retroFromBase: 0.1,
  },
  {
    id: "r92",
    from: 1_500_001,
    to: null,
    rate: 0.92,
    cashRate: 0.92,
    gamachRate: 0,
    retroFromBase: 0.12,
  },
] as const;

export type PhoenixIncomeKind = "volume" | "none";

export type PhoenixRowIncome = {
  kind: PhoenixIncomeKind;
  year: number | null;
  monthlyPremium: number;
  determiningPremium: number;
  weightedPremium: number;
  volumeRate: number;
  entitled: number;
  cash: number;
  gamach: number;
  retro: number;
  settled: number;
  income: number;
  formula: string;
  mortgage: boolean;
};

export type PhoenixYearVolume = {
  year: number;
  determiningPremium: number;
  count: number;
  tier: PhoenixVolumeTier;
};

export type PhoenixIncomeRollup = {
  income: number;
  cash: number;
  gamach: number;
  volume: number;
  settled: number;
  retro: number;
  count: number;
  volumeCount: number;
  settledCount: number;
  years: PhoenixYearVolume[];
};

const EMPTY_ROW: PhoenixRowIncome = {
  kind: "none",
  year: null,
  monthlyPremium: 0,
  determiningPremium: 0,
  weightedPremium: 0,
  volumeRate: 0,
  entitled: 0,
  cash: 0,
  gamach: 0,
  retro: 0,
  settled: 0,
  income: 0,
  formula: "אין הסכם / לא נספר",
  mortgage: false,
};

export function isPhoenixCompany(company: string | null | undefined): boolean {
  return normalizeExcelText(company).includes(PHOENIX_COMPANY_TOKEN);
}

/** משכנתא — נספרת 50% למדרגה, משולמת באחוז המדרגה המלא. */
export function isPhoenixMortgageProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v.includes("משכנת")) return false;
  if (v.includes("משועבד")) return false;
  if (v.includes("ריסק")) return false;
  if (v.includes("חיים")) return false;
  return true;
}

/** ריסק משועבד / בריאות / מחלות קשות / מחלות סרטן — 100% למדרגה */
export function isPhoenixLadderProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v || isPhoenixMortgageProduct(v)) return false;
  if (v.includes("בריאות")) return true;
  if (v.includes("מחלות קשות")) return true;
  if (v.includes("סרטן") || v.includes("מזור")) return true;
  if (v.includes("חיים")) return true;
  if (v.includes("ריסק")) return true;
  if (v.includes("משועבד")) return true;
  return false;
}

export function isPhoenixCoveredProduct(product: string | null | undefined): boolean {
  return isPhoenixMortgageProduct(product) || isPhoenixLadderProduct(product);
}

export function phoenixDeterminingPremium(monthlyPremium: number): number {
  const monthly = Number(monthlyPremium) || 0;
  if (!(monthly > 0)) return 0;
  return Math.round(monthly * PHOENIX_ANNUAL_MONTHS);
}

export function phoenixWeightedPremium(
  monthlyPremium: number,
  product: string | null | undefined,
): number {
  const full = phoenixDeterminingPremium(monthlyPremium);
  if (!full) return 0;
  if (isPhoenixMortgageProduct(product)) {
    return Math.round(full * PHOENIX_MORTGAGE_WEIGHT);
  }
  return full;
}

export function phoenixCalendarYearOf(
  row: Pick<MarketingProduction, "startDate" | "transferDate">,
): number | null {
  const iso = productionDateOf(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

export function phoenixVolumeTier(annualWeightedPremium: number): PhoenixVolumeTier {
  const volume = Math.max(0, Math.round(annualWeightedPremium));
  for (let i = PHOENIX_VOLUME_TIERS.length - 1; i >= 0; i--) {
    if (volume >= PHOENIX_VOLUME_TIERS[i].from) return PHOENIX_VOLUME_TIERS[i];
  }
  return PHOENIX_VOLUME_TIERS[0];
}

function isActiveRow(row: Pick<MarketingProduction, "status">): boolean {
  return row.status === "active";
}

/** היקף + נפרעים 24% על מכירות פעילות. מינוי סוכן — טרם הוגדר. */
export function countsForPhoenixVolume(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (!isPhoenixCompany(row.company)) return false;
  return isPhoenixCoveredProduct(row.product);
}

export function phoenixYearVolumes(
  rows: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >[],
): Map<number, PhoenixYearVolume> {
  const byYear = new Map<number, { determiningPremium: number; count: number }>();
  for (const row of rows) {
    if (!countsForPhoenixVolume(row)) continue;
    const year = phoenixCalendarYearOf(row);
    if (!year) continue;
    const current = byYear.get(year) ?? { determiningPremium: 0, count: 0 };
    current.determiningPremium += phoenixWeightedPremium(row.premium, row.product);
    current.count += 1;
    byYear.set(year, current);
  }
  const out = new Map<number, PhoenixYearVolume>();
  for (const [year, row] of byYear) {
    out.set(year, {
      year,
      determiningPremium: row.determiningPremium,
      count: row.count,
      tier: phoenixVolumeTier(row.determiningPremium),
    });
  }
  return out;
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function explainPhoenixIncome(
  row: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >,
  yearVolumes: Map<number, PhoenixYearVolume>,
): PhoenixRowIncome {
  const monthlyPremium = Math.round(Number(row.premium) || 0);
  const year = phoenixCalendarYearOf(row);

  if (!countsForPhoenixVolume(row)) {
    return { ...EMPTY_ROW, monthlyPremium, year };
  }

  const annual = phoenixDeterminingPremium(monthlyPremium);
  const weighted = phoenixWeightedPremium(monthlyPremium, row.product);
  const mortgage = isPhoenixMortgageProduct(row.product);
  const tier = (year && yearVolumes.get(year)?.tier) || phoenixVolumeTier(0);
  const entitled = Math.round(annual * tier.rate);
  const retro = Math.round(annual * tier.retroFromBase);
  const settled = Math.round(monthlyPremium * PHOENIX_SETTLED_RATE);
  const delay = PHOENIX_PAY_DELAY_MONTHS * 30;
  return {
    kind: "volume",
    year,
    monthlyPremium,
    determiningPremium: annual,
    weightedPremium: weighted,
    volumeRate: tier.rate,
    entitled,
    cash: entitled + settled,
    gamach: 0,
    retro,
    settled,
    income: entitled + settled,
    mortgage,
    formula: mortgage
      ? `משכנתא נספרת ${pctLabel(PHOENIX_MORTGAGE_WEIGHT)} למדרגה · משולמת ${pctLabel(tier.rate)} · פרמיה ${monthlyPremium} × ${PHOENIX_ANNUAL_MONTHS} × ${pctLabel(tier.rate)} + נפרעים ${pctLabel(PHOENIX_SETTLED_RATE)} שוטף ${delay}`
      : `פרמיה ${monthlyPremium} × ${PHOENIX_ANNUAL_MONTHS} × ${pctLabel(tier.rate)} + נפרעים ${pctLabel(PHOENIX_SETTLED_RATE)} שוטף ${delay}`,
  };
}

function addRollup(into: PhoenixIncomeRollup, row: PhoenixRowIncome): void {
  if (row.kind === "none") return;
  into.income += row.income;
  into.cash += row.cash;
  into.gamach += row.gamach;
  into.volume += row.entitled;
  into.settled += row.settled;
  into.retro += row.retro;
  into.count += 1;
  into.volumeCount += 1;
  if (row.settled > 0) into.settledCount += 1;
}

export function phoenixIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): PhoenixIncomeRollup {
  const yearVolumes = phoenixYearVolumes(options?.yearContext ?? rows);
  const out: PhoenixIncomeRollup = {
    income: 0,
    cash: 0,
    gamach: 0,
    volume: 0,
    settled: 0,
    retro: 0,
    count: 0,
    volumeCount: 0,
    settledCount: 0,
    years: Array.from(yearVolumes.values()).sort((a, b) => a.year - b.year),
  };
  for (const row of rows) {
    addRollup(out, explainPhoenixIncome(row, yearVolumes));
  }
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function formatPhoenixTierLabel(tier: PhoenixVolumeTier): string {
  const to = tier.to == null ? "ומעלה" : `– ${tier.to.toLocaleString("he-IL")}`;
  return `${tier.from.toLocaleString("he-IL")} ${to} → היקף ${pctLabel(tier.rate)} (הכל שוטף 60, בלי גמ״ח)`;
}

function row(
  partial: Partial<MarketingProduction> & Pick<MarketingProduction, "premium">,
): MarketingProduction {
  return {
    key: partial.key ?? "t",
    source: partial.source ?? "שיחות נכנסות",
    client: partial.client ?? "לקוח",
    agent: partial.agent ?? "ניב קובי",
    product: partial.product ?? "בריאות",
    company: partial.company ?? "הפניקס",
    premium: partial.premium,
    status: partial.status ?? "active",
    statusRaw: partial.statusRaw ?? "פעילה",
    process: partial.process ?? "מכירה",
    startDate: partial.startDate ?? "2026-03-15",
    transferDate: partial.transferDate ?? "2026-03-15",
    fields: {},
  };
}

export function assertPhoenixContract(): void {
  if (phoenixDeterminingPremium(500) !== 6000) {
    throw new Error(`expected 500×12=6000, got ${phoenixDeterminingPremium(500)}`);
  }
  if (phoenixWeightedPremium(1000, "משכנתא") !== 6000) {
    throw new Error("mortgage 1000/month must count 50% of 12000 = 6000 toward the ladder");
  }
  if (phoenixWeightedPremium(1000, "בריאות") !== 12_000) {
    throw new Error("health must count 100% toward the ladder");
  }
  if (phoenixVolumeTier(1).rate !== 0.8 || phoenixVolumeTier(599_999).id !== "r80") {
    throw new Error("expected 80% under 600k");
  }
  if (phoenixVolumeTier(600_000).rate !== 0.85 || phoenixVolumeTier(999_999).id !== "r85") {
    throw new Error("expected 85% at 600k–999,999");
  }
  if (phoenixVolumeTier(1_000_000).rate !== 0.88 || phoenixVolumeTier(1_200_000).id !== "r88") {
    throw new Error("expected 88% at 1M–1.2M");
  }
  if (phoenixVolumeTier(1_200_001).rate !== 0.9 || phoenixVolumeTier(1_500_000).id !== "r90") {
    throw new Error("expected 90% at 1,200,001–1,500,000");
  }
  if (phoenixVolumeTier(1_500_001).rate !== 0.92 || phoenixVolumeTier(1_500_001).retroFromBase !== 0.12) {
    throw new Error("expected 92% from 1,500,001 with 12% retro");
  }

  const baseSale = row({ premium: 500, key: "a" });
  const years = phoenixYearVolumes([baseSale]);
  const explained = explainPhoenixIncome(baseSale, years);
  if (explained.entitled !== 4800 || explained.settled !== 120 || explained.income !== 4920) {
    throw new Error(
      `expected 80% of 6000 = 4800 + settled 120, got ${explained.entitled}/${explained.settled}/${explained.income}`,
    );
  }
  if (explained.gamach !== 0) throw new Error("Phoenix has no GAMACH");

  const mortgageOnly = Array.from({ length: 50 }, (_, i) =>
    row({ premium: 2000, product: "משכנתא", key: `m${i}` }),
  );
  const mortgageYears = phoenixYearVolumes(mortgageOnly);
  const mortgageYear = mortgageYears.get(2026);
  if (!mortgageYear || mortgageYear.determiningPremium !== 600_000 || mortgageYear.tier.id !== "r85") {
    throw new Error(
      `50×24000 mortgage must weigh 600k → 85%, got ${mortgageYear?.determiningPremium}/${mortgageYear?.tier.id}`,
    );
  }
  const mortgagePaid = explainPhoenixIncome(mortgageOnly[0], mortgageYears);
  if (mortgagePaid.entitled !== 20_400 || mortgagePaid.volumeRate !== 0.85) {
    throw new Error(
      `mortgage is paid at full 85% of 24000 = 20400, got ${mortgagePaid.entitled}/${mortgagePaid.volumeRate}`,
    );
  }

  const healthAt1_2M = Array.from({ length: 50 }, (_, i) =>
    row({
      premium: 2000,
      product: "בריאות",
      key: `h${i}`,
      startDate: "2026-06-01",
      transferDate: "2026-06-01",
    }),
  );
  const midYears = phoenixYearVolumes(healthAt1_2M);
  if (midYears.get(2026)?.tier.id !== "r88") {
    throw new Error(`expected 50×24000 health = 1.2M → 88%, got ${midYears.get(2026)?.determiningPremium}`);
  }
  const firstAt88 = explainPhoenixIncome(healthAt1_2M[0], midYears);
  if (firstAt88.entitled !== 21_120 || firstAt88.retro !== 1920) {
    throw new Error(
      `expected 88% of 24000 = 21120 / retro 1920, got ${firstAt88.entitled}/${firstAt88.retro}`,
    );
  }

  const healthTop = Array.from({ length: 63 }, (_, i) =>
    row({
      premium: 2000,
      product: "בריאות",
      key: `t${i}`,
      startDate: "2026-06-01",
      transferDate: "2026-06-01",
    }),
  );
  const topYears = phoenixYearVolumes(healthTop);
  if (topYears.get(2026)?.tier.id !== "r92") {
    throw new Error(`expected 63×24000 health to reach 92%, got ${topYears.get(2026)?.determiningPremium}`);
  }
  const firstAtTop = explainPhoenixIncome(healthTop[0], topYears);
  if (firstAtTop.entitled !== 22_080 || firstAtTop.retro !== 2880) {
    throw new Error(
      `expected 92% of 24000 = 22080 / retro 2880, got ${firstAtTop.entitled}/${firstAtTop.retro}`,
    );
  }

  const appointment = row({ premium: 500, process: "מינוי", key: "s1" });
  if (explainPhoenixIncome(appointment, phoenixYearVolumes([appointment])).kind !== "none") {
    throw new Error("Phoenix 24% is on sales; appointments are not defined yet");
  }
  const agentAppointment = row({ premium: 500, process: "מינוי סוכן", key: "s2" });
  if (explainPhoenixIncome(agentAppointment, phoenixYearVolumes([agentAppointment])).kind !== "none") {
    throw new Error("Phoenix agent appointments are not under the 24% sales rate yet");
  }

  const cancelled = row({ premium: 500, status: "cancelled", statusRaw: "בוטלה" });
  if (explainPhoenixIncome(cancelled, phoenixYearVolumes([cancelled])).income !== 0) {
    throw new Error("cancelled Phoenix sale must not count");
  }

  const migdal = row({ premium: 500, company: "מגדל" });
  if (explainPhoenixIncome(migdal, phoenixYearVolumes([migdal])).income !== 0) {
    throw new Error("non-Phoenix company must be 0");
  }

  const risk = row({ premium: 500, product: "ריסק משועבד", key: "r1" });
  if (phoenixWeightedPremium(500, "ריסק משועבד") !== 6000) {
    throw new Error("pledged risk must count 100% toward the Phoenix ladder");
  }
  if (explainPhoenixIncome(risk, phoenixYearVolumes([risk])).volumeRate !== 0.8) {
    throw new Error("pledged risk uses the 80–92% ladder");
  }

  const y25 = row({ premium: 2000, startDate: "2025-11-01", transferDate: "2025-11-01", key: "y25" });
  const mixedYears = phoenixYearVolumes([...healthTop, y25]);
  if (mixedYears.get(2025)?.tier.id !== "r80") {
    throw new Error("2025 volume must not inherit 2026 top tier");
  }

  const rollup = phoenixIncomeForProductions(healthTop, { yearContext: healthTop });
  if (rollup.volumeCount !== 63 || rollup.volume !== 63 * 22_080 || rollup.settled !== 63 * 480) {
    throw new Error(
      `expected 63×22080 volume and 63×480 settled, got ${rollup.volumeCount}/${rollup.volume}/${rollup.settled}`,
    );
  }
}
