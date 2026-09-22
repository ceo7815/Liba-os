import {
  explainAyalonIncome,
  ayalonIncomeForProductions,
  ayalonYearVolumes,
} from "@/lib/finance/ayalon-contract";
import {
  explainClalIncome,
  clalIncomeForProductions,
  clalYearVolumes,
} from "@/lib/finance/clal-contract";
import {
  explainMigdalIncome,
  migdalIncomeForProductions,
  migdalYearVolumes,
  type MigdalIncomeRollup,
  type MigdalRowIncome,
} from "@/lib/finance/migdal-contract";
import {
  explainHarelIncome,
  harelIncomeForProductions,
  harelYearVolumes,
} from "@/lib/finance/harel-contract";
import {
  explainPhoenixIncome,
  phoenixIncomeForProductions,
  phoenixYearVolumes,
} from "@/lib/finance/phoenix-contract";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export type InsurerIncomeRollup = MigdalIncomeRollup;
export type InsurerRowIncome = MigdalRowIncome;

const EMPTY: InsurerIncomeRollup = {
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

function addRollup(
  into: InsurerIncomeRollup,
  part: {
    income: number;
    cash: number;
    gamach: number;
    volume: number;
    settled: number;
    retro: number;
    count: number;
    volumeCount: number;
    settledCount: number;
  },
): void {
  into.income += part.income;
  into.cash += part.cash;
  into.gamach += part.gamach;
  into.volume += part.volume;
  into.settled += part.settled;
  into.retro += part.retro;
  into.count += part.count;
  into.volumeCount += part.volumeCount;
  into.settledCount += part.settledCount;
}

function asInsurerRow(row: {
  kind: "volume" | "settled" | "none";
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
}): InsurerRowIncome {
  return {
    kind: row.kind,
    year: row.year,
    monthlyPremium: row.monthlyPremium,
    determiningPremium: row.determiningPremium,
    volumeRate: row.volumeRate,
    entitled: row.entitled,
    cash: row.cash,
    gamach: row.gamach,
    retro: row.retro,
    settled: row.settled,
    income: row.income,
    formula: row.formula,
  };
}

/** Company-by-company insurer income. No global multiplier. Unknown company = ₪0. */
export function insurerIncomeForProductions(
  rows: MarketingProduction[],
  options?: { yearContext?: MarketingProduction[] },
): InsurerIncomeRollup {
  if (!rows.length && !(options?.yearContext?.length)) return EMPTY;
  const out: InsurerIncomeRollup = { ...EMPTY, years: [] };
  addRollup(out, migdalIncomeForProductions(rows, options));
  addRollup(out, clalIncomeForProductions(rows, options));
  addRollup(out, ayalonIncomeForProductions(rows, options));
  addRollup(out, phoenixIncomeForProductions(rows, options));
  addRollup(out, harelIncomeForProductions(rows, options));
  out.income = Math.round(out.income);
  out.cash = Math.round(out.cash);
  out.gamach = Math.round(out.gamach);
  out.volume = Math.round(out.volume);
  out.settled = Math.round(out.settled);
  out.retro = Math.round(out.retro);
  return out;
}

export function explainInsurerIncome(
  row: MarketingProduction,
  yearContext: MarketingProduction[],
): InsurerRowIncome {
  const migdal = explainMigdalIncome(row, migdalYearVolumes(yearContext));
  if (migdal.kind !== "none") return migdal;
  const clal = explainClalIncome(row, clalYearVolumes(yearContext));
  if (clal.kind !== "none") return asInsurerRow(clal);
  const ayalon = explainAyalonIncome(row, ayalonYearVolumes(yearContext));
  if (ayalon.kind !== "none") return asInsurerRow(ayalon);
  const phoenix = explainPhoenixIncome(row, phoenixYearVolumes(yearContext));
  if (phoenix.kind !== "none") return asInsurerRow(phoenix);
  const harel = explainHarelIncome(row, harelYearVolumes(yearContext));
  if (harel.kind !== "none") return asInsurerRow(harel);
  return migdal;
}

export function insurerIncomeNote(rollup: InsurerIncomeRollup): string {
  const parts = ["לפי חוזה"];
  if (rollup.volume > 0) parts.push(`היקף ${Math.round(rollup.volume).toLocaleString("he-IL")} ₪`);
  if (rollup.settled > 0) parts.push(`נפרעים ${Math.round(rollup.settled).toLocaleString("he-IL")} ₪`);
  if (rollup.gamach > 0) parts.push(`מתוכו גמ״ח ${Math.round(rollup.gamach).toLocaleString("he-IL")} ₪ לסוף שנה`);
  if (rollup.income <= 0) return "לפי חוזה · חברה בלי הסכם = ₪0";
  return parts.join(" · ");
}
