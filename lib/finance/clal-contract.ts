/**
 * Live Clal contract: two independent volume ladders + 10% GAMACH + settled 22% שוטף 60.
 * Risk/health ladder 75/78/85. Mortgage-only ladder 70/75/80. Volume שוטף 30 from production.
 */
import { productionDateOf } from "@/lib/employees/contract";
import {
  normalizeExcelText,
  sourcePnlKindForProcess,
} from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export const CLAL_COMPANY_TOKEN = "כלל";
export const CLAL_ANNUAL_MONTHS = 12;
export const CLAL_GAMACH_RATE = 0.1;
export const CLAL_LADDER_BASE_RATE = 0.75;
export const CLAL_MORTGAGE_BASE_RATE = 0.7;
export const CLAL_SETTLED_RATE = 0.22;
/** שוטף 30 = one calendar month after the production month. */
export const CLAL_VOLUME_PAY_DELAY_MONTHS = 1;
/** שוטף 60 = two calendar months after the production month. */
export const CLAL_SETTLED_PAY_DELAY_MONTHS = 2;

export type ClalTrack = "ladder" | "mortgage";
export type ClalTierId = "base" | "mid" | "top";

export type ClalVolumeTier = {
  id: ClalTierId;
  from: number;
  to: number | null;
  rate: number;
  cashRate: number;
  gamachRate: number;
  retroFromBase: number;
};

function tier(
  id: ClalTierId,
  from: number,
  to: number | null,
  rate: number,
  baseRate: number,
): ClalVolumeTier {
  return {
    id,
    from,
    to,
    rate,
    cashRate: Number((rate - CLAL_GAMACH_RATE).toFixed(2)),
    gamachRate: CLAL_GAMACH_RATE,
    retroFromBase: Number((rate - baseRate).toFixed(2)),
  };
}

/** ריסק / בריאות / מחלות קשות / מחלות סרטן */
export const CLAL_LADDER_TIERS: readonly ClalVolumeTier[] = [
  tier("base", 1, 249_999, 0.75, CLAL_LADDER_BASE_RATE),
  tier("mid", 250_000, 499_999, 0.78, CLAL_LADDER_BASE_RATE),
  tier("top", 500_000, null, 0.85, CLAL_LADDER_BASE_RATE),
] as const;

/** משכנתאות בלבד */
export const CLAL_MORTGAGE_TIERS: readonly ClalVolumeTier[] = [
  tier("base", 1, 249_999, 0.7, CLAL_MORTGAGE_BASE_RATE),
  tier("mid", 250_000, 499_999, 0.75, CLAL_MORTGAGE_BASE_RATE),
  tier("top", 500_000, null, 0.8, CLAL_MORTGAGE_BASE_RATE),
] as const;

export type ClalIncomeKind = "volume" | "settled" | "none";

export type ClalRowIncome = {
  kind: ClalIncomeKind;
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
  track: ClalTrack | null;
  mortgage: boolean;
};

export type ClalYearVolume = {
  year: number;
  track: ClalTrack;
  determiningPremium: number;
  count: number;
  tier: ClalVolumeTier;
};

export type ClalIncomeRollup = {
  income: number;
  cash: number;
  gamach: number;
  volume: number;
  settled: number;
  retro: number;
  count: number;
  volumeCount: number;
  settledCount: number;
  years: ClalYearVolume[];
};

const EMPTY_ROW: ClalRowIncome = {
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
  track: null,
  mortgage: false,
};

export function isClalCompany(company: string | null | undefined): boolean {
  const v = normalizeExcelText(company);
  if (!v) return false;
  return v === CLAL_COMPANY_TOKEN || v.startsWith(`${CLAL_COMPANY_TOKEN} `) || v.includes("כלל ביטוח");
}

/** משכנתא — לא ריסק משועבד / חיים. */
export function isClalMortgageProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v.includes("משכנת")) return false;
  if (v.includes("משועבד")) return false;
  if (v.includes("ריסק")) return false;
  if (v.includes("חיים")) return false;
  return true;
}

/** ריסק / בריאות / מחלות קשות / מחלות סרטן */
export function isClalLadderProduct(product: string | null | undefined): boolean {
  const v = normalizeExcelText(product);
  if (!v || isClalMortgageProduct(v)) return false;
  if (v.includes("בריאות")) return true;
  if (v.includes("מחלות קשות")) return true;
  if (v.includes("סרטן") || v.includes("מזור")) return true;
  if (v.includes("חיים")) return true;
  if (v.includes("ריסק")) return true;
  if (v.includes("משועבד")) return true;
  return false;
}

export function isClalCoveredProduct(product: string | null | undefined): boolean {
  return isClalMortgageProduct(product) || isClalLadderProduct(product);
}

export function clalTrackOf(product: string | null | undefined): ClalTrack | null {
  if (isClalMortgageProduct(product)) return "mortgage";
  if (isClalLadderProduct(product)) return "ladder";
  return null;
}

export function clalDeterminingPremium(monthlyPremium: number): number {
  const monthly = Number(monthlyPremium) || 0;
  if (!(monthly > 0)) return 0;
  return Math.round(monthly * CLAL_ANNUAL_MONTHS);
}

export function clalCalendarYearOf(
  row: Pick<MarketingProduction, "startDate" | "transferDate">,
): number | null {
  const iso = productionDateOf(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return Number(iso.slice(0, 4));
}

function pickTier(tiers: readonly ClalVolumeTier[], annualDeterminingPremium: number): ClalVolumeTier {
  const volume = Math.max(0, Math.round(annualDeterminingPremium));
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (volume >= tiers[i].from) return tiers[i];
  }
  return tiers[0];
}

export function clalLadderTier(annualDeterminingPremium: number): ClalVolumeTier {
  return pickTier(CLAL_LADDER_TIERS, annualDeterminingPremium);
}

export function clalMortgageTier(annualDeterminingPremium: number): ClalVolumeTier {
  return pickTier(CLAL_MORTGAGE_TIERS, annualDeterminingPremium);
}

export function clalVolumeTier(annualDeterminingPremium: number, track: ClalTrack): ClalVolumeTier {
  return track === "mortgage"
    ? clalMortgageTier(annualDeterminingPremium)
    : clalLadderTier(annualDeterminingPremium);
}

function isActiveRow(row: Pick<MarketingProduction, "status">): boolean {
  return row.status === "active";
}

export function countsForClalVolume(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (!isClalCompany(row.company)) return false;
  return isClalCoveredProduct(row.product);
}

export function countsForClalSettled(
  row: Pick<MarketingProduction, "status" | "process" | "company" | "product">,
): boolean {
  if (!isActiveRow(row)) return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "settled") return false;
  if (!isClalCompany(row.company)) return false;
  return isClalCoveredProduct(row.product);
}

export type ClalYearVolumes = {
  ladder: Map<number, ClalYearVolume>;
  mortgage: Map<number, ClalYearVolume>;
};

function emptyVolumes(): ClalYearVolumes {
  return { ladder: new Map(), mortgage: new Map() };
}

export function clalYearVolumes(
  rows: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >[],
): ClalYearVolumes {
  const byTrack: Record<ClalTrack, Map<number, { determiningPremium: number; count: number }>> = {
    ladder: new Map(),
    mortgage: new Map(),
  };
  for (const row of rows) {
    if (!countsForClalVolume(row)) continue;
    const track = clalTrackOf(row.product);
    const year = clalCalendarYearOf(row);
    if (!track || !year) continue;
    const current = byTrack[track].get(year) ?? { determiningPremium: 0, count: 0 };
    current.determiningPremium += clalDeterminingPremium(row.premium);
    current.count += 1;
    byTrack[track].set(year, current);
  }
  const out = emptyVolumes();
  for (const track of ["ladder", "mortgage"] as const) {
    for (const [year, row] of byTrack[track]) {
      out[track].set(year, {
        year,
        track,
        determiningPremium: row.determiningPremium,
        count: row.count,
        tier: clalVolumeTier(row.determiningPremium, track),
      });
    }
  }
  return out;
}

function allYearRows(volumes: ClalYearVolumes): ClalYearVolume[] {
  return [...volumes.ladder.values(), ...volumes.mortgage.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.track.localeCompare(b.track);
  });
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function explainClalIncome(
  row: Pick<
    MarketingProduction,
    "status" | "process" | "company" | "product" | "premium" | "startDate" | "transferDate"
  >,
  yearVolumes: ClalYearVolumes,
): ClalRowIncome {
  const monthlyPremium = Math.round(Number(row.premium) || 0);
  const year = clalCalendarYearOf(row);
  const track = clalTrackOf(row.product);
  const mortgage = track === "mortgage";

  if (countsForClalVolume(row) && track) {
    const annual = clalDeterminingPremium(monthlyPremium);
    const yearRow = year ? yearVolumes[track].get(year) : undefined;
    const tier = yearRow?.tier ?? clalVolumeTier(0, track);
    const entitled = Math.round(annual * tier.rate);
    const cash = Math.round(annual * tier.cashRate);
    const gamach = Math.round(annual * tier.gamachRate);
    const retro = Math.round(annual * tier.retroFromBase);
    const delay = CLAL_VOLUME_PAY_DELAY_MONTHS * 30;
    const trackLabel = mortgage ? "משכנתא" : "ריסק / בריאות / מחלות";
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
      track,
      mortgage,
      formula: `${trackLabel} · פרמיה ${monthlyPremium} × ${CLAL_ANNUAL_MONTHS} × ${pctLabel(tier.rate)} · שוטף ${pctLabel(tier.cashRate)} (${delay}) · גמ״ח ${pctLabel(tier.gamachRate)} לסוף שנה`,
    };
  }

  if (countsForClalSettled(row)) {
    const settled = Math.round(monthlyPremium * CLAL_SETTLED_RATE);
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
      track,
      mortgage,
      formula: `נפרעים ${pctLabel(CLAL_SETTLED_RATE)} שוטף ${CLAL_SETTLED_PAY_DELAY_MONTHS * 30} · פרמיה × ${pctLabel(CLAL_SETTLED_RATE)}`,
    };
  }

  return { ...EMPTY_ROW, monthlyPremium, year, track, mortgage };
}

function addRollup(into: ClalIncomeRollup, row: ClalRowIncome): void {
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

export function clalIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): ClalIncomeRollup {
  const yearVolumes = clalYearVolumes(options?.yearContext ?? rows);
  const out: ClalIncomeRollup = {
    income: 0,
    cash: 0,
    gamach: 0,
    volume: 0,
    settled: 0,
    retro: 0,
    count: 0,
    volumeCount: 0,
    settledCount: 0,
    years: allYearRows(yearVolumes),
  };
  for (const row of rows) {
    addRollup(out, explainClalIncome(row, yearVolumes));
  }
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function formatClalTierLabel(tier: ClalVolumeTier, track: ClalTrack): string {
  const to = tier.to == null ? "ומעלה" : `– ${tier.to.toLocaleString("he-IL")}`;
  const name = track === "mortgage" ? "משכנתא" : "ריסק / בריאות / מחלות";
  return `${name} · ${tier.from.toLocaleString("he-IL")} ${to} → היקף ${pctLabel(tier.rate)} (שוטף ${pctLabel(tier.cashRate)} · גמ״ח ${pctLabel(tier.gamachRate)})`;
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
    company: partial.company ?? "כלל",
    premium: partial.premium,
    status: partial.status ?? "active",
    statusRaw: partial.statusRaw ?? "פעילה",
    process: partial.process ?? "מכירה",
    startDate: partial.startDate ?? "2026-03-15",
    transferDate: partial.transferDate ?? "2026-03-15",
    fields: {},
  };
}

export function assertClalContract(): void {
  if (clalDeterminingPremium(500) !== 6000) {
    throw new Error(`expected 500×12=6000, got ${clalDeterminingPremium(500)}`);
  }
  if (clalLadderTier(1).rate !== 0.75 || clalLadderTier(249_999).id !== "base") {
    throw new Error("expected Clal ladder 75% under 250k");
  }
  if (clalLadderTier(250_000).rate !== 0.78 || clalLadderTier(499_999).id !== "mid") {
    throw new Error("expected Clal ladder 78% at 250k–499,999");
  }
  if (clalLadderTier(500_000).rate !== 0.85 || clalLadderTier(500_000).retroFromBase !== 0.1) {
    throw new Error("expected Clal ladder 85% from 500k with 10% retro");
  }
  if (clalMortgageTier(1).rate !== 0.7 || clalMortgageTier(249_999).cashRate !== 0.6) {
    throw new Error("expected Clal mortgage 70% / cash 60% under 250k");
  }
  if (clalMortgageTier(250_000).rate !== 0.75 || clalMortgageTier(499_999).id !== "mid") {
    throw new Error("expected Clal mortgage 75% at 250k–499,999");
  }
  if (clalMortgageTier(500_000).rate !== 0.8 || clalMortgageTier(500_000).cashRate !== 0.7) {
    throw new Error("expected Clal mortgage 80% / cash 70% from 500k");
  }

  const health = row({ premium: 500, key: "h1" });
  const healthYears = clalYearVolumes([health]);
  const healthExplained = explainClalIncome(health, healthYears);
  if (
    healthExplained.income !== 4500 ||
    healthExplained.cash !== 3900 ||
    healthExplained.gamach !== 600
  ) {
    throw new Error(
      `expected health 75% of 6000 = 4500 (cash 3900 + gamach 600), got ${healthExplained.income}/${healthExplained.cash}/${healthExplained.gamach}`,
    );
  }

  const mortgage = row({ premium: 500, product: "משכנתא", key: "m1" });
  const mortgageExplained = explainClalIncome(mortgage, clalYearVolumes([mortgage]));
  if (
    mortgageExplained.income !== 4200 ||
    mortgageExplained.cash !== 3600 ||
    mortgageExplained.gamach !== 600 ||
    mortgageExplained.volumeRate !== 0.7
  ) {
    throw new Error(
      `expected mortgage 70% of 6000 = 4200 (cash 3600 + gamach 600), got ${mortgageExplained.income}/${mortgageExplained.cash}/${mortgageExplained.gamach}`,
    );
  }

  const manyHealth = Array.from({ length: 84 }, (_, i) =>
    row({ premium: 500, key: `t${i}`, startDate: "2026-06-01", transferDate: "2026-06-01" }),
  );
  const topLadder = clalYearVolumes(manyHealth).ladder.get(2026);
  if (!topLadder || topLadder.tier.id !== "top") {
    throw new Error(`expected 84×6000 health to reach 85%, got ${topLadder?.determiningPremium}`);
  }
  const firstAtTop = explainClalIncome(manyHealth[0], clalYearVolumes(manyHealth));
  if (firstAtTop.income !== 5100 || firstAtTop.retro !== 600 || firstAtTop.cash !== 4500) {
    throw new Error(
      `expected retro 85% = 5100 / retro 600 / cash 4500, got ${firstAtTop.income}/${firstAtTop.retro}/${firstAtTop.cash}`,
    );
  }

  const manyMortgage = Array.from({ length: 84 }, (_, i) =>
    row({
      premium: 500,
      product: "משכנתא",
      key: `tm${i}`,
      startDate: "2026-06-01",
      transferDate: "2026-06-01",
    }),
  );
  const mixed = clalYearVolumes([...manyMortgage, health]);
  if (mixed.mortgage.get(2026)?.tier.id !== "top") {
    throw new Error("84 mortgage sales must hit 80% on the mortgage track");
  }
  if (mixed.ladder.get(2026)?.tier.id !== "base") {
    throw new Error("mortgage volume must not lift the risk/health ladder");
  }
  const lonelyHealth = explainClalIncome(health, mixed);
  if (lonelyHealth.volumeRate !== 0.75) {
    throw new Error(`health next to mortgage top must stay 75%, got ${lonelyHealth.volumeRate}`);
  }

  const cancelled = row({ premium: 500, status: "cancelled", statusRaw: "בוטלה" });
  if (explainClalIncome(cancelled, clalYearVolumes([cancelled])).income !== 0) {
    throw new Error("cancelled Clal sale must not count");
  }

  const migdal = row({ premium: 500, company: "מגדל" });
  if (explainClalIncome(migdal, clalYearVolumes([migdal])).income !== 0) {
    throw new Error("non-Clal company must be 0");
  }

  const pa = row({ premium: 500, product: "תאונות" });
  if (explainClalIncome(pa, clalYearVolumes([pa])).income !== 0) {
    throw new Error("personal accident is outside the Clal ladders");
  }

  const settled = row({ premium: 500, process: "מינוי", key: "s1" });
  const settledExplain = explainClalIncome(settled, clalYearVolumes([]));
  if (settledExplain.income !== 110 || settledExplain.kind !== "settled") {
    throw new Error(`expected settled 22% of 500 = 110, got ${settledExplain.income}`);
  }

  const pledged = row({ premium: 500, product: "ריסק משועבד", key: "r1" });
  if (clalTrackOf("ריסק משועבד") !== "ladder") {
    throw new Error("pledged risk belongs on the Clal risk/health ladder");
  }
  if (explainClalIncome(pledged, clalYearVolumes([pledged])).volumeRate !== 0.75) {
    throw new Error("pledged risk uses the 75/78/85 ladder");
  }

  const y25 = row({ premium: 500, startDate: "2025-11-01", transferDate: "2025-11-01", key: "y25" });
  const mixedYears = clalYearVolumes([...manyHealth, y25]);
  if (mixedYears.ladder.get(2025)?.tier.id !== "base") {
    throw new Error("2025 Clal volume must not inherit 2026 top tier");
  }

  const rollup = clalIncomeForProductions(manyHealth, { yearContext: manyHealth });
  if (rollup.volumeCount !== 84 || rollup.income !== 84 * 5100 || rollup.gamach !== 84 * 600) {
    throw new Error(
      `expected 84×5100 income and 84×600 gamach, got ${rollup.volumeCount}/${rollup.income}/${rollup.gamach}`,
    );
  }
}
