import {
  agreementForDate,
  agentBelongsToEmployee,
  emptyPayContract,
  extrasAmountForMonth,
  countsForVolumeCommission,
  monthlyCostsTotal,
  FREELANCERS_4,
  filterFreelancers4PayProductions,
  freelancers1SettledForPayMonth,
  isEmployeeWageMonth,
  productionMonthKey,
  usesFreelancers1,
  isFreelancers3,
  isFreelancers4,
  oneTimeMonthsForContract,
  profileUsesHubProductions,
  salariedBaseWageForMonth,
  salariedVacationByMonth,
  toPayProfile,
  wageForContractProductions,
  type EmploymentKind,
  type SalaryKind,
} from "@/lib/employees/contract";
import { monthLabel } from "@/lib/employees/review";
import type { FinanceEmployee } from "@/lib/finance/categories";
import { jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import { sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export type PayrollPreset = "this_month" | "last_month" | "ytd" | "range" | "all" | "month";

export type PayrollMonthSlice = {
  month: string;
  label: string;
  employmentKind: EmploymentKind | null;
  salaryKind: SalaryKind | null;
  hours: number;
  agreementWage: number;
  volumeWage: number;
  settledWage: number;
  pensionWage: number;
  volumeCount: number;
  volumePremium: number;
  settledCount: number;
  settledPremium: number;
  monthlyCosts: number;
  total: number;
};

export type PayrollEmployeeRow = {
  employeeId: string;
  fullName: string;
  department: string | null;
  waitCircle: string | null;
  employmentKind: EmploymentKind | null;
  salaryKind: SalaryKind | null;
  agreementLabel: string;
  hours: number;
  agreementWage: number;
  volumeWage: number;
  settledWage: number;
  pensionWage: number;
  premiumWage: number;
  volumeCount: number;
  volumePremium: number;
  settledCount: number;
  settledPremium: number;
  monthlyCosts: number;
  total: number;
  months: PayrollMonthSlice[];
};

export type PayrollLedger = {
  months: string[];
  employees: PayrollEmployeeRow[];
  totals: Omit<
    PayrollEmployeeRow,
    | "employeeId"
    | "fullName"
    | "department"
    | "waitCircle"
    | "employmentKind"
    | "salaryKind"
    | "agreementLabel"
    | "months"
  > & { employeeCount: number; withPay: number };
  byMonth: PayrollMonthSlice[];
};

export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (!year || !m) return month;
  const index = year * 12 + (m - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthsInRange(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return [];
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return out;
}

export function collectActivityMonths(
  productions: Array<{ startDate?: string; transferDate?: string }>,
  hoursMonths: string[],
  contracts: Array<Parameters<typeof oneTimeMonthsForContract>[0]> = [],
): string[] {
  const set = new Set<string>();
  for (const row of productions) {
    const month = productionMonthKey(row);
    if (month && isEmployeeWageMonth(month)) {
      set.add(month);
      const delayed = shiftMonth(month, 2);
      if (isEmployeeWageMonth(delayed)) set.add(delayed);
    }
  }
  for (const month of hoursMonths) {
    if (isEmployeeWageMonth(month)) set.add(month);
  }
  for (const contract of contracts) {
    for (const month of oneTimeMonthsForContract(contract)) {
      if (isEmployeeWageMonth(month)) set.add(month);
    }
  }
  return Array.from(set).sort();
}

export function resolvePayrollMonths(input: {
  preset: PayrollPreset;
  from?: string;
  to?: string;
  month?: string;
  today?: string;
  activityMonths?: string[];
}): string[] {
  const today = (input.today ?? jerusalemYmd()).slice(0, 10);
  const thisMonth = today.slice(0, 7);
  if (input.preset === "this_month") return [thisMonth];
  if (input.preset === "last_month") return [shiftMonth(thisMonth, -1)];
  if (input.preset === "month") {
    const picked =
      input.month && /^\d{4}-\d{2}$/.test(input.month) ? input.month : thisMonth;
    return [picked];
  }
  if (input.preset === "ytd") return monthsInRange(`${today.slice(0, 4)}-01`, thisMonth);
  if (input.preset === "range") {
    const from = input.from && /^\d{4}-\d{2}$/.test(input.from) ? input.from : thisMonth;
    const to = input.to && /^\d{4}-\d{2}$/.test(input.to) ? input.to : thisMonth;
    return monthsInRange(from, to);
  }
  const activity = (input.activityMonths ?? []).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort();
  if (activity.length === 0) return [thisMonth];
  return activity;
}

function emptySlice(month: string): PayrollMonthSlice {
  return {
    month,
    label: monthLabel(month),
    employmentKind: null,
    salaryKind: null,
    hours: 0,
    agreementWage: 0,
    volumeWage: 0,
    settledWage: 0,
    pensionWage: 0,
    volumeCount: 0,
    volumePremium: 0,
    settledCount: 0,
    settledPremium: 0,
    monthlyCosts: 0,
    total: 0,
  };
}

function addSlice(target: PayrollMonthSlice, extra: PayrollMonthSlice) {
  target.hours += extra.hours;
  target.agreementWage += extra.agreementWage;
  target.volumeWage += extra.volumeWage;
  target.settledWage += extra.settledWage;
  target.pensionWage += extra.pensionWage;
  target.volumeCount += extra.volumeCount;
  target.volumePremium += extra.volumePremium;
  target.settledCount += extra.settledCount;
  target.settledPremium += extra.settledPremium;
  target.monthlyCosts += extra.monthlyCosts;
  target.total += extra.total;
}

export function agreementLabelFor(
  kind: EmploymentKind | null,
  salaryKind: SalaryKind | null,
  contract: {
    hourlyRate: number;
    globalSalary: number;
    travelAmount?: number;
    variableExpenses?: { amount: number; note: string }[];
    volumePercent: number;
    settledPercent: number;
    freelancerFormula?: string;
    pensionEmployeePercent?: number;
    pensionEmployerPercent?: number;
    studyFundEmployeePercent?: number;
    studyFundEmployerPercent?: number;
    contributionCeiling?: number;
    severanceEmployerPercent?: number;
    pensionFromFirstMonth?: boolean;
    stationCost?: number;
    operationsCost?: number;
    officeCost?: number;
  } | null,
): string {
  if (!kind || !contract) return "אין הסכם";
  if (kind === "unpaid") return "ללא שכר";
  if (kind === "freelancer") {
    const extrasTotal = (contract.variableExpenses ?? [])
      .filter((row) => row.amount > 0 && row.note.trim())
      .reduce((sum, row) => sum + Math.round(row.amount), 0);
    const extras = extrasTotal
      ? `הוצאות משתנות ₪${extrasTotal.toLocaleString("he-IL")}`
      : null;
    const costs = monthlyCostsTotal(contract);
    const costLabel = costs ? `עלויות ₪${costs.toLocaleString("he-IL")}` : null;
    const parts = [
      isFreelancers4(contract)
        ? `עצמאים 4 אביחי יוסף · ₪${FREELANCERS_4.fixedMonthly.toLocaleString("he-IL")} קבוע + היקף ליבה · פער קיזוזים חד־פעמי ₪${FREELANCERS_4.oneTimeGap.amount.toLocaleString("he-IL")}`
        : isFreelancers3(contract)
        ? "עצמאים 3 בן סגל · מכפיל 7 · בלי נפרעים"
        : contract.volumePercent
          ? `היקף ${contract.volumePercent}%`
          : null,
      isFreelancers3(contract)
        ? null
        : contract.freelancerFormula === "freelancers_4"
          ? "נפרעים 3% · שוטף 60 ונגרר · ליבה בלי שמש"
        : contract.freelancerFormula === "freelancers_1"
          ? "נפרעים 1 · שוטף 60 ונגרר"
          : contract.freelancerFormula === "freelancers_2"
            ? "נפרעים 2 · 9.3% · שוטף 60 ונגרר"
            : contract.settledPercent
              ? `נפרעים ${contract.settledPercent}%`
              : null,
      extras,
      costLabel,
    ].filter(Boolean);
    return parts.join(" · ") || "עצמאי";
  }
  const travel = contract.travelAmount
    ? `נסיעות ₪${Math.round(contract.travelAmount).toLocaleString("he-IL")}`
    : null;
  const extrasTotal = (contract.variableExpenses ?? [])
    .filter((row) => row.amount > 0 && row.note.trim())
    .reduce((sum, row) => sum + Math.round(row.amount), 0);
  const extras = extrasTotal
    ? `הוצאות משתנות ₪${extrasTotal.toLocaleString("he-IL")}`
    : null;
  const costLabel = monthlyCostsTotal(contract)
    ? `עלויות ₪${monthlyCostsTotal(contract).toLocaleString("he-IL")}`
    : null;
  const severance =
    contract.severanceEmployerPercent
      ? `פיצויים ${contract.severanceEmployerPercent}%`
      : null;
  const pension =
    contract.pensionEmployerPercent || contract.pensionEmployeePercent
      ? contract.pensionFromFirstMonth === false
        ? `פנסיה ${contract.pensionEmployerPercent || 0}% מעסיק · אחרי 3 חודשים`
        : `פנסיה ${contract.pensionEmployerPercent || 0}% מעסיק`
      : null;
  const study =
    contract.studyFundEmployerPercent || contract.studyFundEmployeePercent
      ? `השתלמות ${contract.studyFundEmployerPercent || 0}% מעסיק`
      : null;
  const ceiling = contract.contributionCeiling
    ? `תקרה ₪${Math.round(contract.contributionCeiling).toLocaleString("he-IL")}`
    : null;
  if (salaryKind === "salary_only") {
    const base = contract.globalSalary > 0
      ? `רק משכורת ₪${Math.round(contract.globalSalary).toLocaleString("he-IL")}`
      : "רק משכורת";
    return [base, costLabel, severance, pension, study, ceiling].filter(Boolean).join(" · ");
  }
  if (salaryKind === "global") {
    const base = contract.globalSalary > 0 ? `גלובלי ₪${Math.round(contract.globalSalary).toLocaleString("he-IL")}` : "שכר גלובלי";
    return [base, travel, extras, costLabel, severance, pension, study, ceiling].filter(Boolean).join(" · ");
  }
  const hourly = contract.hourlyRate > 0
    ? `שעתי ₪${Math.round(contract.hourlyRate).toLocaleString("he-IL")}`
    : "שכר שעתי";
  return [hourly, travel, extras, costLabel, severance, pension, study, ceiling].filter(Boolean).join(" · ");
}

function roundMoney(value: number): number {
  return Math.round(value);
}

export function buildPayrollLedger(input: {
  employees: FinanceEmployee[];
  productions: MarketingProduction[];
  hoursByEmployee: Map<string, Record<string, number>>;
  vacationByEmployee?: Map<string, Record<string, number>>;
  months: string[];
}): PayrollLedger {
  const months = input.months.filter((month) => /^\d{4}-\d{2}$/.test(month));
  const employees: PayrollEmployeeRow[] = [];

  for (const emp of input.employees) {
    if (!emp.is_active) continue;
    const hoursByMonth = input.hoursByEmployee.get(emp.id) ?? {};
    const profile = toPayProfile({
      fullName: emp.full_name,
      employmentKind: emp.employment_kind,
      contract: emp.pay_contract,
      agreements: emp.agreements ?? [],
      hoursByMonth,
      vacationDaysByMonth: input.vacationByEmployee?.get(emp.id),
    });
    const ownProductions = profileUsesHubProductions(profile)
      ? filterFreelancers4PayProductions(input.productions)
      : input.productions.filter((row) => agentBelongsToEmployee(row.agent, emp.full_name));
    const salesByMonth: Record<string, number> = {};
    const lookbackMonths = new Set<string>([
      ...months,
      ...Object.keys(hoursByMonth),
      ...Object.keys(profile.vacationDaysByMonth ?? {}),
    ]);
    for (const row of ownProductions) {
      const month = productionMonthKey(row);
      if (month) lookbackMonths.add(month);
    }
    for (const month of lookbackMonths) {
      const monthRows = ownProductions.filter((row) => productionMonthKey(row) === month);
      salesByMonth[month] = wageForContractProductions(monthRows, {
        profiles: [profile],
        rates: [],
        fallback: 0,
        kind: "volume",
      });
    }
    const vacation = salariedVacationByMonth(profile, salesByMonth);
    const monthSlices: PayrollMonthSlice[] = [];

    for (const month of months) {
      const slice = emptySlice(month);
      const terms = agreementForDate(profile.agreements, `${month}-01`);
      const kind = terms?.employmentKind ?? null;
      const contract = terms?.contract ?? null;
      slice.employmentKind = kind;
      slice.salaryKind = kind === "salaried" ? (contract?.salaryKind ?? "hourly") : null;
      slice.hours = hoursByMonth[month] ?? 0;

      const monthRows = ownProductions.filter((row) => productionMonthKey(row) === month);
      const active = monthRows.filter((row) => row.status === "active");
      for (const row of active) {
        const report = sourcePnlKindForProcess(row.process ?? "");
        if (report === "volume") {
          if (!countsForVolumeCommission(row)) continue;
          slice.volumeCount += 1;
          slice.volumePremium += row.premium;
        } else if (report === "settled") {
          slice.settledCount += 1;
          slice.settledPremium += row.premium;
        }
      }

      const wageOptions = {
        profiles: [profile],
        rates: [],
        fallback: 0,
      };
      slice.volumeWage = wageForContractProductions(active, { ...wageOptions, kind: "volume" });
      slice.settledWage =
        kind === "salaried" || isFreelancers3(contract)
          ? 0
          : wageForContractProductions(active, { ...wageOptions, kind: "settled" });
      if (kind === "freelancer" && isFreelancers3(contract)) {
        slice.settledCount = 0;
        slice.settledPremium = 0;
        slice.settledWage = 0;
      } else if (kind === "freelancer" && usesFreelancers1(contract)) {
        const delayed = freelancers1SettledForPayMonth(profile, ownProductions, month);
        slice.settledCount = delayed.count;
        slice.settledPremium = delayed.premium;
        slice.settledWage = delayed.wage;
      }
      if (kind === "salaried" && contract) {
        slice.agreementWage = roundMoney(
          salariedBaseWageForMonth(
            contract,
            slice.hours,
            slice.volumeWage,
            vacation[month]?.amount ?? 0,
            { month, agreementFrom: terms?.from },
          ),
        );
      } else if (kind === "freelancer" && contract) {
        slice.agreementWage = extrasAmountForMonth(contract, month);
      }
      if (kind && kind !== "unpaid" && contract) {
        slice.monthlyCosts = monthlyCostsTotal(contract);
      }
      slice.volumePremium = roundMoney(slice.volumePremium);
      slice.settledPremium = roundMoney(slice.settledPremium);
      slice.total = slice.agreementWage + slice.volumeWage + slice.settledWage - slice.monthlyCosts;
      monthSlices.push(slice);
    }

    const lastTerms = [...monthSlices].reverse().find((row) => row.employmentKind);
    const latestAgreement = lastTerms
      ? agreementForDate(profile.agreements, `${lastTerms.month}-01`)
      : null;
    const summed = emptySlice("all");
    for (const slice of monthSlices) addSlice(summed, slice);

    employees.push({
      employeeId: emp.id,
      fullName: emp.full_name,
      department: emp.department,
      waitCircle: emp.wait_circle,
      employmentKind: lastTerms?.employmentKind ?? emp.employment_kind,
      salaryKind: lastTerms?.salaryKind ?? null,
      agreementLabel: agreementLabelFor(
        latestAgreement?.employmentKind ?? emp.employment_kind,
        latestAgreement?.contract.salaryKind ?? lastTerms?.salaryKind ?? null,
        latestAgreement?.contract ?? emp.pay_contract ?? emptyPayContract(),
      ),
      hours: summed.hours,
      agreementWage: summed.agreementWage,
      volumeWage: summed.volumeWage,
      settledWage: summed.settledWage,
      pensionWage: summed.pensionWage,
      premiumWage: summed.volumeWage + summed.settledWage,
      volumeCount: summed.volumeCount,
      volumePremium: summed.volumePremium,
      settledCount: summed.settledCount,
      settledPremium: summed.settledPremium,
      monthlyCosts: summed.monthlyCosts,
      total: summed.total,
      months: monthSlices,
    });
  }

  employees.sort((a, b) => b.total - a.total || a.fullName.localeCompare(b.fullName, "he"));

  const totals = {
    hours: 0,
    agreementWage: 0,
    volumeWage: 0,
    settledWage: 0,
    pensionWage: 0,
    premiumWage: 0,
    volumeCount: 0,
    volumePremium: 0,
    settledCount: 0,
    settledPremium: 0,
    monthlyCosts: 0,
    total: 0,
    employeeCount: employees.length,
    withPay: employees.filter((row) => row.total > 0).length,
  };
  for (const row of employees) {
    totals.hours += row.hours;
    totals.agreementWage += row.agreementWage;
    totals.volumeWage += row.volumeWage;
    totals.settledWage += row.settledWage;
    totals.pensionWage += row.pensionWage;
    totals.premiumWage += row.premiumWage;
    totals.volumeCount += row.volumeCount;
    totals.volumePremium += row.volumePremium;
    totals.settledCount += row.settledCount;
    totals.settledPremium += row.settledPremium;
    totals.monthlyCosts += row.monthlyCosts;
    totals.total += row.total;
  }

  const byMonth = months.map((month) => {
    const slice = emptySlice(month);
    for (const emp of employees) {
      const found = emp.months.find((row) => row.month === month);
      if (found) addSlice(slice, found);
    }
    return slice;
  });

  return { months, employees, totals, byMonth };
}

export function sumPayrollByMonth(
  employees: PayrollEmployeeRow[],
  months: string[],
): PayrollMonthSlice[] {
  return months.map((month) => {
    const slice = emptySlice(month);
    for (const emp of employees) {
      const found = emp.months.find((row) => row.month === month);
      if (found) addSlice(slice, found);
    }
    return slice;
  });
}

export function assertPayrollLedgerSplits(): void {
  const hourly = emptyPayContract();
  hourly.salaryKind = "hourly";
  hourly.hourlyRate = 50;
  hourly.productionTiers = [{ from: 0, to: null, multiplier: 2 }];

  const salaried: FinanceEmployee = {
    id: "e1",
    full_name: "ניב קובי",
    department: "מכירות",
    short_dial: null,
    email: null,
    direct_phone: null,
    outbound_number: null,
    sim_provider: null,
    wait_circle: "ליבה",
    dialer_type: null,
    notes: null,
    is_active: true,
    created_at: "",
    employment_kind: "salaried",
    pay_contract: hourly,
    agreements: [
      {
        id: "open",
        from: "",
        to: "",
        employmentKind: "salaried",
        contract: hourly,
      },
    ],
  };

  const hoursByEmployee = new Map<string, Record<string, number>>([
    ["e1", { "2026-07": 160 }],
  ]);
  const productions: MarketingProduction[] = [
    {
      key: "1",
      status: "active",
      statusRaw: "פעילה",
      premium: 1000,
      process: "מכירה",
      startDate: "2026-08-01",
      transferDate: "2026-08-01",
      client: "א",
      agent: "ניב קובי",
      product: "בריאות",
      company: "מגדל",
      source: "שיחות נכנסות",
      fields: {},
    },
    {
      key: "2",
      status: "active",
      statusRaw: "פעילה",
      premium: 2000,
      process: "מינוי סוכן",
      startDate: "2026-08-01",
      transferDate: "2026-08-01",
      client: "ב",
      agent: "ניב קובי",
      product: "בריאות",
      company: "מגדל",
      source: "שיחות נכנסות",
      fields: {},
    },
  ];

  const ledger = buildPayrollLedger({
    employees: [salaried],
    productions,
    hoursByEmployee,
    months: ["2026-07"],
  });
  const row = ledger.employees[0];
  if (!row) throw new Error("expected salaried payroll row");
  if (row.agreementWage !== 8000) {
    throw new Error(`expected hourly agreement 8000, got ${row.agreementWage}`);
  }
  if (row.volumeWage !== 2000) {
    throw new Error(`expected volume tiers 2000, got ${row.volumeWage}`);
  }
  if (row.settledWage !== 0) {
    throw new Error(`expected salaried settled 0, got ${row.settledWage}`);
  }
  if (row.total !== 10000) {
    throw new Error(`expected total 10000, got ${row.total}`);
  }

  const freelanceContract = emptyPayContract();
  freelancerFix(freelanceContract);
  const freelancer: FinanceEmployee = {
    ...salaried,
    id: "e2",
    employment_kind: "freelancer",
    pay_contract: freelanceContract,
    agreements: [
      {
        id: "open",
        from: "",
        to: "",
        employmentKind: "freelancer",
        contract: freelanceContract,
      },
    ],
  };
  const free = buildPayrollLedger({
    employees: [freelancer],
    productions,
    hoursByEmployee: new Map(),
    months: ["2026-07"],
  }).employees[0];
  if (!free) throw new Error("expected freelancer payroll row");
  if (free.agreementWage !== 0) {
    throw new Error(`expected freelancer agreement 0, got ${free.agreementWage}`);
  }
  if (free.volumeWage !== 5000 || free.settledWage !== 840) {
    throw new Error(`expected freelancer 5000/840, got ${free.volumeWage}/${free.settledWage}`);
  }

  const salariedApril = emptyPayContract();
  salariedApril.salaryKind = "global";
  salariedApril.globalSalary = 5000;
  salariedApril.productionTiers = [{ from: 0, to: null, multiplier: 5 }];
  const freelancerFromMay = emptyPayContract();
  freelancerFromMay.volumePercent = 500;
  freelancerFromMay.freelancerFormula = "freelancers_2";
  freelancerFromMay.stationCost = 550;
  const splitEmp: FinanceEmployee = {
    ...salaried,
    id: "e3",
    full_name: "חן בר און",
    employment_kind: "freelancer",
    pay_contract: freelancerFromMay,
    agreements: [
      {
        id: "apr",
        from: "2026-04-01",
        to: "2026-04-30",
        employmentKind: "salaried",
        contract: salariedApril,
      },
      {
        id: "may",
        from: "2026-05-01",
        to: "",
        employmentKind: "freelancer",
        contract: freelancerFromMay,
      },
    ],
  };
  const splitProductions: MarketingProduction[] = [
    {
      key: "apr",
      status: "active",
      statusRaw: "פעילה",
      premium: 800,
      process: "מכירה",
      startDate: "2026-04-15",
      transferDate: "2026-04-15",
      client: "א",
      agent: "חן בר און",
      product: "בריאות",
      company: "מגדל",
      source: "שיחות נכנסות",
      fields: {},
    },
    {
      key: "may",
      status: "active",
      statusRaw: "פעילה",
      premium: 1000,
      process: "מכירה",
      startDate: "2026-05-15",
      transferDate: "2026-05-15",
      client: "ב",
      agent: "חן בר און",
      product: "בריאות",
      company: "מגדל",
      source: "שיחות נכנסות",
      fields: {},
    },
  ];
  const split = buildPayrollLedger({
    employees: [splitEmp],
    productions: splitProductions,
    hoursByEmployee: new Map(),
    months: ["2026-04", "2026-05", "2026-07"],
  }).employees[0];
  if (!split) throw new Error("expected split-agreement payroll row");
  const apr = split.months.find((row) => row.month === "2026-04");
  const may = split.months.find((row) => row.month === "2026-05");
  const jul = split.months.find((row) => row.month === "2026-07");
  if (!apr || apr.employmentKind !== "salaried" || apr.settledWage !== 0 || apr.monthlyCosts !== 0 || apr.volumeWage !== 0 || apr.total !== 5000) {
    throw new Error(
      `expected April global salary 5000 only, got kind=${apr?.employmentKind} volume=${apr?.volumeWage} settled=${apr?.settledWage} costs=${apr?.monthlyCosts} total=${apr?.total}`,
    );
  }
  if (!may || may.employmentKind !== "freelancer" || may.volumeWage !== 5000 || may.settledWage !== 0 || may.monthlyCosts !== 550 || may.total !== 4450) {
    throw new Error(
      `expected May freelancer 5000−550, got volume=${may?.volumeWage} settled=${may?.settledWage} costs=${may?.monthlyCosts} total=${may?.total}`,
    );
  }
  if (!jul || jul.settledWage !== 93 || jul.monthlyCosts !== 550 || jul.total !== -457) {
    throw new Error(
      `expected July נפרעים 93 − 550 = −457, got settled=${jul?.settledWage} costs=${jul?.monthlyCosts} total=${jul?.total}`,
    );
  }

  const formula4 = emptyPayContract();
  formula4.freelancerFormula = "freelancers_4";
  const avichaiEmp: FinanceEmployee = {
    ...salaried,
    id: "e4",
    full_name: "אביחי יוסף",
    employment_kind: "freelancer",
    pay_contract: formula4,
    agreements: [
      {
        id: "open4",
        from: "",
        to: "",
        employmentKind: "freelancer",
        contract: formula4,
      },
    ],
  };
  const hubProd = (key: string, agent: string, premium: number, startDate: string): MarketingProduction => ({
    key,
    status: "active",
    statusRaw: "פעילה",
    premium,
    process: "מכירה",
    startDate,
    transferDate: startDate,
    client: key,
    agent,
    product: "בריאות",
    company: "מגדל",
    source: "שיחות נכנסות",
    fields: {},
  });
  const hubLedger = buildPayrollLedger({
    employees: [avichaiEmp],
    productions: [
      hubProd("a", "ניב קובי", 10000, "2026-04-10"),
      hubProd("b", "בן סגל", 11000, "2026-04-20"),
      { ...hubProd("s", "ניב - שמש", 8000, "2026-04-12"), source: "קמפיין שמש" },
      { ...hubProd("g", "שמש", 6000, "2026-04-18"), source: "קמפיין שמש" },
      hubProd("c", "ניב קובי", 19000, "2026-06-15"),
    ],
    hoursByEmployee: new Map(),
    months: ["2026-04", "2026-06"],
  }).employees[0];
  const hubApr = hubLedger?.months.find((row) => row.month === "2026-04");
  const hubJun = hubLedger?.months.find((row) => row.month === "2026-06");
  if (!hubApr || hubApr.volumePremium !== 35000 || hubApr.volumeWage !== 26250 || hubApr.agreementWage !== 5000 || hubApr.settledWage !== 0 || hubApr.total !== 31250) {
    throw new Error(
      `expected April hub 35,000×75% + 5,000 קבוע = 31,250, got premium=${hubApr?.volumePremium} volume=${hubApr?.volumeWage} extras=${hubApr?.agreementWage} settled=${hubApr?.settledWage} total=${hubApr?.total}`,
    );
  }
  if (!hubJun || hubJun.volumeWage !== 9500 || hubJun.settledWage !== 630 || hubJun.agreementWage !== 5000 || hubJun.total !== 15130) {
    throw new Error(
      `expected June 19,000×50% + נפרעים 630 from ליבה only + 5,000 = 15,130, got volume=${hubJun?.volumeWage} settled=${hubJun?.settledWage} extras=${hubJun?.agreementWage} total=${hubJun?.total}`,
    );
  }
}

function freelancerFix(contract: ReturnType<typeof emptyPayContract>) {
  contract.volumePercent = 500;
  contract.settledPercent = 42;
}
