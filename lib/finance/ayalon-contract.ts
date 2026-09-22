/**
 * Live Ayalon contract: volume tiers, no GAMACH, mortgage locked at 60%.
 * Annual determining premium is company-wide (Jan–Dec) and includes mortgage.
 * The ladder (70/75/85) applies retroactively to non-mortgage products only.
 * Settled 22% שוטף 60 — same as Migdal, on the same covered products.
 */
import { productionDateOf } from "@/lib/employees/contract";
import {
  normalizeExcelText,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export const AYALON_COMPANY_TOKEN = "איילון";
export const AYALON_ANNUAL_MONTHS = 12;
export const AYALON_MORTGAGE_RATE = 0.6;
export const AYALON_BASE_VOLUME_RATE = 0.7;
/** שוטף 30 = one calendar month after the production month. */
export const AYALON_VOLUME_PAY_DELAY_MONTHS = 1;
export const AYALON_SETTLED_RATE = 0.22;
/** שוטף 60 = two calendar months after the production month — same as Migdal. */
export const AYALON_SETTLED_PAY_DELAY_MONTHS = 2;

export type AyalonVolumeTier = {
  id: "base" | "mid" | "top";
  from: number;
  to: number | null;
  rate: number;
  cashRate: number;
  gamachRate: number;
  retroFromBase: number;
};

export const AYALON_VOLUME_TIERS: readonly AyalonVolumeTier[] = [
  {
    id: "base",
    from: 1,
    to: 49_999,
    rate: 0.7,
    cashRate: 0.7,
    gamachRate: 0,
    retroFromBase: 0,
  },
  {
    id: "mid",
    from: 50_000,
    to: 249_999,
    rate: 0.75,
    cashRate: 0.75,
    gamachRate: 0,
    retroFromBase: 0.05,
  },
  {
    id: "top",
    from: 250_000,
    to: null,
    rate: 0.85,
    cashRate: 0.85,
    gamachRate: 0,
    retroFromBase: 0.15,
  },
] as const;

export type AyalonIncomeKind = "volume" | "settled" | "none";

export type AyalonRowIncome = {
  kind: AyalonIncomeKind;
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
  mortgage: boolean;
};

export type AyalonYearVolume = {
  year: number;
  determiningPremium: number;
  count: number;
  tier: AyalonVolumeTier;
};

export type AyalonIncomeRollup = {
  income: number;
  cash: number;
  gamach: number;
  volume: number;
  settled: number;
  retro: number;
  count: number;
  volumeCount: number;
  settledCount: number;
  years: AyalonYearVolume[];
};

const EMPTY_ROLLUP: AyalonIncomeRollup = {
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

const EMPTY_ROW: AyalonRowIncome = {
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
  mortgage: false,
};

export function isAyalonCompany(company: string | null | undefined): boolean {
  return normalizeExcelText(company).includes(AYALON_COMPANY_TOKEN);
}

/**
 * ביטוח משכנתא — 60% קבוע.
 * ריסק משועבד / ריסק / חיים נשארים במדרגות, גם אם מופיע «משכנת».
 */
export function isAyalonMortgageProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v.includes("משכנת")) return false;
  if (v.includes("משועבד")) return false;
  if (v.includes("ריסק")) return false;
  if (v.includes("חיים")) return false;
  return true;
}

/** ריסק משועבד / בריאות / מחלות קשות / מחלות סרטן — מדרגות 70/75/85 */
export function isAyalonLadderProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v || isAyalonMortgageProduct(v)) return false;
  if (v.includes("בריאות")) return true;
  if (v.includes("מחלות קשות")) return true;
  if (v.includes("סרטן") || v.includes("מזור")) return true;
  if (v.includes("חיים")) return true;
  if (v.includes("ריסק")) return true;
  if (v.includes("משועבד")) return true;
  return false;
}

export function isAyalonCoveredProduct(product: string | null | undefined): boolean {
  return isAyalonMortgageProduct(product) || isAyalonLadderProduct(product);
}

export function ayalonDeterminingPremium(monthlyPremium: number): number {
  const monthly = Number(monthlyPremium) || 0;
  if (!(monthly > 0)) return 0;
  return Math.round(monthly * AYALON_ANNUAL_MONTHS);
}

export function ayalonCalendarYearOf(
  row: Pick<MarketingProduction, "startDate" | "transferDate">,
): number | null {
  const iso = productionDateOf(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

export function ayalonVolumeTier(annualDeterminingPremium: number): AyalonVolumeTier {
  const volume = Math.max(0, Math.round(annualDeterminingPremium));
  if (volume >= 250_000) return AYALON_VOLUME_TIERS[2];
  if (volume >= 50_000) return AYALON_VOLUME_TIERS[1];
  return AYALON_VOLUME_TIERS[0];
}

function isActiveRow(row: Pick<MarketingProduction, "status">): boolean {
  return row.status === "active";
}

export function countsForAyalonVolume(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (!isAyalonCompany(row.company)) return false;
  return isAyalonCoveredProduct(row.product);
}

export function countsForAyalonSettled(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "settled") return false;
  if (!isAyalonCompany(row.company)) return false;
  return isAyalonCoveredProduct(row.product);
}

export function ayalonYearVolumes(
  rows: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >[],
): Map<number, AyalonYearVolume> {
  const byYear = new Map<number, { determiningPremium: number; count: number }>();
  for (const row of rows) {
    if (!countsForAyalonVolume(row)) continue;
    const year = ayalonCalendarYearOf(row);
    if (!year) continue;
    const current = byYear.get(year) ?? { determiningPremium: 0, count: 0 };
    current.determiningPremium += ayalonDeterminingPremium(row.premium);
    current.count += 1;
    byYear.set(year, current);
  }
  const out = new Map<number, AyalonYearVolume>();
  for (const [year, row] of byYear) {
    out.set(year, {
      year,
      determiningPremium: row.determiningPremium,
      count: row.count,
      tier: ayalonVolumeTier(row.determiningPremium),
    });
  }
  return out;
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function explainAyalonIncome(
  row: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >,
  yearVolumes: Map<number, AyalonYearVolume>,
): AyalonRowIncome {
  const monthlyPremium = Math.round(Number(row.premium) || 0);
  const year = ayalonCalendarYearOf(row);

  if (countsForAyalonVolume(row)) {
    const annual = ayalonDeterminingPremium(monthlyPremium);
    const mortgage = isAyalonMortgageProduct(row.product);
    const tier = (year && yearVolumes.get(year)?.tier) || ayalonVolumeTier(0);
    const rate = mortgage ? AYALON_MORTGAGE_RATE : tier.rate;
    const entitled = Math.round(annual * rate);
    const retro = mortgage ? 0 : Math.round(annual * tier.retroFromBase);
    const delay = AYALON_VOLUME_PAY_DELAY_MONTHS * 30;
    return {
      kind: "volume",
      year,
      monthlyPremium,
      determiningPremium: annual,
      volumeRate: rate,
      entitled,
      cash: entitled,
      gamach: 0,
      retro,
      settled: 0,
      income: entitled,
      mortgage,
      formula: mortgage
        ? `משכנתא ${pctLabel(AYALON_MORTGAGE_RATE)} קבוע · פרמיה ${monthlyPremium} × ${AYALON_ANNUAL_MONTHS} × ${pctLabel(AYALON_MORTGAGE_RATE)} · שוטף ${delay}`
        : `פרמיה ${monthlyPremium} × ${AYALON_ANNUAL_MONTHS} × ${pctLabel(rate)} · הכל שוטף · שוטף ${delay}`,
    };
  }

  if (countsForAyalonSettled(row)) {
    const settled = Math.round(monthlyPremium * AYALON_SETTLED_RATE);
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
      mortgage: isAyalonMortgageProduct(row.product),
      formula: `נפרעים ${pctLabel(AYALON_SETTLED_RATE)} שוטף ${AYALON_SETTLED_PAY_DELAY_MONTHS * 30} · פרמיה × ${pctLabel(AYALON_SETTLED_RATE)}`,
    };
  }

  return { ...EMPTY_ROW, monthlyPremium, year };
}

function addRollup(into: AyalonIncomeRollup, row: AyalonRowIncome): void {
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

export function ayalonIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): AyalonIncomeRollup {
  const yearVolumes = ayalonYearVolumes(options?.yearContext ?? rows);
  const out: AyalonIncomeRollup = {
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
    addRollup(out, explainAyalonIncome(row, yearVolumes));
  }
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function formatAyalonTierLabel(tier: AyalonVolumeTier): string {
  const to = tier.to == null ? "ומעלה" : `– ${tier.to.toLocaleString("he-IL")}`;
  return `${tier.from.toLocaleString("he-IL")} ${to} → היקף ${pctLabel(tier.rate)} (הכל שוטף, בלי גמ״ח)`;
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
    company: partial.company ?? "איילון",
    premium: partial.premium,
    status: partial.status ?? "active",
    statusRaw: partial.statusRaw ?? "פעילה",
    process: partial.process ?? "מכירה",
    startDate: partial.startDate ?? "2026-03-15",
    transferDate: partial.transferDate ?? "2026-03-15",
    fields: {},
  };
}

export function assertAyalonContract(): void {
  if (ayalonDeterminingPremium(500) !== 6000) {
    throw new Error(`expected 500×12=6000, got ${ayalonDeterminingPremium(500)}`);
  }
  if (ayalonVolumeTier(1).rate !== 0.7 || ayalonVolumeTier(49_999).id !== "base") {
    throw new Error("expected base tier under 50k");
  }
  if (ayalonVolumeTier(50_000).rate !== 0.75 || ayalonVolumeTier(249_999).id !== "mid") {
    throw new Error("expected mid tier 50k–249,999");
  }
  if (ayalonVolumeTier(250_000).rate !== 0.85 || ayalonVolumeTier(250_000).retroFromBase !== 0.15) {
    throw new Error("expected top tier 85% with 15% retro");
  }

  const baseSale = row({ premium: 500, key: "a" });
  const years = ayalonYearVolumes([baseSale]);
  const explained = explainAyalonIncome(baseSale, years);
  if (explained.income !== 4200 || explained.cash !== 4200 || explained.gamach !== 0) {
    throw new Error(
      `expected 70% of 6000 = 4200 cash, no gamach, got ${explained.income}/${explained.cash}/${explained.gamach}`,
    );
  }

  const health = row({ premium: 500, product: "בריאות", key: "h1" });
  const mortgage = row({ premium: 500, product: "משכנתא", key: "m1" });
  const mixed = ayalonYearVolumes([health, mortgage]);
  if (!mixed.get(2026) || mixed.get(2026)!.determiningPremium !== 12_000) {
    throw new Error("mortgage must count toward the annual ladder volume");
  }
  const mortgageExplain = explainAyalonIncome(mortgage, mixed);
  if (mortgageExplain.income !== 3600 || mortgageExplain.volumeRate !== AYALON_MORTGAGE_RATE) {
    throw new Error(`expected mortgage 60% of 6000 = 3600, got ${mortgageExplain.income}`);
  }

  const healthLow = Array.from({ length: 8 }, (_, i) =>
    row({ premium: 500, product: "בריאות", key: `h${i}` }),
  );
  const mortgagePush = row({ premium: 500, product: "משכנתא", key: "mp" });
  const crossed = [...healthLow, mortgagePush];
  const crossedYears = ayalonYearVolumes(crossed);
  if (crossedYears.get(2026)?.tier.id !== "mid") {
    throw new Error(
      `expected mortgage to push 8×6000+6000 over 50k, got ${crossedYears.get(2026)?.determiningPremium}`,
    );
  }
  const healthAfterCross = explainAyalonIncome(healthLow[0], crossedYears);
  if (healthAfterCross.income !== 4500 || healthAfterCross.retro !== 300) {
    throw new Error(
      `expected ladder retro to 75% = 4500 / retro 300, got ${healthAfterCross.income}/${healthAfterCross.retro}`,
    );
  }
  const mortgageAfterCross = explainAyalonIncome(mortgagePush, crossedYears);
  if (mortgageAfterCross.income !== 3600 || mortgageAfterCross.retro !== 0) {
    throw new Error("mortgage must stay 60% even after the ladder climbs");
  }

  const many = Array.from({ length: 42 }, (_, i) =>
    row({ premium: 500, key: `t${i}`, startDate: "2026-06-01", transferDate: "2026-06-01" }),
  );
  const topYears = ayalonYearVolumes(many);
  const top = topYears.get(2026);
  if (!top || top.tier.id !== "top") {
    throw new Error(`expected 42×6000 to reach 85%, got ${top?.determiningPremium}`);
  }
  const firstAtTop = explainAyalonIncome(many[0], topYears);
  if (firstAtTop.income !== 5100 || firstAtTop.retro !== 900) {
    throw new Error(
      `expected retro 85% on early sale 5100 / retro 900, got ${firstAtTop.income}/${firstAtTop.retro}`,
    );
  }

  const cancelled = row({ premium: 500, status: "cancelled", statusRaw: "בוטלה" });
  if (explainAyalonIncome(cancelled, ayalonYearVolumes([cancelled])).income !== 0) {
    throw new Error("cancelled Ayalon sale must not count");
  }

  const migdal = row({ premium: 500, company: "מגדל" });
  if (explainAyalonIncome(migdal, ayalonYearVolumes([migdal])).income !== 0) {
    throw new Error("non-Ayalon company must be 0");
  }

  const pa = row({ premium: 500, product: "תאונות" });
  if (explainAyalonIncome(pa, ayalonYearVolumes([pa])).income !== 0) {
    throw new Error("personal accident is outside Ayalon volume list");
  }

  const risk = row({ premium: 500, product: "ריסק משועבד", key: "r1" });
  if (explainAyalonIncome(risk, ayalonYearVolumes([risk])).volumeRate !== 0.7) {
    throw new Error("pledged risk must use the 70/75/85 ladder, not mortgage 60%");
  }

  const settled = row({
    premium: 500,
    process: "מינוי",
    key: "s1",
  });
  const settledExplain = explainAyalonIncome(settled, ayalonYearVolumes([]));
  if (settledExplain.income !== 110 || settledExplain.kind !== "settled") {
    throw new Error(`expected settled 22% of 500 = 110, got ${settledExplain.income}`);
  }
  const mortgageSettled = row({
    premium: 500,
    product: "משכנתא",
    process: "מינוי",
    key: "sm",
  });
  if (explainAyalonIncome(mortgageSettled, ayalonYearVolumes([])).income !== 110) {
    throw new Error("Ayalon mortgage settled must still be 22% like Migdal");
  }

  const y25 = row({ premium: 500, startDate: "2025-11-01", transferDate: "2025-11-01", key: "y25" });
  const mixedYears = ayalonYearVolumes([...many, y25]);
  if (mixedYears.get(2025)?.tier.id !== "base") {
    throw new Error("2025 volume must not inherit 2026 top tier");
  }

  const rollup = ayalonIncomeForProductions(many, { yearContext: many });
  if (rollup.volumeCount !== 42 || rollup.income !== 42 * 5100 || rollup.gamach !== 0) {
    throw new Error(`expected 42×5100 income and 0 gamach, got ${rollup.volumeCount}/${rollup.income}/${rollup.gamach}`);
  }
}
