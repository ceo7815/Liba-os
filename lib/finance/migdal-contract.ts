/**
 * Live Migdal contract: volume tiers + GAMACH holdback + settled 22% שוטף 60.
 * Annual volume is company-wide (Jan–Dec), applied retroactively to every active sale.
 */
import { productionDateOf } from "@/lib/employees/contract";
import {
  normalizeExcelText,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export const MIGDAL_COMPANY_TOKEN = "מגדל";
export const MIGDAL_ANNUAL_MONTHS = 12;
export const MIGDAL_GAMACH_RATE = 0.2;
export const MIGDAL_BASE_VOLUME_RATE = 0.75;
export const MIGDAL_SETTLED_RATE = 0.22;
/** שוטף 60 = two calendar months after the production month. */
export const MIGDAL_SETTLED_PAY_DELAY_MONTHS = 2;

export type MigdalVolumeTier = {
  id: "base" | "mid" | "top";
  from: number;
  to: number | null;
  rate: number;
  cashRate: number;
  gamachRate: number;
  retroFromBase: number;
};

export const MIGDAL_VOLUME_TIERS: readonly MigdalVolumeTier[] = [
  {
    id: "base",
    from: 1,
    to: 249_999,
    rate: 0.75,
    cashRate: 0.55,
    gamachRate: MIGDAL_GAMACH_RATE,
    retroFromBase: 0,
  },
  {
    id: "mid",
    from: 250_000,
    to: 499_999,
    rate: 0.78,
    cashRate: 0.58,
    gamachRate: MIGDAL_GAMACH_RATE,
    retroFromBase: 0.03,
  },
  {
    id: "top",
    from: 500_000,
    to: null,
    rate: 0.85,
    cashRate: 0.65,
    gamachRate: MIGDAL_GAMACH_RATE,
    retroFromBase: 0.1,
  },
] as const;

export type MigdalIncomeKind = "volume" | "settled" | "none";

export type MigdalRowIncome = {
  kind: MigdalIncomeKind;
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

export type MigdalYearVolume = {
  year: number;
  determiningPremium: number;
  count: number;
  tier: MigdalVolumeTier;
};

export type MigdalIncomeRollup = {
  income: number;
  cash: number;
  gamach: number;
  volume: number;
  settled: number;
  retro: number;
  count: number;
  volumeCount: number;
  settledCount: number;
  years: MigdalYearVolume[];
};

const EMPTY_ROLLUP: MigdalIncomeRollup = {
  income: 0,
  cash: 0,
  gamach: 0,
  volume: 0,
  settled: 0,
  retro: 0,
  count: 0,
  volumeCount: 0,
  settledCount: 0,
  years: [],
};

const EMPTY_ROW: MigdalRowIncome = {
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

export function isMigdalCompany(company: string | null | undefined): boolean {
  return normalizeExcelText(company).includes(MIGDAL_COMPANY_TOKEN);
}

/** חיים / משכנתאות / בריאות / מחלות קשות / מחלות סרטן */
export function isMigdalCoveredProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v) return false;
  if (v.includes("משכנת")) return true;
  if (v.includes("בריאות")) return true;
  if (v.includes("מחלות קשות")) return true;
  if (v.includes("סרטן") || v.includes("מזור")) return true;
  if (v.includes("חיים")) return true;
  if (v.includes("ריסק")) return true;
  return false;
}

export function determiningPremium(monthlyPremium: number): number {
  const monthly = Number(monthlyPremium) || 0;
  if (!(monthly > 0)) return 0;
  return Math.round(monthly * MIGDAL_ANNUAL_MONTHS);
}

export function calendarYearOf(
  row: Pick<MarketingProduction, "startDate" | "transferDate">,
): number | null {
  const iso = productionDateOf(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

export function migdalVolumeTier(annualDeterminingPremium: number): MigdalVolumeTier {
  const volume = Math.max(0, Math.round(annualDeterminingPremium));
  if (volume >= 500_000) return MIGDAL_VOLUME_TIERS[2];
  if (volume >= 250_000) return MIGDAL_VOLUME_TIERS[1];
  return MIGDAL_VOLUME_TIERS[0];
}

function isActiveRow(row: Pick<MarketingProduction, "status">): boolean {
  return row.status === "active";
}

export function countsForMigdalVolume(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (!isMigdalCompany(row.company)) return false;
  return isMigdalCoveredProduct(row.product);
}

export function countsForMigdalSettled(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "settled") return false;
  if (!isMigdalCompany(row.company)) return false;
  return isMigdalCoveredProduct(row.product);
}

export function migdalYearVolumes(
  rows: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >[],
): Map<number, MigdalYearVolume> {
  const byYear = new Map<number, { determiningPremium: number; count: number }>();
  for (const row of rows) {
    if (!countsForMigdalVolume(row)) continue;
    const year = calendarYearOf(row);
    if (!year) continue;
    const current = byYear.get(year) ?? { determiningPremium: 0, count: 0 };
    current.determiningPremium += determiningPremium(row.premium);
    current.count += 1;
    byYear.set(year, current);
  }
  const out = new Map<number, MigdalYearVolume>();
  for (const [year, row] of byYear) {
    out.set(year, {
      year,
      determiningPremium: row.determiningPremium,
      count: row.count,
      tier: migdalVolumeTier(row.determiningPremium),
    });
  }
  return out;
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function explainMigdalIncome(
  row: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >,
  yearVolumes: Map<number, MigdalYearVolume>,
): MigdalRowIncome {
  const monthlyPremium = Math.round(Number(row.premium) || 0);
  const year = calendarYearOf(row);

  if (countsForMigdalVolume(row)) {
    const annual = determiningPremium(monthlyPremium);
    const tier = (year && yearVolumes.get(year)?.tier) || migdalVolumeTier(0);
    const entitled = Math.round(annual * tier.rate);
    const cash = Math.round(annual * tier.cashRate);
    const gamach = Math.round(annual * tier.gamachRate);
    const retro = Math.round(annual * tier.retroFromBase);
    return {
      kind: "volume",
      year,
      monthlyPremium,
      determiningPremium: annual,
      volumeRate: tier.rate,
      entitled,
      cash,
      gamach,
      retro,
      settled: 0,
      income: entitled,
      formula: `פרמיה ${monthlyPremium} × ${MIGDAL_ANNUAL_MONTHS} × ${pctLabel(tier.rate)} · שוטף ${pctLabel(tier.cashRate)} · גמ״ח ${pctLabel(tier.gamachRate)}`,
    };
  }

  if (countsForMigdalSettled(row)) {
    const settled = Math.round(monthlyPremium * MIGDAL_SETTLED_RATE);
    return {
      kind: "settled",
      year,
      monthlyPremium,
      determiningPremium: monthlyPremium,
      volumeRate: 0,
      entitled: 0,
      cash: settled,
      gamach: 0,
      retro: 0,
      settled,
      income: settled,
      formula: `נפרעים ${pctLabel(MIGDAL_SETTLED_RATE)} שוטף ${MIGDAL_SETTLED_PAY_DELAY_MONTHS * 30} · פרמיה × ${pctLabel(MIGDAL_SETTLED_RATE)}`,
    };
  }

  return { ...EMPTY_ROW, monthlyPremium, year };
}

function addRollup(into: MigdalIncomeRollup, row: MigdalRowIncome): void {
  if (row.kind === "none") return;
  into.income += row.income;
  into.cash += row.cash;
  into.gamach += row.gamach;
  into.volume += row.entitled;
  into.settled += row.settled;
  into.retro += row.retro;
  into.count += 1;
  if (row.kind === "volume") into.volumeCount += 1;
  if (row.kind === "settled") into.settledCount += 1;
}

export function migdalIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): MigdalIncomeRollup {
  const yearVolumes = migdalYearVolumes(options?.yearContext ?? rows);
  const out: MigdalIncomeRollup = {
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
    addRollup(out, explainMigdalIncome(row, yearVolumes));
  }
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function formatMigdalTierLabel(tier: MigdalVolumeTier): string {
  const to = tier.to == null ? "ומעלה" : `– ${tier.to.toLocaleString("he-IL")}`;
  return `${tier.from.toLocaleString("he-IL")} ${to} → היקף ${pctLabel(tier.rate)} (שוטף ${pctLabel(tier.cashRate)} · גמ״ח ${pctLabel(tier.gamachRate)})`;
}

function row(partial: Partial<MarketingProduction> & Pick<MarketingProduction, "premium">): MarketingProduction {
  return {
    key: partial.key ?? "t",
    source: partial.source ?? "שיחות נכנסות",
    client: partial.client ?? "לקוח",
    agent: partial.agent ?? "ניב קובי",
    product: partial.product ?? "בריאות",
    company: partial.company ?? "מגדל",
    premium: partial.premium,
    status: partial.status ?? "active",
    statusRaw: partial.statusRaw ?? "פעילה",
    process: partial.process ?? "מכירה",
    startDate: partial.startDate ?? "2026-03-15",
    transferDate: partial.transferDate ?? "2026-03-15",
    fields: {},
  };
}

export function assertMigdalContract(): void {
  if (determiningPremium(500) !== 6000) {
    throw new Error(`expected 500×12=6000, got ${determiningPremium(500)}`);
  }
  if (migdalVolumeTier(1).rate !== 0.75 || migdalVolumeTier(249_999).id !== "base") {
    throw new Error("expected base tier under 250k");
  }
  if (migdalVolumeTier(250_000).rate !== 0.78 || migdalVolumeTier(499_999).id !== "mid") {
    throw new Error("expected mid tier 250k–499,999");
  }
  if (migdalVolumeTier(500_000).rate !== 0.85 || migdalVolumeTier(500_000).retroFromBase !== 0.1) {
    throw new Error("expected top tier 85% with 10% retro");
  }

  const baseSale = row({ premium: 500, key: "a" });
  const years = migdalYearVolumes([baseSale]);
  const explained = explainMigdalIncome(baseSale, years);
  if (explained.income !== 4500 || explained.cash !== 3300 || explained.gamach !== 1200) {
    throw new Error(
      `expected 75% of 6000 = 4500 (cash 3300 + gamach 1200), got ${explained.income}/${explained.cash}/${explained.gamach}`,
    );
  }

  const many = Array.from({ length: 84 }, (_, i) =>
    row({ premium: 500, key: `t${i}`, startDate: "2026-06-01", transferDate: "2026-06-01" }),
  );
  const topYears = migdalYearVolumes(many);
  const top = topYears.get(2026);
  if (!top || top.tier.id !== "top") {
    throw new Error(`expected 84×6000 to reach 85%, got ${top?.determiningPremium}`);
  }
  const firstAtTop = explainMigdalIncome(many[0], topYears);
  if (firstAtTop.income !== 5100 || firstAtTop.retro !== 600) {
    throw new Error(
      `expected retro 85% on early sale 5100 / retro 600, got ${firstAtTop.income}/${firstAtTop.retro}`,
    );
  }

  const cancelled = row({ premium: 500, status: "cancelled", statusRaw: "בוטלה" });
  if (explainMigdalIncome(cancelled, migdalYearVolumes([cancelled])).income !== 0) {
    throw new Error("cancelled Migdal sale must not count");
  }

  const harel = row({ premium: 500, company: "הראל" });
  if (explainMigdalIncome(harel, migdalYearVolumes([harel])).income !== 0) {
    throw new Error("non-Migdal company must be 0");
  }

  const pa = row({ premium: 500, product: "תאונות" });
  if (explainMigdalIncome(pa, migdalYearVolumes([pa])).income !== 0) {
    throw new Error("personal accident is outside Roy volume list");
  }

  const settled = row({
    premium: 500,
    process: "מינוי",
    key: "s1",
  });
  const settledExplain = explainMigdalIncome(settled, migdalYearVolumes([]));
  if (settledExplain.income !== 110 || settledExplain.kind !== "settled") {
    throw new Error(`expected settled 22% of 500 = 110, got ${settledExplain.income}`);
  }

  const y25 = row({ premium: 500, startDate: "2025-11-01", transferDate: "2025-11-01", key: "y25" });
  const mixedYears = migdalYearVolumes([...many, y25]);
  if (mixedYears.get(2025)?.tier.id !== "base") {
    throw new Error("2025 volume must not inherit 2026 top tier");
  }

  const rollup = migdalIncomeForProductions(many, { yearContext: many });
  if (rollup.volumeCount !== 84 || rollup.income !== 84 * 5100) {
    throw new Error(`expected 84×5100 income, got ${rollup.volumeCount}/${rollup.income}`);
  }
}
