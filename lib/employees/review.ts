import {
  agentBelongsToEmployee,
  agreementForDate,
  buildAgentPremiumTotals,
  buildMonthlyAgentPremiumTotals,
  countsForVolumeCommission,
  emptyPayContract,
  emptySalaryBenefits,
  emptyVacationPay,
  explainWageForProduction,
  extrasAmountForMonth,
  formatTierRange,
  FREELANCERS_4,
  filterFreelancers4PayProductions,
  freelancers1PayMonthsThrough,
  freelancers1SettledForPayMonth,
  freelancers1SettledForPayMonths,
  freelancers1SettledLifetime,
  freelancers1SettledMultiplier,
  freelancers1SettledWage,
  isEmployeeWageMonth,
  isFreelancers4,
  isSalaryOnly,
  monthlyCostLines,
  monthlyCostsTotal,
  oneTimeLinesForMonth,
  oneTimeMonthsForContract,
  productionDateOf,
  profileUsesHubProductions,
  salariedMonthlyPayMonths,
  usesFreelancerSettledBook,
  usesMonthlySalary,
  salariedBaseWageForMonth,
  salariedBaseWageForMonths,
  salariedVacationByMonth,
  salaryBenefitsForMonth,
  fixedMonthlyForMonth,
  validVariableExpenses,
  freelancers4VolumePercent,
  tierForProduction,
  wageForContractProductions,
  wageMonthKeyFromIso,
  type EmployeePayProfile,
  type EmploymentKind,
  type SalaryBenefits,
  type SalaryKind,
  type WageExplainReason,
} from "@/lib/employees/contract";
import { HEBREW_MONTHS, sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import {
  insurerIncome,
  jerusalemYmd,
  type AgentRate,
} from "@/lib/sales-dashboard/campaign-math";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

export type EmployeeBucket = {
  key: string;
  label: string;
  volumeCount: number;
  volumePremium: number;
  volumeWage: number;
  salesWage: number;
  baseWage: number;
  settledCount: number;
  settledPremium: number;
  settledWage: number;
  settledNewWage: number;
  settledTrailWage: number;
  pendingCount: number;
  pendingPremium: number;
  cancelledCount: number;
  cancelledPremium: number;
  earned: number;
  companyIncome: number;
  monthlyCosts: number;
  employmentKind: EmploymentKind | null;
};

export type EmployeeNamedRollup = {
  name: string;
  count: number;
  premium: number;
};

export type ReviewSaleLine = {
  key: string;
  month: string;
  date: string;
  client: string;
  agent: string;
  product: string;
  process: string;
  status: MarketingProduction["status"];
  statusRaw: string;
  premium: number;
  runningPremium: number;
  runningTierLabel: string;
  runningMultiplier: number;
  paidMultiplier: number;
  paidTierLabel: string;
  wage: number;
  reason: WageExplainReason;
  crossedTier: boolean;
  report: "volume" | "settled" | "other";
  settledKind?: "new" | "trail";
  saleMonth?: string;
};

export type ReviewMonthAudit = {
  month: string;
  label: string;
  volumePremium: number;
  monthMultiplier: number;
  monthTierLabel: string;
  baseWage: number;
  grossWage: number;
  hours: number;
  hourlyRate: number;
  globalSalary: number;
  travelAmount: number;
  variableExpenses: { amount: number; note: string }[];
  salaryKind: SalaryKind;
  benefits: SalaryBenefits;
  productionWage: number;
  vacationDays: number;
  vacationDayValue: number;
  vacationPay: number;
  vacationAverageGross: number;
  sales: ReviewSaleLine[];
  crossings: ReviewSaleLine[];
  settledSourceMonth?: string;
  deferredSettledSales?: ReviewSaleLine[];
  monthlyCosts: { key: string; label: string; amount: number }[];
  employmentKind: EmploymentKind | null;
};

export type EmployeeReview = {
  rows: MarketingProduction[];
  thisMonthKey: string;
  thisMonthLabel: string;
  all: EmployeeBucket;
  month: EmployeeBucket;
  ytd: EmployeeBucket;
  months: EmployeeBucket[];
  audits: ReviewMonthAudit[];
  products: EmployeeNamedRollup[];
  sources: EmployeeNamedRollup[];
  companies: EmployeeNamedRollup[];
  recent: (MarketingProduction & { wage: number; paidMultiplier: number; reason: WageExplainReason })[];
  unpaid: boolean;
  salaried: boolean;
  hasSalariedMonths: boolean;
  hasFreelancerMonths: boolean;
};

function emptyBucket(key: string, label: string): EmployeeBucket {
  return {
    key,
    label,
    volumeCount: 0,
    volumePremium: 0,
    volumeWage: 0,
    salesWage: 0,
    baseWage: 0,
    settledCount: 0,
    settledPremium: 0,
    settledWage: 0,
    settledNewWage: 0,
    settledTrailWage: 0,
    pendingCount: 0,
    pendingPremium: 0,
    cancelledCount: 0,
    cancelledPremium: 0,
    earned: 0,
    companyIncome: 0,
    monthlyCosts: 0,
    employmentKind: null,
  };
}

export function monthKeyFromIso(iso: string | undefined): string | null {
  if (!iso || iso === "—") return null;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  return `${HEBREW_MONTHS[month] ?? month} ${year}`;
}

export function productionsForEmployee(
  employeeName: string,
  productions: MarketingProduction[],
): MarketingProduction[] {
  return productions.filter((row) => agentBelongsToEmployee(row.agent, employeeName));
}

function namedRollup(rows: MarketingProduction[], field: "product" | "source" | "company") {
  const map = new Map<string, EmployeeNamedRollup>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const name = row[field] || "—";
    const current = map.get(name) ?? { name, count: 0, premium: 0 };
    current.count += 1;
    current.premium += row.premium;
    map.set(name, current);
  }
  return Array.from(map.values())
    .map((row) => ({ ...row, premium: Math.round(row.premium) }))
    .sort((a, b) => b.premium - a.premium || b.count - a.count)
    .slice(0, 8);
}

function applyFreelancers1Settled(
  bucket: EmployeeBucket,
  delayed: {
    count: number;
    premium: number;
    wage: number;
    newWage: number;
    trailWage: number;
  },
) {
  if (delayed.count <= 0 && delayed.wage <= 0 && delayed.newWage <= 0 && delayed.trailWage <= 0) {
    return;
  }
  bucket.settledCount = delayed.count;
  bucket.settledPremium = delayed.premium;
  bucket.settledWage = delayed.wage;
  bucket.settledNewWage = delayed.newWage;
  bucket.settledTrailWage = delayed.trailWage;
}

function rollupBucket(
  rows: MarketingProduction[],
  key: string,
  label: string,
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
  },
  allRows: MarketingProduction[] = rows,
  settledPayMonths?: string[],
): EmployeeBucket {
  const bucket = emptyBucket(key, label);
  const active = rows.filter((row) => row.status === "active");
  for (const row of rows) {
    const kind = sourcePnlKindForProcess(row.process ?? "");
    if (row.status === "pending") {
      bucket.pendingCount += 1;
      bucket.pendingPremium += row.premium;
      continue;
    }
    if (row.status === "cancelled") {
      bucket.cancelledCount += 1;
      bucket.cancelledPremium += row.premium;
      continue;
    }
    if (row.status !== "active") continue;
    if (kind === "volume") {
      if (!countsForVolumeCommission(row)) continue;
      bucket.volumeCount += 1;
      bucket.volumePremium += row.premium;
    } else if (kind === "settled") {
      bucket.settledCount += 1;
      bucket.settledPremium += row.premium;
    }
  }
  bucket.volumeWage = wageForContractProductions(active, {
    ...options,
    kind: "volume",
    contextRows: active,
  });
  bucket.salesWage = bucket.volumeWage;
  bucket.baseWage = 0;
  bucket.settledWage = wageForContractProductions(active, {
    ...options,
    kind: "settled",
    contextRows: active,
  });
  const profile = options.profiles[0];
  if (profile) {
    if (key === "all") {
      applyFreelancers1Settled(bucket, freelancers1SettledLifetime(profile, allRows));
    } else if (settledPayMonths) {
      applyFreelancers1Settled(
        bucket,
        freelancers1SettledForPayMonths(profile, allRows, settledPayMonths),
      );
    } else if (/^\d{4}-\d{2}$/.test(key)) {
      const payTerms = agreementForDate(profile.agreements ?? [], `${key}-01`);
      bucket.employmentKind = payTerms?.employmentKind ?? null;
      if (payTerms?.employmentKind === "freelancer" && usesFreelancerSettledBook(payTerms.contract)) {
        const delayed = freelancers1SettledForPayMonth(profile, allRows, key);
        bucket.settledCount = delayed.count;
        bucket.settledPremium = delayed.premium;
        bucket.settledWage = delayed.wage;
        bucket.settledNewWage = delayed.newWage;
        bucket.settledTrailWage = delayed.trailWage;
      } else if (payTerms?.employmentKind === "salaried") {
        bucket.settledCount = 0;
        bucket.settledPremium = 0;
        bucket.settledWage = 0;
        bucket.settledNewWage = 0;
        bucket.settledTrailWage = 0;
      }
    }
  }
  bucket.volumePremium = Math.round(bucket.volumePremium);
  bucket.settledPremium = Math.round(bucket.settledPremium);
  bucket.pendingPremium = Math.round(bucket.pendingPremium);
  bucket.cancelledPremium = Math.round(bucket.cancelledPremium);
  bucket.earned = bucket.volumeWage + bucket.settledWage;
  bucket.companyIncome = insurerIncome(bucket.volumePremium + bucket.settledPremium);
  return bucket;
}

function sortByProduction(a: MarketingProduction, b: MarketingProduction): number {
  return (
    productionDateOf(a).localeCompare(productionDateOf(b)) ||
    a.client.localeCompare(b.client, "he") ||
    a.key.localeCompare(b.key)
  );
}

export function buildMonthWageAudits(
  employeeName: string,
  rows: MarketingProduction[],
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
  },
  monthOrder: string[],
): ReviewMonthAudit[] {
  const profile = options.profiles[0] ?? null;
  const monthlyTotals = buildMonthlyAgentPremiumTotals(rows);
  const wageOptions = {
    ...options,
    kind: "all" as const,
    volumeByAgent: new Map<string, number>(),
    settledByAgent: new Map<string, number>(),
    monthlyTotals,
  };
  const byMonth = new Map<string, MarketingProduction[]>();
  for (const row of rows) {
    const key = wageMonthKeyFromIso(productionDateOf(row));
    if (!key) continue;
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }
  for (const month of monthOrder) {
    if (!byMonth.has(month)) byMonth.set(month, []);
  }

  const salesByMonth: Record<string, number> = {};
  for (const [month, list] of byMonth) {
    const active = list.filter((row) => row.status === "active");
    salesByMonth[month] = profile
      ? wageForContractProductions(active, { ...options, kind: "volume", contextRows: active })
      : 0;
  }
  const vacation = profile ? salariedVacationByMonth(profile, salesByMonth) : {};

  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, list]) => {
      const terms = profile ? agreementForDate(profile.agreements ?? [], `${month}-01`) : null;
      const contract = terms?.contract ?? emptyPayContract();
      const hours = profile?.hoursByMonth?.[month] ?? 0;
      const salaried = terms?.employmentKind === "salaried";
      const volumePremium = list
        .filter((row) => countsForVolumeCommission(row))
        .reduce((sum, row) => sum + row.premium, 0);
      const monthTier = tierForProduction(volumePremium, contract.productionTiers);
      const sales: ReviewSaleLine[] = [];
      let running = 0;
      for (const row of [...list].sort(sortByProduction)) {
        const reportRaw = sourcePnlKindForProcess(row.process ?? "");
        const report = reportRaw === "volume" || reportRaw === "settled" ? reportRaw : "other";
        const explained = explainWageForProduction(row, wageOptions);
        const isVolumeActive = countsForVolumeCommission(row);
        const before = isVolumeActive ? tierForProduction(running, contract.productionTiers) : null;
        if (isVolumeActive) running += row.premium;
        const after = tierForProduction(running, contract.productionTiers);
        const crossedTier = Boolean(
          isVolumeActive &&
            after &&
            before &&
            (after.from !== before.from || after.multiplier !== before.multiplier),
        );
        const monthPay =
          salaried &&
          !usesMonthlySalary(contract.salaryKind) &&
          isVolumeActive;
        const paidMultiplier = monthPay
          ? monthTier?.multiplier ?? 0
          : explained.multiplier;
        sales.push({
          key: row.key,
          month,
          date: productionDateOf(row),
          client: row.client,
          agent: row.agent,
          product: row.product,
          process: row.process,
          status: row.status,
          statusRaw: row.statusRaw,
          premium: row.premium,
          runningPremium: Math.round(running),
          runningTierLabel: formatTierRange(after),
          runningMultiplier: after?.multiplier ?? 0,
          paidMultiplier,
          paidTierLabel: monthPay
            ? formatTierRange(monthTier)
            : formatTierRange(explained.tier),
          wage: monthPay ? Math.round(row.premium * paidMultiplier) : explained.wage,
          reason: monthPay ? "tier" : explained.reason,
          crossedTier,
          report,
        });
      }
      const productionWage = sales
        .filter((row) => row.report === "volume")
        .reduce((sum, row) => sum + row.wage, 0);
      const delayed = profile
        ? freelancers1SettledForPayMonth(profile, rows, month)
        : null;
      const deferredSettledSales: ReviewSaleLine[] = [];
      if (delayed && (delayed.count > 0 || delayed.wage > 0)) {
        for (const row of rows) {
          if (row.status !== "active") continue;
          if (sourcePnlKindForProcess(row.process) !== "volume") continue;
          const saleMonth = wageMonthKeyFromIso(productionDateOf(row));
          if (!saleMonth || saleMonth > delayed.saleMonth) continue;
          const saleTerms = agreementForDate(profile?.agreements ?? [], `${saleMonth}-01`);
          if (
            saleTerms?.employmentKind !== "freelancer" ||
            !usesFreelancerSettledBook(saleTerms.contract)
          ) {
            continue;
          }
          deferredSettledSales.push({
            key: `${row.key}|נפרעים-1`,
            month,
            date: productionDateOf(row),
            client: row.client,
            agent: row.agent,
            product: row.product,
            process: row.process,
            status: row.status,
            statusRaw: row.statusRaw,
            premium: row.premium,
            runningPremium: 0,
            runningTierLabel: "—",
            runningMultiplier: 0,
            paidMultiplier: freelancers1SettledMultiplier(saleTerms.contract),
            paidTierLabel: "—",
            wage: freelancers1SettledWage(row.premium, saleTerms.contract),
            reason:
              saleTerms.contract.freelancerFormula === "freelancers_4"
                ? "freelancers_4"
                : saleTerms.contract.freelancerFormula === "freelancers_2"
                  ? "freelancers_2"
                  : "freelancers_1",
            crossedTier: false,
            report: "settled",
            settledKind: saleMonth === delayed.saleMonth ? "new" : "trail",
            saleMonth,
          });
        }
      }
      const vac = vacation[month] ?? emptyVacationPay();
      const benefitCtx = { month, agreementFrom: terms?.from };
      const benefits = salaried
        ? salaryBenefitsForMonth(contract, hours, productionWage, benefitCtx)
        : emptySalaryBenefits();
      const baseWage = salaried
        ? salariedBaseWageForMonth(contract, hours, productionWage, vac.amount, benefitCtx)
        : 0;
      const hub = terms?.employmentKind === "freelancer" && isFreelancers4(contract);
      const hubPercent = hub ? freelancers4VolumePercent(volumePremium) : 0;
      const fixedMonthly = fixedMonthlyForMonth(contract);
      return {
        month,
        label: monthLabel(month),
        volumePremium: Math.round(volumePremium),
        monthMultiplier: hub ? hubPercent / 100 : monthTier?.multiplier ?? 0,
        monthTierLabel: hub
          ? hubPercent >= FREELANCERS_4.highVolumePercent
            ? `מוקד ליבה ${FREELANCERS_4.hubThreshold.toLocaleString("he-IL")}+`
            : "מוקד ליבה עד 20,000"
          : formatTierRange(monthTier),
        baseWage,
        grossWage: baseWage - benefits.employerExtra,
        hours,
        hourlyRate: contract.hourlyRate,
        globalSalary: contract.globalSalary,
        travelAmount: contract.travelAmount,
        variableExpenses: [
          ...(fixedMonthly > 0 ? [{ amount: fixedMonthly, note: "שכר קבוע" }] : []),
          ...validVariableExpenses(contract).map((row) => ({
            amount: Math.round(row.amount),
            note: row.note.trim(),
          })),
          ...oneTimeLinesForMonth(contract, month).map((row) => ({
            amount: row.amount,
            note: `${row.note} · חד־פעמי`,
          })),
        ],
        salaryKind: contract.salaryKind ?? "hourly",
        benefits,
        productionWage,
        vacationDays: vac.days,
        vacationDayValue: vac.dayValue,
        vacationPay: vac.amount,
        vacationAverageGross: vac.averageGross,
        sales,
        crossings: sales.filter((row) => row.crossedTier),
        settledSourceMonth: delayed?.saleMonth || undefined,
        deferredSettledSales,
        monthlyCosts: terms?.employmentKind === "unpaid" || !terms ? [] : monthlyCostLines(contract),
        employmentKind: terms?.employmentKind ?? null,
      };
    });
}

export function buildEmployeeReview(
  employeeName: string,
  productions: MarketingProduction[],
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
  },
): EmployeeReview {
  const profile = options.profiles[0] ?? null;
  const scoped = profileUsesHubProductions(profile)
    ? filterFreelancers4PayProductions(productions)
    : productionsForEmployee(employeeName, productions);
  const rows = scoped.filter((row) => {
    const key = wageMonthKeyFromIso(productionDateOf(row));
    return !key || isEmployeeWageMonth(key);
  });
  const today = jerusalemYmd();
  const thisMonthKey = today.slice(0, 7);
  const byMonth = new Map<string, MarketingProduction[]>();
  const monthRows: MarketingProduction[] = [];
  const ytdRows: MarketingProduction[] = [];

  for (const row of rows) {
    const key = wageMonthKeyFromIso(productionDateOf(row));
    if (key) {
      const list = byMonth.get(key) ?? [];
      list.push(row);
      byMonth.set(key, list);
      if (key === thisMonthKey) monthRows.push(row);
      if (key.startsWith(today.slice(0, 4)) && key <= thisMonthKey) ytdRows.push(row);
    }
  }

  const hoursMonths = Object.keys(profile?.hoursByMonth ?? {});
  for (const key of hoursMonths) {
    if (isEmployeeWageMonth(key) && !byMonth.has(key)) byMonth.set(key, []);
  }
  if (profile) {
    for (const payMonth of freelancers1PayMonthsThrough(profile, rows, thisMonthKey)) {
      if (isEmployeeWageMonth(payMonth) && !byMonth.has(payMonth)) byMonth.set(payMonth, []);
    }
    for (const payMonth of salariedMonthlyPayMonths(profile, thisMonthKey)) {
      if (!byMonth.has(payMonth)) byMonth.set(payMonth, []);
    }
    for (const agreement of profile.agreements ?? []) {
      for (const month of oneTimeMonthsForContract(agreement.contract)) {
        if (isEmployeeWageMonth(month) && !byMonth.has(month)) byMonth.set(month, []);
      }
    }
  }
  for (const key of Array.from(byMonth.keys())) {
    if (!isEmployeeWageMonth(key)) byMonth.delete(key);
  }

  const salesByMonth: Record<string, number> = {};
  const applyBase = (bucket: EmployeeBucket, monthsForBucket: string[]) => {
    if (!profile) {
      bucket.salesWage = bucket.volumeWage;
      return bucket;
    }
    bucket.salesWage = bucket.volumeWage;
    const extra = salariedBaseWageForMonths(profile, monthsForBucket, salesByMonth);
    bucket.baseWage = extra;
    bucket.volumeWage += extra;
    bucket.earned += extra;
    if (/^\d{4}-\d{2}$/.test(bucket.key)) {
      const terms = agreementForDate(profile.agreements ?? [], `${bucket.key}-01`);
      bucket.employmentKind = terms?.employmentKind ?? null;
      if (terms?.employmentKind === "salaried") {
        bucket.settledWage = 0;
        bucket.settledNewWage = 0;
        bucket.settledTrailWage = 0;
        bucket.settledCount = 0;
        bucket.settledPremium = 0;
        if (isSalaryOnly(terms.contract.salaryKind)) {
          bucket.salesWage = 0;
          bucket.volumeWage = extra;
        }
        bucket.earned = bucket.volumeWage;
      }
    }
    let costs = 0;
    for (const month of monthsForBucket) {
      if (!isEmployeeWageMonth(month)) continue;
      const terms = agreementForDate(profile.agreements ?? [], `${month}-01`);
      if (!terms || terms.employmentKind === "unpaid") continue;
      costs += monthlyCostsTotal(terms.contract);
      if (terms.employmentKind === "freelancer") {
        const extras = extrasAmountForMonth(terms.contract, month);
        bucket.baseWage += extras;
        bucket.earned += extras;
      }
    }
    bucket.monthlyCosts = costs;
    bucket.earned -= costs;
    return bucket;
  };

  const rolled = Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => {
      const bucket = rollupBucket(list, key, monthLabel(key), options, rows);
      salesByMonth[key] = bucket.volumeWage;
      return bucket;
    });
  const months = rolled.map((bucket) => applyBase(bucket, [bucket.key]));

  const allMonths = months.map((row) => row.key);
  const ytdMonths = allMonths.filter((key) => key.startsWith(today.slice(0, 4)));
  const thisMonthTerms = profile
    ? agreementForDate(profile.agreements ?? [], `${thisMonthKey}-01`)
    : null;
  const salaried = thisMonthTerms?.employmentKind === "salaried";
  const hasSalariedMonths = months.some((row) => row.employmentKind === "salaried");
  const hasFreelancerMonths = months.some((row) => row.employmentKind === "freelancer");

  const totals = buildAgentPremiumTotals(rows);
  const monthlyTotals = buildMonthlyAgentPremiumTotals(rows);
  const wageOptions = {
    ...options,
    kind: "all" as const,
    volumeByAgent: totals.volume,
    settledByAgent: totals.settled,
    monthlyTotals,
  };
  const recent = [...rows]
    .sort((a, b) => productionDateOf(b).localeCompare(productionDateOf(a)))
    .slice(0, 25)
    .map((row) => {
      const explained = explainWageForProduction(row, wageOptions);
      return {
        ...row,
        wage: explained.wage,
        paidMultiplier: explained.multiplier,
        reason: explained.reason,
      };
    });
  const audits = buildMonthWageAudits(employeeName, rows, options, allMonths);

  return {
    rows,
    thisMonthKey,
    thisMonthLabel: monthLabel(thisMonthKey),
    all: applyBase(rollupBucket(rows, "all", "כל התקופה", options, rows), allMonths),
    month: applyBase(
      rollupBucket(monthRows, thisMonthKey, monthLabel(thisMonthKey), options, rows),
      [thisMonthKey],
    ),
    ytd: applyBase(
      rollupBucket(ytdRows, "ytd", `מתחילת ${today.slice(0, 4)}`, options, rows, ytdMonths),
      ytdMonths,
    ),
    months,
    audits,
    products: namedRollup(rows, "product"),
    sources: namedRollup(rows, "source"),
    companies: namedRollup(rows, "company"),
    recent,
    unpaid: thisMonthTerms?.employmentKind === "unpaid" || profile?.employmentKind === "unpaid",
    salaried,
    hasSalariedMonths,
    hasFreelancerMonths,
  };
}

export function assertReviewTiersReset(): void {
  const contract = {
    ...emptyPayContract(),
    productionTiers: [
      { from: 0, to: 1500, multiplier: 1 },
      { from: 1501, to: 2500, multiplier: 2 },
      { from: 2501, to: null, multiplier: 5 },
    ],
  };
  const profiles: EmployeePayProfile[] = [
    {
      fullName: "ניב קובי",
      employmentKind: "salaried",
      contract,
      agreements: [
        {
          id: "open",
          from: "",
          to: "",
          employmentKind: "salaried",
          contract,
        },
      ],
    },
  ];
  const sale = (
    key: string,
    premium: number,
    startDate: string,
    client: string,
  ): MarketingProduction => ({
    key,
    source: "שיחות",
    client,
    agent: "ניב קובי",
    product: "בריאות",
    company: "מגדל",
    premium,
    status: "active",
    statusRaw: "פעילה",
    process: "מכירה",
    startDate,
    transferDate: startDate,
    fields: {},
  });
  const review = buildEmployeeReview(
    "ניב קובי",
    [
      sale("a", 1400, "2026-07-05", "לקוח א"),
      sale("d", 200, "2026-07-20", "לקוח ד"),
      sale("b", 400, "2026-08-03", "לקוח ב"),
    ],
    { profiles, rates: [] },
  );
  const july = review.audits.find((row) => row.month === "2026-07");
  const august = review.audits.find((row) => row.month === "2026-08");
  if (!july || july.monthMultiplier !== 2) {
    throw new Error(`expected July month multiplier 2, got ${july?.monthMultiplier}`);
  }
  if (!august || august.monthMultiplier !== 1) {
    throw new Error(`expected August reset to multiplier 1, got ${august?.monthMultiplier}`);
  }
  const firstAugust = august.sales[0];
  if (!firstAugust || firstAugust.paidMultiplier !== 1) {
    throw new Error(`expected August first sale paid at ×1 after reset, got ${firstAugust?.paidMultiplier}`);
  }
  const julyCross = july.sales.find((row) => row.crossedTier);
  if (!julyCross || julyCross.client !== "לקוח ד") {
    throw new Error(`expected לקוח ד to cross the July tier, got ${julyCross?.client}`);
  }
  if (july.sales[0]?.runningMultiplier !== 1 || july.sales[0]?.paidMultiplier !== 2) {
    throw new Error("expected first July sale to run at ×1 and be paid at the month multiplier ×2");
  }
  if (july.sales.some((row) => row.report === "volume" && row.status === "active" && row.paidMultiplier !== 2)) {
    throw new Error("expected every July sale paid at the reached month multiplier ×2");
  }

  const shifted = buildEmployeeReview(
    "ניב קובי",
    [sale("s", 500, "2026-08-01", "לקוח ה")],
    {
      profiles: [{ ...profiles[0]!, hoursByMonth: { "2026-07": 10 } }],
      rates: [],
    },
  );
  const julyShift = shifted.audits.find((row) => row.month === "2026-07");
  const augustShift = shifted.audits.find((row) => row.month === "2026-08");
  if (!julyShift || julyShift.sales.length !== 1 || julyShift.hours !== 10) {
    throw new Error("expected 01/08 production to land with July hours");
  }
  if (julyShift.sales[0]?.date !== "2026-08-01") {
    throw new Error(`expected displayed production date 2026-08-01, got ${julyShift.sales[0]?.date}`);
  }
  if (augustShift && augustShift.sales.length > 0) {
    throw new Error("expected 01/08 production not to stay in August");
  }
}

export function assertSplitEmploymentMonths(): void {
  const salariedApril = {
    ...emptyPayContract(),
    salaryKind: "global" as const,
    globalSalary: 5000,
    productionTiers: [{ from: 0, to: null, multiplier: 5 }],
  };
  const freelancerFromMay = {
    ...emptyPayContract(),
    volumePercent: 500,
    freelancerFormula: "freelancers_2" as const,
    stationCost: 550,
  };
  const profile: EmployeePayProfile = {
    fullName: "חן בר און",
    employmentKind: "freelancer",
    contract: freelancerFromMay,
    hoursByMonth: { "2026-07": 0 },
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
  const sale = (
    key: string,
    premium: number,
    startDate: string,
    agent = "חן בר און",
  ): MarketingProduction => ({
    key,
    source: "שיחות",
    client: key,
    agent,
    product: "בריאות",
    company: "מגדל",
    premium,
    status: "active",
    statusRaw: "פעילה",
    process: "מכירה",
    startDate,
    transferDate: startDate,
    fields: {},
  });
  const review = buildEmployeeReview(
    "חן בר און",
    [sale("apr", 800, "2026-04-15"), sale("may", 1000, "2026-05-15")],
    { profiles: [profile], rates: [] },
  );
  if (!review.hasSalariedMonths || !review.hasFreelancerMonths) {
    throw new Error("expected mixed salaried and freelancer months");
  }
  const april = review.months.find((row) => row.key === "2026-04");
  const may = review.months.find((row) => row.key === "2026-05");
  const july = review.months.find((row) => row.key === "2026-07");
  if (!april || april.employmentKind !== "salaried") {
    throw new Error(`expected April salaried, got ${april?.employmentKind}`);
  }
  if (april.settledWage !== 0 || april.monthlyCosts !== 0 || april.baseWage !== 5000 || april.salesWage !== 0 || april.earned !== 5000) {
    throw new Error(
      `expected April global salary 5000 only, no tiers/settled/costs; got base=${april.baseWage} sales=${april.salesWage} settled=${april.settledWage} costs=${april.monthlyCosts} earned=${april.earned}`,
    );
  }
  if (!may || may.employmentKind !== "freelancer") {
    throw new Error(`expected May freelancer, got ${may?.employmentKind}`);
  }
  if (may.salesWage !== 5000 || may.settledWage !== 0 || may.monthlyCosts !== 550 || may.earned !== 4450) {
    throw new Error(
      `expected May volume 5000, settled 0, costs 550, earned 4450; got sales=${may.salesWage} settled=${may.settledWage} costs=${may.monthlyCosts} earned=${may.earned}`,
    );
  }
  if (!july || july.settledNewWage !== 93 || july.settledWage !== 93 || july.monthlyCosts !== 550) {
    throw new Error(
      `expected July נפרע חדש 93 from May only, costs 550; got new=${july?.settledNewWage} settled=${july?.settledWage} costs=${july?.monthlyCosts}`,
    );
  }
  const julyAudit = review.audits.find((row) => row.month === "2026-07");
  if (julyAudit?.deferredSettledSales?.some((row) => row.premium === 800)) {
    throw new Error("April salaried sales must not enter freelancer נפרעים");
  }

  const shaharSalaryOnly = {
    ...emptyPayContract(),
    salaryKind: "salary_only" as const,
    globalSalary: 3400,
    travelAmount: 400,
    variableExpenses: [{ id: "b", amount: 200, note: "בונוס" }],
  };
  const shaharFreelancer = {
    ...emptyPayContract(),
    volumePercent: 500,
    freelancerFormula: "freelancers_2" as const,
    stationCost: 550,
  };
  const shahar: EmployeePayProfile = {
    fullName: "שחר משה",
    employmentKind: "freelancer",
    contract: shaharFreelancer,
    agreements: [
      {
        id: "jan-apr",
        from: "2026-01-01",
        to: "2026-04-30",
        employmentKind: "salaried",
        contract: shaharSalaryOnly,
      },
      {
        id: "may",
        from: "2026-05-01",
        to: "",
        employmentKind: "freelancer",
        contract: shaharFreelancer,
      },
    ],
  };
  const shaharReview = buildEmployeeReview(
    "שחר משה",
    [
      sale("mar", 499, "2026-03-15", "שחר משה"),
      sale("apr1", 856, "2026-05-01", "שחר משה"),
      sale("may", 969, "2026-05-15", "שחר משה"),
    ],
    { profiles: [shahar], rates: [] },
  );
  for (const month of ["2026-01", "2026-02", "2026-03", "2026-04"]) {
    const row = shaharReview.months.find((item) => item.key === month);
    if (
      !row ||
      row.employmentKind !== "salaried" ||
      row.baseWage !== 3400 ||
      row.salesWage !== 0 ||
      row.settledWage !== 0 ||
      row.monthlyCosts !== 0 ||
      row.earned !== 3400
    ) {
      throw new Error(
        `expected ${month} salary-only 3400 and no formula, got kind=${row?.employmentKind} base=${row?.baseWage} sales=${row?.salesWage} settled=${row?.settledWage} costs=${row?.monthlyCosts} earned=${row?.earned}`,
      );
    }
  }
  const shaharMay = shaharReview.months.find((row) => row.key === "2026-05");
  if (
    !shaharMay ||
    shaharMay.employmentKind !== "freelancer" ||
    shaharMay.salesWage !== 4845 ||
    shaharMay.monthlyCosts !== 550
  ) {
    throw new Error(
      `expected May freelancer 4845 minus costs 550, got kind=${shaharMay?.employmentKind} sales=${shaharMay?.salesWage} costs=${shaharMay?.monthlyCosts}`,
    );
  }

  const formula4 = {
    ...emptyPayContract(),
    freelancerFormula: "freelancers_4" as const,
  };
  const avichai: EmployeePayProfile = {
    fullName: "אביחי יוסף",
    employmentKind: "freelancer",
    contract: formula4,
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
  const hubSale = (
    key: string,
    agent: string,
    premium: number,
    startDate: string,
  ): MarketingProduction => ({
    key,
    source: "שיחות",
    client: key,
    agent,
    product: "בריאות",
    company: "מגדל",
    premium,
    status: "active",
    statusRaw: "פעילה",
    process: "מכירה",
    startDate,
    transferDate: startDate,
    fields: {},
  });
  const hubReview = buildEmployeeReview(
    "אביחי יוסף",
    [
      hubSale("a", "ניב קובי", 10000, "2026-04-10"),
      hubSale("b", "בן סגל", 11000, "2026-04-20"),
      { ...hubSale("s", "ניב - שמש", 8000, "2026-04-12"), source: "קמפיין שמש" },
      { ...hubSale("g", "שמש", 6000, "2026-04-18"), source: "קמפיין שמש" },
    ],
    { profiles: [avichai], rates: [] },
  );
  const hubApril = hubReview.months.find((row) => row.key === "2026-04");
  if (
    !hubApril ||
    hubApril.volumePremium !== 35000 ||
    hubApril.salesWage !== 26250 ||
    hubApril.baseWage !== 5000 ||
    hubApril.earned !== 31250
  ) {
    throw new Error(
      `expected Avihai April hub 35,000 / 26,250 + 5,000, got premium=${hubApril?.volumePremium} sales=${hubApril?.salesWage} base=${hubApril?.baseWage} earned=${hubApril?.earned}`,
    );
  }
  const hubSep = hubReview.months.find((row) => row.key === FREELANCERS_4.oneTimeGap.month);
  const hubSepAudit = hubReview.audits.find((row) => row.month === FREELANCERS_4.oneTimeGap.month);
  if (
    !hubSep ||
    hubSep.baseWage !== FREELANCERS_4.fixedMonthly + FREELANCERS_4.oneTimeGap.amount ||
    !hubSepAudit?.variableExpenses.some((row) => row.note.includes(FREELANCERS_4.oneTimeGap.note))
  ) {
    throw new Error(
      `expected Avihai ${FREELANCERS_4.oneTimeGap.month} one-time gap ${FREELANCERS_4.oneTimeGap.amount}, got base=${hubSep?.baseWage} extras=${JSON.stringify(hubSepAudit?.variableExpenses)}`,
    );
  }
}
