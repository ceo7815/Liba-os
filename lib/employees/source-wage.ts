import {
  canonicalAgentName,
  canonicalCampaignSource,
  jerusalemYmd,
  type DateRange,
} from "@/lib/sales-dashboard/campaign-math";
import {
  agentBelongsToEmployee,
  agreementForDate,
  countsForVolumeCommission,
  emptyPayContract,
  isEmployeeWageMonth,
  oneTimeAmountForMonth,
  productionMonthKey,
  salariedBaseWageForMonth,
  salariedVacationByMonth,
  shiftCalendarMonth,
  wageForContractProductions,
  EMPLOYEE_WAGE_FROM_MONTH,
  type EmployeePayProfile,
  type WageInputRow,
} from "@/lib/employees/contract";
import {
  assignOperatingBrand,
  matchesOperatingBrand,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";

export type UnassignedEmployerWage = {
  name: string;
  amount: number;
  months: string[];
};

export type SourceEmployerBase = {
  bySource: Map<string, number>;
  byWorkerSource: Map<string, number>;
  unassigned: UnassignedEmployerWage[];
  unassignedTotal: number;
};

export function workerSourceKey(workerName: string, sourceName: string): string {
  return `${canonicalAgentName(workerName) || workerName}\n${sourceName}`;
}

function monthsTouchingRange(range: DateRange): string[] {
  const startRaw = range.from?.slice(0, 7) || EMPLOYEE_WAGE_FROM_MONTH;
  const endRaw = range.to?.slice(0, 7) || jerusalemYmd().slice(0, 7);
  let cursor = startRaw < EMPLOYEE_WAGE_FROM_MONTH ? EMPLOYEE_WAGE_FROM_MONTH : startRaw;
  if (!/^\d{4}-\d{2}$/.test(cursor) || !/^\d{4}-\d{2}$/.test(endRaw) || cursor > endRaw) return [];
  const months: string[] = [];
  while (cursor <= endRaw) {
    if (isEmployeeWageMonth(cursor)) months.push(cursor);
    cursor = shiftCalendarMonth(cursor, 1);
  }
  return months;
}

function splitByWeight(total: number, parts: { key: string; weight: number }[]): Map<string, number> {
  const target = Math.round(total);
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const out = new Map<string, number>();
  if (target <= 0 || weightSum <= 0) return out;
  const ranked = parts
    .map((part) => {
      const exact = (target * part.weight) / weightSum;
      const floor = Math.floor(exact);
      return { key: part.key, floor, frac: exact - floor };
    })
    .sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key, "he"));
  let left = target - ranked.reduce((sum, part) => sum + part.floor, 0);
  for (const part of ranked) {
    const extra = left > 0 ? 1 : 0;
    if (extra) left -= 1;
    out.set(part.key, part.floor + extra);
  }
  return out;
}

function addAmount(map: Map<string, number>, key: string, amount: number) {
  if (!amount) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

/**
 * שכר בסיס של שכיר (שעתי או גלובלי, נסיעות, חופשה, הפרשות מעסיק)
 * מתחלק לפי פרמיית ההיקף של אותו חודש. בלי מכירה — נשאר בלי מקור.
 * מדרגות נשארות על המכירה ולא נכנסות לכאן.
 */
export function allocateSalariedEmployerBase(input: {
  profiles: EmployeePayProfile[];
  rows: WageInputRow[];
  range: DateRange;
  brand: OperatingBrandId;
  shemeshEmployeeNames?: Iterable<string>;
}): SourceEmployerBase {
  const months = monthsTouchingRange(input.range);
  const bySource = new Map<string, number>();
  const byWorkerSource = new Map<string, number>();
  const unassignedByName = new Map<string, { amount: number; months: string[] }>();

  for (const profile of input.profiles) {
    const salesByMonth: Record<string, number> = {};
    const monthRows = new Map<string, WageInputRow[]>();
    for (const row of input.rows) {
      if (!agentBelongsToEmployee(row.agent, profile.fullName)) continue;
      const month = productionMonthKey(row);
      if (!month || !isEmployeeWageMonth(month)) continue;
      const list = monthRows.get(month) ?? [];
      list.push(row);
      monthRows.set(month, list);
    }
    for (const [month, list] of monthRows) {
      salesByMonth[month] = wageForContractProductions(
        list.filter((row) => countsForVolumeCommission(row)),
        { profiles: [profile], rates: [], fallback: 0, kind: "volume", contextRows: input.rows },
      );
    }
    const vacation = salariedVacationByMonth(profile, salesByMonth);
    const workerName = canonicalAgentName(profile.fullName) || profile.fullName;

    for (const month of months) {
      const agreement = agreementForDate(profile.agreements ?? [], `${month}-01`);
      if (!agreement || agreement.employmentKind !== "salaried") continue;
      const salesWage = salesByMonth[month] ?? 0;
      const base =
        salariedBaseWageForMonth(
          agreement.contract,
          profile.hoursByMonth?.[month] ?? 0,
          salesWage,
          vacation[month]?.amount ?? 0,
          { month, agreementFrom: agreement.from },
        ) + oneTimeAmountForMonth(agreement.contract, month);
      if (base <= 0) continue;

      const weights = new Map<string, { weight: number; brand: ReturnType<typeof assignOperatingBrand> }>();
      for (const row of monthRows.get(month) ?? []) {
        if (!countsForVolumeCommission(row) || row.premium <= 0) continue;
        const source = canonicalCampaignSource(row.source ?? "");
        if (!source) continue;
        const brand = assignOperatingBrand({
          agent: row.agent,
          source: row.source,
          shemeshEmployeeNames: input.shemeshEmployeeNames,
        });
        const current = weights.get(source) ?? { weight: 0, brand };
        current.weight += row.premium;
        weights.set(source, current);
      }
      const parts = Array.from(weights.entries()).map(([key, value]) => ({
        key,
        weight: value.weight,
      }));
      if (parts.length === 0) {
        const current = unassignedByName.get(workerName) ?? { amount: 0, months: [] };
        current.amount += Math.round(base);
        current.months.push(month);
        unassignedByName.set(workerName, current);
        continue;
      }
      const shares = splitByWeight(base, parts);
      for (const [source, amount] of shares) {
        const brand = weights.get(source)?.brand ?? "liba";
        if (!matchesOperatingBrand(brand, input.brand)) continue;
        addAmount(bySource, source, amount);
        addAmount(byWorkerSource, workerSourceKey(workerName, source), amount);
      }
    }
  }

  const unassigned = Array.from(unassignedByName.entries())
    .map(([name, value]) => ({ name, amount: value.amount, months: value.months }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "he"));

  return {
    bySource,
    byWorkerSource,
    unassigned,
    unassignedTotal: unassigned.reduce((sum, row) => sum + row.amount, 0),
  };
}

export function employerBaseForWorker(
  allocation: Pick<SourceEmployerBase, "byWorkerSource">,
  workerName: string,
  sourceName: string,
): number {
  return allocation.byWorkerSource.get(workerSourceKey(workerName, sourceName)) ?? 0;
}

function assertSourceWageAllocation() {
  const contract = { ...emptyPayContract(), salaryKind: "hourly" as const, hourlyRate: 100 };
  const profile: EmployeePayProfile = {
    fullName: "דנה כהן",
    employmentKind: "salaried",
    contract,
    agreements: [
      { id: "a", from: "2026-01-01", to: "", employmentKind: "salaried", contract },
    ],
    hoursByMonth: { "2026-09": 10 },
  };
  const range = { from: "2026-09-01", to: "2026-09-30" };
  const sale = (source: string, premium: number): WageInputRow => ({
    status: "active",
    agent: "דנה כהן",
    premium,
    process: "מכירה",
    product: "ריסק",
    source,
    startDate: "2026-09-15",
    transferDate: "2026-09-15",
  });
  const idle = allocateSalariedEmployerBase({
    profiles: [profile],
    rows: [],
    range,
    brand: "all",
  });
  if (idle.unassignedTotal !== 1000 || idle.bySource.size !== 0) {
    throw new Error(`idle salaried base should sit unassigned, got ${idle.unassignedTotal}`);
  }
  const split = allocateSalariedEmployerBase({
    profiles: [profile],
    rows: [sale("גוגל", 600), sale("אלכסנדר", 400)],
    range,
    brand: "all",
  });
  if (split.bySource.get("גוגל") !== 600 || split.bySource.get("אלכסנדר") !== 400) {
    throw new Error(
      `expected 600/400 base split, got ${split.bySource.get("גוגל")}/${split.bySource.get("אלכסנדר")}`,
    );
  }
  if (split.unassignedTotal !== 0) {
    throw new Error(`sold month must not stay unassigned, got ${split.unassignedTotal}`);
  }
  const liba = allocateSalariedEmployerBase({
    profiles: [profile],
    rows: [sale("גוגל", 600), sale("קמפיין שמש", 400)],
    range,
    brand: "liba",
  });
  if (liba.bySource.get("גוגל") !== 600 || liba.bySource.has("קמפיין שמש") || liba.unassignedTotal !== 0) {
    throw new Error("brand filter must keep only that brand's share of the base");
  }
}

assertSourceWageAllocation();
