/**
 * Live Harel contract: two volume tiers, no GAMACH.
 * Mortgage counts and pays at the full tier (no 50% weight, no 60% lock).
 * Settled 24% is on sales; agent appointments are not defined yet.
 * שוטף 60 from production — no collection check.
 */
import { productionDateOf } from "@/lib/employees/contract";
import {
  normalizeExcelText,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export const HAREL_COMPANY_TOKEN = "הראל";
export const HAREL_ANNUAL_MONTHS = 12;
export const HAREL_BASE_VOLUME_RATE = 0.75;
export const HAREL_SETTLED_RATE = 0.24;
/** שוטף 60 = two calendar months after the production month. */
export const HAREL_PAY_DELAY_MONTHS = 2;

export type HarelVolumeTier = {
  id: "r75" | "r85";
  from: number;
  to: number | null;
  rate: number;
  cashRate: number;
  gamachRate: number;
  retroFromBase: number;
};

export const HAREL_VOLUME_TIERS: readonly HarelVolumeTier[] = [
  {
    id: "r75",
    from: 1,
    to: 599_999,
    rate: 0.75,
    cashRate: 0.75,
    gamachRate: 0,
    retroFromBase: 0,
  },
  {
    id: "r85",
    from: 600_000,
    to: null,
    rate: 0.85,
    cashRate: 0.85,
    gamachRate: 0,
    retroFromBase: 0.1,
  },
] as const;

export type HarelIncomeKind = "volume" | "none";

export type HarelRowIncome = {
  kind: HarelIncomeKind;
  year: number | null;
  monthlyPremium: number;
  determiningPremium: number;
  volumeRate: number;
  entitled: number;
  cash: number;
  gamach: number;
  retro: number;
  settled: number;
  income: number;
  formula: string;
};

export type HarelYearVolume = {
  year: number;
  determiningPremium: number;
  count: number;
  tier: HarelVolumeTier;
};

export type HarelIncomeRollup = {
  income: number;
  cash: number;
  gamach: number;
  volume: number;
  settled: number;
  retro: number;
  count: number;
  volumeCount: number;
  settledCount: number;
  years: HarelYearVolume[];
};

const EMPTY_ROW: HarelRowIncome = {
  kind: "none",
  year: null,
  monthlyPremium: 0,
  determiningPremium: 0,
  volumeRate: 0,
  entitled: 0,
  cash: 0,
  gamach: 0,
  retro: 0,
  settled: 0,
  income: 0,
  formula: "אין הסכם / לא נספר",
};

export function isHarelCompany(company: string | null | undefined): boolean {
  return normalizeExcelText(company).includes(HAREL_COMPANY_TOKEN);
}

/** ריסק משועבד / משכנתאות / בריאות / מחלות קשות / מחלות סרטן */
export function isHarelCoveredProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v) return false;
  if (v.includes("משכנת")) return true;
  if (v.includes("בריאות")) return true;
  if (v.includes("מחלות קשות")) return true;
  if (v.includes("סרטן") || v.includes("מזור")) return true;
  if (v.includes("חיים")) return true;
  if (v.includes("ריסק")) return true;
  if (v.includes("משועבד")) return true;
  return false;
}

export function harelDeterminingPremium(monthlyPremium: number): number {
  const monthly = Number(monthlyPremium) || 0;
  if (!(monthly > 0)) return 0;
  return Math.round(monthly * HAREL_ANNUAL_MONTHS);
}

export function harelCalendarYearOf(
  row: Pick<MarketingProduction, "startDate" | "transferDate">,
): number | null {
  const iso = productionDateOf(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

export function harelVolumeTier(annualDeterminingPremium: number): HarelVolumeTier {
  const volume = Math.max(0, Math.round(annualDeterminingPremium));
  if (volume >= 600_000) return HAREL_VOLUME_TIERS[1];
  return HAREL_VOLUME_TIERS[0];
}

function isActiveRow(row: Pick<MarketingProduction, "status">): boolean {
  return row.status === "active";
}

/** היקף + נפרעים 24% על מכירות פעילות. מינוי סוכן — טרם הוגדר. */
export function countsForHarelVolume(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (!isHarelCompany(row.company)) return false;
  return isHarelCoveredProduct(row.product);
}

export function harelYearVolumes(
  rows: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >[],
): Map<number, HarelYearVolume> {
  const byYear = new Map<number, { determiningPremium: number; count: number }>();
  for (const row of rows) {
    if (!countsForHarelVolume(row)) continue;
    const year = harelCalendarYearOf(row);
    if (!year) continue;
    const current = byYear.get(year) ?? { determiningPremium: 0, count: 0 };
    current.determiningPremium += harelDeterminingPremium(row.premium);
    current.count += 1;
    byYear.set(year, current);
  }
  const out = new Map<number, HarelYearVolume>();
  for (const [year, row] of byYear) {
    out.set(year, {
      year,
      determiningPremium: row.determiningPremium,
      count: row.count,
      tier: harelVolumeTier(row.determiningPremium),
    });
  }
  return out;
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function explainHarelIncome(
  row: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >,
  yearVolumes: Map<number, HarelYearVolume>,
): HarelRowIncome {
  const monthlyPremium = Math.round(Number(row.premium) || 0);
  const year = harelCalendarYearOf(row);

  if (!countsForHarelVolume(row)) {
    return { ...EMPTY_ROW, monthlyPremium, year };
  }

  const annual = harelDeterminingPremium(monthlyPremium);
  const tier = (year && yearVolumes.get(year)?.tier) || harelVolumeTier(0);
  const entitled = Math.round(annual * tier.rate);
  const retro = Math.round(annual * tier.retroFromBase);
  const settled = Math.round(monthlyPremium * HAREL_SETTLED_RATE);
  const delay = HAREL_PAY_DELAY_MONTHS * 30;
  return {
    kind: "volume",
    year,
    monthlyPremium,
    determiningPremium: annual,
    volumeRate: tier.rate,
    entitled,
    cash: entitled + settled,
    gamach: 0,
    retro,
    settled,
    income: entitled + settled,
    formula: `פרמיה ${monthlyPremium} × ${HAREL_ANNUAL_MONTHS} × ${pctLabel(tier.rate)} + נפרעים ${pctLabel(HAREL_SETTLED_RATE)} שוטף ${delay}`,
  };
}

function addRollup(into: HarelIncomeRollup, row: HarelRowIncome): void {
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

export function harelIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): HarelIncomeRollup {
  const yearVolumes = harelYearVolumes(options?.yearContext ?? rows);
  const out: HarelIncomeRollup = {
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
    addRollup(out, explainHarelIncome(row, yearVolumes));
  }
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function formatHarelTierLabel(tier: HarelVolumeTier): string {
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
    company: partial.company ?? "הראל",
    premium: partial.premium,
    status: partial.status ?? "active",
    statusRaw: partial.statusRaw ?? "פעילה",
    process: partial.process ?? "מכירה",
    startDate: partial.startDate ?? "2026-03-15",
    transferDate: partial.transferDate ?? "2026-03-15",
    fields: {},
  };
}

export function assertHarelContract(): void {
  if (harelDeterminingPremium(500) !== 6000) {
    throw new Error(`expected 500×12=6000, got ${harelDeterminingPremium(500)}`);
  }
  if (harelVolumeTier(1).rate !== 0.75 || harelVolumeTier(599_999).id !== "r75") {
    throw new Error("expected 75% under 600k");
  }
  if (harelVolumeTier(600_000).rate !== 0.85 || harelVolumeTier(600_000).retroFromBase !== 0.1) {
    throw new Error("expected 85% from 600k with 10% retro");
  }

  const baseSale = row({ premium: 500, key: "a" });
  const years = harelYearVolumes([baseSale]);
  const explained = explainHarelIncome(baseSale, years);
  if (explained.entitled !== 4500 || explained.settled !== 120 || explained.income !== 4620) {
    throw new Error(
      `expected 75% of 6000 = 4500 + settled 120, got ${explained.entitled}/${explained.settled}/${explained.income}`,
    );
  }
  if (explained.gamach !== 0) throw new Error("Harel has no GAMACH");

  const mortgage = row({ premium: 500, product: "משכנתא", key: "m1" });
  const mortgageExplain = explainHarelIncome(mortgage, harelYearVolumes([mortgage]));
  if (mortgageExplain.entitled !== 4500 || mortgageExplain.volumeRate !== 0.75) {
    throw new Error("Harel mortgage uses the full 75/85 ladder, not a 50% weight");
  }

  const many = Array.from({ length: 25 }, (_, i) =>
    row({
      premium: 2000,
      key: `t${i}`,
      startDate: "2026-06-01",
      transferDate: "2026-06-01",
    }),
  );
  const topYears = harelYearVolumes(many);
  if (topYears.get(2026)?.tier.id !== "r85") {
    throw new Error(`expected 25×24000 to reach 85%, got ${topYears.get(2026)?.determiningPremium}`);
  }
  const firstAtTop = explainHarelIncome(many[0], topYears);
  if (firstAtTop.entitled !== 20_400 || firstAtTop.retro !== 2400) {
    throw new Error(
      `expected retro 85% on 24000 = 20400 / retro 2400, got ${firstAtTop.entitled}/${firstAtTop.retro}`,
    );
  }

  const appointment = row({ premium: 500, process: "מינוי", key: "s1" });
  if (explainHarelIncome(appointment, harelYearVolumes([appointment])).kind !== "none") {
    throw new Error("Harel 24% is on sales; appointments are not defined yet");
  }

  const cancelled = row({ premium: 500, status: "cancelled", statusRaw: "בוטלה" });
  if (explainHarelIncome(cancelled, harelYearVolumes([cancelled])).income !== 0) {
    throw new Error("cancelled Harel sale must not count");
  }

  const phoenix = row({ premium: 500, company: "הפניקס" });
  if (explainHarelIncome(phoenix, harelYearVolumes([phoenix])).income !== 0) {
    throw new Error("non-Harel company must be 0");
  }

  const y25 = row({ premium: 2000, startDate: "2025-11-01", transferDate: "2025-11-01", key: "y25" });
  const mixedYears = harelYearVolumes([...many, y25]);
  if (mixedYears.get(2025)?.tier.id !== "r75") {
    throw new Error("2025 volume must not inherit 2026 top tier");
  }

  const rollup = harelIncomeForProductions(many, { yearContext: many });
  if (rollup.volumeCount !== 25 || rollup.volume !== 25 * 20_400 || rollup.settled !== 25 * 480) {
    throw new Error(
      `expected 25×20400 volume and 25×480 settled, got ${rollup.volumeCount}/${rollup.volume}/${rollup.settled}`,
    );
  }
}
