import {
  jerusalemYmd,
  type AgentRate,
} from "@/lib/sales-dashboard/campaign-math";
import {
  sourcePnlKindForProcess,
  type SourcePnlKind,
} from "@/lib/sales-dashboard/columns";
import { excelAgentKey } from "@/lib/employees/excel-sellers";
import { assignOperatingBrand } from "@/lib/finance/operating-brand";

export type EmploymentKind = "salaried" | "freelancer" | "unpaid";

export type SalaryKind = "hourly" | "global" | "salary_only";

export function parseSalaryKind(value: unknown): SalaryKind {
  return value === "global" || value === "salary_only" ? value : "hourly";
}

/** שכר חודשי קבוע — בלי מדרגות על מכירות. */
export function usesMonthlySalary(kind: SalaryKind | null | undefined): boolean {
  return kind === "global" || kind === "salary_only";
}

/** רק משכורת חודשית — בלי בונוסים, נסיעות או הוצאות משתנות. */
export function isSalaryOnly(kind: SalaryKind | null | undefined): boolean {
  return kind === "salary_only";
}

export type ProductionTier = {
  from: number;
  to: number | null;
  multiplier: number;
};

export type VariableExpense = {
  id: string;
  amount: number;
  note: string;
};

/** תשלום חד־פעמי — נכנס לשכר רק בחודש שנבחר (לא כל חודש). */
export type OneTimePayment = {
  id: string;
  amount: number;
  /** קטגוריה / מה זה (למשל פער קיזוזים). */
  note: string;
  /** חודש שכר YYYY-MM. */
  month: string;
};

/** ברירת מחדל להסכם שכיר — כמו שניב לב רן. אפשר לשנות ידנית לעובד. */
export const DEFAULT_SALARIED_BENEFITS = {
  contributionCeiling: 13769,
  severanceEmployerPercent: 6,
  pensionEmployeePercent: 6,
  pensionEmployerPercent: 6.5,
  studyFundEmployeePercent: 2.5,
  studyFundEmployerPercent: 7.5,
  studyFund: true,
  travelAmount: 300,
} as const;

export type FreelancerFormula =
  | "custom"
  | "freelancers_1"
  | "freelancers_2"
  | "freelancers_3"
  | "freelancers_4";

export const FREELANCER_FORMULA_OPTIONS = [
  { id: "custom" as const, label: "ידני — אחוזים בהסכם" },
  { id: "freelancers_1" as const, label: "עצמאים 1" },
  { id: "freelancers_2" as const, label: "עצמאים 2" },
  { id: "freelancers_3" as const, label: "עצמאים 3 בן סגל" },
  { id: "freelancers_4" as const, label: "עצמאים 4 אביחי יוסף" },
];

export type FreelancerSettledSpec = {
  id: "freelancers_1" | "freelancers_2" | "freelancers_4";
  label: string;
  settledPercent: number;
  payDelayMonths: number;
  companyPercent?: number;
  sharePercent?: number;
};

/** נפרעים 1: 22% לעסק, 50% לעצמאי → 11%, שוטף 60 ונגרר. */
export const FREELANCERS_1 = {
  id: "freelancers_1" as const,
  label: "עצמאים 1",
  companyPercent: 22,
  sharePercent: 50,
  settledPercent: 11,
  payDelayMonths: 2,
} as const;

/** נפרעים 2: כמו עצמאים 1, רק 9.3% מהפרמיה. */
export const FREELANCERS_2 = {
  id: "freelancers_2" as const,
  label: "עצמאים 2",
  settledPercent: 9.3,
  payDelayMonths: 2,
} as const;

export const FREELANCER_SETTLED_SPECS: Record<
  "freelancers_1" | "freelancers_2" | "freelancers_4",
  FreelancerSettledSpec
> = {
  freelancers_1: FREELANCERS_1,
  freelancers_2: FREELANCERS_2,
  freelancers_4: {
    id: "freelancers_4",
    label: "עצמאים 4 אביחי יוסף",
    settledPercent: 3,
    payDelayMonths: 2,
    companyPercent: 22,
  },
};

/** עצמאים 3 בן סגל: מכפיל 7 על היקף, בלי נפרעים. */
export const FREELANCERS_3 = {
  id: "freelancers_3" as const,
  label: "עצמאים 3 בן סגל",
  volumeMultiplier: 7,
  volumePercent: 700,
} as const;

/** עצמאים 4 אביחי יוסף: ₪5,000 קבועים + היקף ליבה + נפרעים 3% שוטף 60. */
export const FREELANCERS_4 = {
  id: "freelancers_4" as const,
  label: "עצמאים 4 אביחי יוסף",
  hubThreshold: 20001,
  highVolumePercent: 75,
  lowVolumePercent: 50,
  settledPercent: 3,
  companyPercent: 22,
  payDelayMonths: 2,
  /** שכר קבוע כל חודש. עליו מתווספים היקף ונפרעים. */
  fixedMonthly: 5000,
  /**
   * פער קיזוזים — תשלום חד־פעמי על כל תקופת העבודה.
   * נכנס לשכר פעם אחת בחודש שנבחר (לא כל חודש).
   */
  oneTimeGap: {
    amount: 13630,
    note: "פער קיזוזים",
    month: "2026-09",
  },
  /**
   * ניב לב רן בשם הרגיל: היקף גם על מקור שמש, כל התקופה. בלי נפרעים.
   */
  shemeshAlwaysAgents: ["ניב לב רן"] as const,
  /**
   * דניאל כהן בשם הרגיל: היקף על מקור שמש רק בחלון התאריכים. בלי נפרעים.
   */
  shemeshWindowRegularAgents: ["דניאל כהן"] as const,
  /** שמות עם «שמש» — היקף רק בחלון התאריכים. בלי נפרעים. */
  shemeshVolumeAgents: ["שמש", "ניב שמש", "ניב - שמש", "ניב לב רן - שמש", "דניאל כהן - שמש"] as const,
  shemeshVolumeFromMonth: "2026-01",
  shemeshVolumeToMonth: "2026-05",
} as const;

export function isFreelancers3(
  contract: { freelancerFormula?: FreelancerFormula } | null | undefined,
): boolean {
  return contract?.freelancerFormula === "freelancers_3";
}

export function isFreelancers4(
  contract: { freelancerFormula?: FreelancerFormula } | null | undefined,
): boolean {
  return contract?.freelancerFormula === "freelancers_4";
}

export function usesHubProductions(
  contract: { freelancerFormula?: FreelancerFormula } | null | undefined,
): boolean {
  return isFreelancers4(contract);
}

export function profileUsesHubProductions(
  profile: { agreements?: EmployeeAgreement[] } | null | undefined,
): boolean {
  return (profile?.agreements ?? []).some(
    (row) => row.employmentKind === "freelancer" && usesHubProductions(row.contract),
  );
}

export function freelancers4VolumePercent(hubPremium: number): number {
  return hubPremium >= FREELANCERS_4.hubThreshold
    ? FREELANCERS_4.highVolumePercent
    : FREELANCERS_4.lowVolumePercent;
}

export function freelancers4VolumeWage(hubPremium: number): number {
  if (hubPremium <= 0) return 0;
  return Math.round(hubPremium * (freelancers4VolumePercent(hubPremium) / 100));
}

export function hubVolumePremium(rows: WageInputRow[]): number {
  return hubVolumeStats(rows).premium;
}

export function isLibaHubProduction(row: Pick<WageInputRow, "agent" | "source">): boolean {
  return assignOperatingBrand({ agent: row.agent, source: row.source }) === "liba";
}

function agentKeyForShemeshGuest(name: string): string {
  return excelAgentKey(name).replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

const FREELANCERS_4_SHEMESH_WINDOW_KEYS = new Set(
  FREELANCERS_4.shemeshVolumeAgents.map((name) => agentKeyForShemeshGuest(name)),
);

const FREELANCERS_4_SHEMESH_ALWAYS_KEYS = new Set(
  FREELANCERS_4.shemeshAlwaysAgents.map((name) => agentKeyForShemeshGuest(name)),
);

const FREELANCERS_4_SHEMESH_WINDOW_REGULAR_KEYS = new Set(
  FREELANCERS_4.shemeshWindowRegularAgents.map((name) => agentKeyForShemeshGuest(name)),
);

export function isFreelancers4ShemeshAlwaysAgent(agentName: string | null | undefined): boolean {
  const key = agentKeyForShemeshGuest(agentName ?? "");
  return Boolean(key) && FREELANCERS_4_SHEMESH_ALWAYS_KEYS.has(key);
}

export function isFreelancers4ShemeshWindowRegularAgent(
  agentName: string | null | undefined,
): boolean {
  const key = agentKeyForShemeshGuest(agentName ?? "");
  return Boolean(key) && FREELANCERS_4_SHEMESH_WINDOW_REGULAR_KEYS.has(key);
}

export function isFreelancers4ShemeshGuestAgent(agentName: string | null | undefined): boolean {
  const key = agentKeyForShemeshGuest(agentName ?? "");
  return Boolean(key) && FREELANCERS_4_SHEMESH_WINDOW_KEYS.has(key);
}

export function isFreelancers4ShemeshVolumeMonth(month: string | null | undefined): boolean {
  return Boolean(
    month &&
      /^\d{4}-\d{2}$/.test(month) &&
      month >= FREELANCERS_4.shemeshVolumeFromMonth &&
      month <= FREELANCERS_4.shemeshVolumeToMonth,
  );
}

/** היקף אביחי: ליבה תמיד; ניב לב רן גם על שמש כל התקופה; שאר שמש רק בינואר–מאי 2026. */
export function countsForFreelancers4Volume(
  row: Pick<WageInputRow, "agent" | "source" | "startDate" | "transferDate">,
): boolean {
  if (isLibaHubProduction(row)) return true;
  if (isFreelancers4ShemeshAlwaysAgent(row.agent)) return true;
  const windowed =
    isFreelancers4ShemeshGuestAgent(row.agent) || isFreelancers4ShemeshWindowRegularAgent(row.agent);
  if (!windowed) return false;
  return isFreelancers4ShemeshVolumeMonth(productionMonthKey(row));
}

export function filterLibaHubProductions<T extends Pick<WageInputRow, "agent" | "source">>(
  rows: T[],
): T[] {
  return rows.filter((row) => isLibaHubProduction(row));
}

export function filterFreelancers4PayProductions<
  T extends Pick<WageInputRow, "agent" | "source" | "startDate" | "transferDate">,
>(rows: T[]): T[] {
  return rows.filter((row) => countsForFreelancers4Volume(row));
}

export function hubVolumeStats(rows: WageInputRow[]): { count: number; premium: number } {
  let count = 0;
  let premium = 0;
  for (const row of rows) {
    if (row.status !== "active" || row.premium <= 0) continue;
    if (!countsForFreelancers4Volume(row)) continue;
    if (!countsForVolumeCommission(row)) continue;
    count += 1;
    premium += row.premium;
  }
  return { count, premium };
}

export function sumAgentPremiumMap(map: Map<string, number> | undefined): number {
  if (!map) return 0;
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

export function fixedMonthlyForMonth(
  contract: EmployeePayContract | null | undefined,
): number {
  return isFreelancers4(contract) ? FREELANCERS_4.fixedMonthly : 0;
}

/** כמה חודשי הסכם בלי הפרשת פנסיה / גמל, אם לא משלמים מהחודש הראשון. */
export const PENSION_WAIT_MONTHS = 3;

export type EmployeePayContract = {
  salaryKind: SalaryKind;
  hourlyRate: number;
  globalSalary: number;
  studyFund: boolean;
  contributionCeiling: number;
  severanceEmployerPercent: number;
  /** true = פנסיה מהחודש הראשון. false = רק אחרי 3 חודשים. */
  pensionFromFirstMonth: boolean;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  studyFundEmployeePercent: number;
  studyFundEmployerPercent: number;
  productionTiers: ProductionTier[];
  agentAppointmentPercent: number;
  agentAppointmentMinTarget: number;
  excludeDirectFromAppointment: boolean;
  pensionMeetingFee: number;
  pensionMeetingsCount: number;
  travelPercent: number;
  travelAmount: number;
  volumePercent: number;
  settledPercent: number;
  freelancerFormula: FreelancerFormula;
  variableExpenses: VariableExpense[];
  oneTimePayments: OneTimePayment[];
  stationCost: number;
  operationsCost: number;
  officeCost: number;
};

export type SalaryBenefits = {
  grossPensionable: number;
  pensionable: number;
  ceiling: number;
  overCeiling: boolean;
  salesWage: number;
  severanceEmployerPercent: number;
  pensionEmployeePercent: number;
  pensionEmployerPercent: number;
  studyFundEmployeePercent: number;
  studyFundEmployerPercent: number;
  severanceEmployer: number;
  pensionEmployee: number;
  pensionEmployer: number;
  studyFundEmployee: number;
  studyFundEmployer: number;
  employerExtra: number;
  /** חודש בתוך תקופת ההמתנה — אחוזי פנסיה קיימים, סכום 0. */
  pensionWaiting: boolean;
};

export type EmployeeAgreement = {
  id: string;
  from: string;
  to: string;
  employmentKind: EmploymentKind;
  contract: EmployeePayContract;
};

export type EmployeePayProfile = {
  fullName: string;
  employmentKind: EmploymentKind | null;
  contract: EmployeePayContract;
  agreements: EmployeeAgreement[];
  hoursByMonth?: Record<string, number>;
  vacationDaysByMonth?: Record<string, number>;
};

export type WageInputRow = {
  status: string;
  agent: string;
  premium: number;
  process?: string;
  product?: string;
  source?: string;
  /** תאריך תחילת ביטוח — זה תאריך ההפקה לשכר. */
  startDate?: string;
  transferDate?: string;
};

export type WageKind = SourcePnlKind | "all";

export const EMPTY_PRODUCTION_TIERS: ProductionTier[] = [
  { from: 0, to: 1500, multiplier: 0 },
  { from: 1501, to: 2500, multiplier: 0 },
  { from: 2501, to: 3500, multiplier: 0 },
  { from: 3501, to: null, multiplier: 0 },
];

export function emptyPayContract(): EmployeePayContract {
  return {
    salaryKind: "hourly",
    hourlyRate: 0,
    globalSalary: 0,
    studyFund: false,
    contributionCeiling: 0,
    severanceEmployerPercent: 0,
    pensionFromFirstMonth: true,
    pensionEmployeePercent: 0,
    pensionEmployerPercent: 0,
    studyFundEmployeePercent: 0,
    studyFundEmployerPercent: 0,
    productionTiers: EMPTY_PRODUCTION_TIERS.map((tier) => ({ ...tier })),
    agentAppointmentPercent: 0,
    agentAppointmentMinTarget: 0,
    excludeDirectFromAppointment: true,
    pensionMeetingFee: 0,
    pensionMeetingsCount: 0,
    travelPercent: 0,
    travelAmount: 0,
    volumePercent: 0,
    settledPercent: 0,
    freelancerFormula: "custom",
    variableExpenses: [],
    oneTimePayments: [],
    stationCost: 0,
    operationsCost: 0,
    officeCost: 0,
  };
}

export function defaultSalariedPayContract(): EmployeePayContract {
  return {
    ...emptyPayContract(),
    ...DEFAULT_SALARIED_BENEFITS,
  };
}

const SALARIED_BENEFIT_KEYS = [
  "contributionCeiling",
  "severanceEmployerPercent",
  "pensionEmployeePercent",
  "pensionEmployerPercent",
  "studyFundEmployeePercent",
  "studyFundEmployerPercent",
  "travelAmount",
] as const;

type SalariedBenefitKey = (typeof SALARIED_BENEFIT_KEYS)[number];

function benefitSource(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.contract && typeof raw.contract === "object"
    ? { ...raw, ...(raw.contract as Record<string, unknown>) }
    : raw;
}

/** שדה שנשמר במפורש — כולל 0 — לא מקבל ברירת מחדל. */
function hasSavedNumber(raw: Record<string, unknown>, key: SalariedBenefitKey): boolean {
  const source = benefitSource(raw);
  if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
  const value = source[key];
  if (value == null || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n);
}

/**
 * ברירות מחדל להסכם שכיר חדש / מעבר לשכיר.
 * אם מועבר `raw` — ממלא רק שדות שלא נשמרו. 0 ידני נשאר 0.
 */
export function withSalariedBenefitDefaults(
  contract: EmployeePayContract,
  raw?: Record<string, unknown> | null,
): EmployeePayContract {
  const next = { ...contract };
  const missing = (key: SalariedBenefitKey) =>
    raw == null ? !next[key] : !hasSavedNumber(raw, key);
  if (missing("contributionCeiling")) {
    next.contributionCeiling = DEFAULT_SALARIED_BENEFITS.contributionCeiling;
  }
  if (missing("severanceEmployerPercent")) {
    next.severanceEmployerPercent = DEFAULT_SALARIED_BENEFITS.severanceEmployerPercent;
  }
  if (missing("pensionEmployeePercent")) {
    next.pensionEmployeePercent = DEFAULT_SALARIED_BENEFITS.pensionEmployeePercent;
  }
  if (missing("pensionEmployerPercent")) {
    next.pensionEmployerPercent = DEFAULT_SALARIED_BENEFITS.pensionEmployerPercent;
  }
  if (missing("studyFundEmployeePercent")) {
    next.studyFundEmployeePercent = DEFAULT_SALARIED_BENEFITS.studyFundEmployeePercent;
  }
  if (missing("studyFundEmployerPercent")) {
    next.studyFundEmployerPercent = DEFAULT_SALARIED_BENEFITS.studyFundEmployerPercent;
  }
  if (missing("travelAmount")) next.travelAmount = DEFAULT_SALARIED_BENEFITS.travelAmount;
  next.studyFund =
    next.studyFund ||
    next.studyFundEmployeePercent > 0 ||
    next.studyFundEmployerPercent > 0;
  next.variableExpenses = Array.isArray(next.variableExpenses) ? next.variableExpenses : [];
  next.oneTimePayments = Array.isArray(next.oneTimePayments) ? next.oneTimePayments : [];
  return next;
}

export function emptySalaryBenefits(): SalaryBenefits {
  return {
    grossPensionable: 0,
    pensionable: 0,
    ceiling: 0,
    overCeiling: false,
    salesWage: 0,
    severanceEmployerPercent: 0,
    pensionEmployeePercent: 0,
    pensionEmployerPercent: 0,
    studyFundEmployeePercent: 0,
    studyFundEmployerPercent: 0,
    severanceEmployer: 0,
    pensionEmployee: 0,
    pensionEmployer: 0,
    studyFundEmployee: 0,
    studyFundEmployer: 0,
    employerExtra: 0,
    pensionWaiting: false,
  };
}

export function newAgreementId(): string {
  return crypto.randomUUID();
}

export function emptyAgreement(
  employmentKind: EmploymentKind = "salaried",
  from = todayIso(),
): EmployeeAgreement {
  return {
    id: newAgreementId(),
    from,
    to: "",
    employmentKind,
    contract:
      employmentKind === "salaried" ? defaultSalariedPayContract() : emptyPayContract(),
  };
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDateOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "";
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

/** תאריך הפקה = תחילת ביטוח (ואם אין — העברה ליצרן). חודש שכר: הפקה ב־1 לחודש שייכת לחודש המכירה שלפניו. */
export function productionDateOf(
  row: Pick<WageInputRow, "startDate" | "transferDate">,
): string {
  return isoDateOnly(row.startDate) || isoDateOnly(row.transferDate);
}

export function previousCalendarMonth(month: string): string {
  return shiftCalendarMonth(month, -1);
}

export function shiftCalendarMonth(month: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(month) || !delta) return month;
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  if (!year || !m) return month;
  const index = year * 12 + (m - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

/**
 * חודש שכר = חודש המכירה.
 * הפקה ב־1 לחודש שייכת לחודש שלפניו (הנציג מכר כל החודש, ההפקה ב־1 שאחריו).
 * השעות לא זזות.
 */
export function wageMonthKeyFromIso(iso: string | undefined): string {
  const day = isoDateOnly(iso);
  if (!day) return "";
  const month = day.slice(0, 7);
  if (day.slice(8, 10) !== "01") return month;
  return previousCalendarMonth(month);
}

/** טבלאות שכר מתחילות מינואר 2026 — שורות ישנות מהאקסל לא נכנסות. */
export const EMPLOYEE_WAGE_FROM_MONTH = "2026-01";

export function isEmployeeWageMonth(month: string | null | undefined): boolean {
  return Boolean(month && /^\d{4}-\d{2}$/.test(month) && month >= EMPLOYEE_WAGE_FROM_MONTH);
}

/** חודשים שבהם חל הסכם — כולל חודש הסיום. */
export function monthsInAgreement(
  agreement: Pick<EmployeeAgreement, "from" | "to">,
  throughMonth: string,
): string[] {
  if (!/^\d{4}-\d{2}$/.test(throughMonth)) return [];
  const startDay = isoDateOnly(agreement.from) || `${EMPLOYEE_WAGE_FROM_MONTH}-01`;
  let start = startDay.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(start) || start < EMPLOYEE_WAGE_FROM_MONTH) {
    start = EMPLOYEE_WAGE_FROM_MONTH;
  }
  const endDay = isoDateOnly(agreement.to);
  let end = endDay ? endDay.slice(0, 7) : throughMonth;
  if (!/^\d{4}-\d{2}$/.test(end) || end > throughMonth) end = throughMonth;
  if (start > end) return [];
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = shiftCalendarMonth(cursor, 1);
  }
  return out;
}

/** חודשי «רק משכורת» גם בלי מכירות ובלי שעות. לא חל על שעתי / גלובלי. */
export function salariedMonthlyPayMonths(
  profile: Pick<EmployeePayProfile, "agreements">,
  throughMonth: string,
): string[] {
  const months = new Set<string>();
  for (const agreement of profile.agreements ?? []) {
    if (agreement.employmentKind !== "salaried") continue;
    if (!isSalaryOnly(agreement.contract.salaryKind)) continue;
    for (const month of monthsInAgreement(agreement, throughMonth)) {
      if (isEmployeeWageMonth(month)) months.add(month);
    }
  }
  return Array.from(months).sort();
}

export function productionMonthKey(
  row: Pick<WageInputRow, "startDate" | "transferDate">,
): string {
  return wageMonthKeyFromIso(productionDateOf(row));
}

export function dayBeforeIso(iso: string): string {
  const day = isoDateOnly(iso);
  if (!day) return "";
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function formatAgreementRange(from: string, to: string): string {
  if (!from && !to) return "מההתחלה ועד היום";
  const start = from ? from.split("-").reverse().join(".") : "התחלה";
  const end = to ? to.split("-").reverse().join(".") : "היום · בתוקף";
  return `${start} – ${end}`;
}

export function parsePayContract(raw: unknown): EmployeePayContract {
  const base = emptyPayContract();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  const nested =
    row.contract && typeof row.contract === "object"
      ? (row.contract as Record<string, unknown>)
      : row;
  const tiersRaw = Array.isArray(nested.productionTiers) ? nested.productionTiers : [];
  const tiers = tiersRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const tier = item as Record<string, unknown>;
      const from = Math.max(0, num(tier.from));
      const toRaw = tier.to;
      const to =
        toRaw === null || toRaw === undefined || toRaw === ""
          ? null
          : Math.max(0, num(toRaw));
      return {
        from,
        to,
        multiplier: Math.max(0, num(tier.multiplier)),
      } satisfies ProductionTier;
    })
    .filter((tier): tier is ProductionTier => Boolean(tier));
  return {
    salaryKind: parseSalaryKind(nested.salaryKind),
    hourlyRate: Math.max(0, num(nested.hourlyRate)),
    globalSalary: Math.max(0, num(nested.globalSalary)),
    pensionEmployeePercent: Math.max(0, num(nested.pensionEmployeePercent)),
    pensionEmployerPercent: Math.max(0, num(nested.pensionEmployerPercent)),
    studyFundEmployeePercent: Math.max(0, num(nested.studyFundEmployeePercent)),
    studyFundEmployerPercent: Math.max(0, num(nested.studyFundEmployerPercent)),
    contributionCeiling: Math.max(0, num(nested.contributionCeiling)),
    severanceEmployerPercent: Math.max(0, num(nested.severanceEmployerPercent)),
    pensionFromFirstMonth: nested.pensionFromFirstMonth !== false && nested.pensionFromFirstMonth !== "false",
    studyFund:
      Boolean(nested.studyFund) ||
      num(nested.studyFundEmployeePercent) > 0 ||
      num(nested.studyFundEmployerPercent) > 0,
    productionTiers: tiers.length > 0 ? tiers : base.productionTiers,
    agentAppointmentPercent: Math.max(0, num(nested.agentAppointmentPercent)),
    agentAppointmentMinTarget: Math.max(0, num(nested.agentAppointmentMinTarget)),
    excludeDirectFromAppointment: nested.excludeDirectFromAppointment !== false,
    pensionMeetingFee: Math.max(0, num(nested.pensionMeetingFee)),
    pensionMeetingsCount: Math.max(0, num(nested.pensionMeetingsCount)),
    travelPercent: Math.max(0, num(nested.travelPercent)),
    travelAmount: Math.max(0, num(nested.travelAmount)),
    volumePercent: Math.max(0, num(nested.volumePercent)),
    settledPercent: Math.max(0, num(nested.settledPercent)),
    freelancerFormula:
      nested.freelancerFormula === "freelancers_1" ||
      nested.freelancerFormula === "freelancers_2" ||
      nested.freelancerFormula === "freelancers_3" ||
      nested.freelancerFormula === "freelancers_4"
        ? nested.freelancerFormula
        : "custom",
    variableExpenses: parseVariableExpenses(nested.variableExpenses),
    oneTimePayments: parseOneTimePayments(nested.oneTimePayments),
    stationCost: Math.max(0, num(nested.stationCost)),
    operationsCost: Math.max(0, num(nested.operationsCost)),
    officeCost: Math.max(0, num(nested.officeCost)),
  };
}

function parseVariableExpenses(raw: unknown): VariableExpense[] {
  if (!Array.isArray(raw)) return [];
  const out: VariableExpense[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const amount = Math.max(0, num(row.amount));
    const note = typeof row.note === "string" ? row.note.trim() : "";
    if (amount <= 0 && !note) continue;
    out.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : newAgreementId(),
      amount,
      note: typeof row.note === "string" ? row.note : "",
    });
  }
  return out;
}

function parseOneTimePayments(raw: unknown): OneTimePayment[] {
  if (!Array.isArray(raw)) return [];
  const out: OneTimePayment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const amount = Math.max(0, num(row.amount));
    const note = typeof row.note === "string" ? row.note.trim() : "";
    const monthRaw = typeof row.month === "string" ? row.month.trim() : "";
    const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : "";
    if (amount <= 0 && !note && !month) continue;
    out.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : newAgreementId(),
      amount,
      note: typeof row.note === "string" ? row.note : "",
      month,
    });
  }
  return out;
}

export function validVariableExpenses(contract: EmployeePayContract): VariableExpense[] {
  return (contract.variableExpenses ?? []).filter(
    (row) => row.amount > 0 && row.note.trim().length > 0,
  );
}

export function validOneTimePayments(contract: EmployeePayContract): OneTimePayment[] {
  return resolvedOneTimePayments(contract).filter(
    (row) =>
      row.amount > 0 &&
      row.note.trim().length > 0 &&
      /^\d{4}-\d{2}$/.test(row.month),
  );
}

/**
 * תשלומים חד־פעמיים מההסכם, ובנוסף פער קיזוזים של עצמאים 4 אם עדיין לא נשמר בהסכם.
 */
export function resolvedOneTimePayments(
  contract: EmployeePayContract | null | undefined,
): OneTimePayment[] {
  const rows = [...(contract?.oneTimePayments ?? [])];
  if (!isFreelancers4(contract)) return rows;
  const gap = FREELANCERS_4.oneTimeGap;
  const gapIdx = rows.findIndex(
    (row) => row.note.trim() === gap.note || row.id === "freelancers4-gap",
  );
  if (gapIdx >= 0) {
    const existing = rows[gapIdx];
    const month = /^\d{4}-\d{2}$/.test(existing.month) ? existing.month : gap.month;
    const amount = existing.amount > 0 ? existing.amount : gap.amount;
    const note = existing.note.trim() || gap.note;
    if (
      existing.month === month &&
      existing.amount === amount &&
      existing.note.trim() === note
    ) {
      return rows;
    }
    const next = [...rows];
    next[gapIdx] = { ...existing, amount, note, month };
    return next;
  }
  return [
    ...rows,
    {
      id: "freelancers4-gap",
      amount: gap.amount,
      note: gap.note,
      month: gap.month,
    },
  ];
}

/** מוודא שתשלומים חד־פעמיים של הנוסחה (עצמאים 4) שמורים על ההסכם עצמו. */
export function withResolvedOneTimePayments(
  contract: EmployeePayContract,
): EmployeePayContract {
  const resolved = resolvedOneTimePayments(contract);
  const prev = contract.oneTimePayments ?? [];
  if (
    prev.length === resolved.length &&
    prev.every(
      (row, i) =>
        row.id === resolved[i]?.id &&
        row.amount === resolved[i]?.amount &&
        row.note === resolved[i]?.note &&
        row.month === resolved[i]?.month,
    )
  ) {
    return contract;
  }
  return { ...contract, oneTimePayments: resolved };
}

export function oneTimeAmountForMonth(
  contract: EmployeePayContract | null | undefined,
  month: string,
): number {
  if (!/^\d{4}-\d{2}$/.test(month)) return 0;
  return validOneTimePayments(contract ?? emptyPayContract())
    .filter((row) => row.month === month)
    .reduce((sum, row) => sum + Math.round(row.amount), 0);
}

export function oneTimeLinesForMonth(
  contract: EmployeePayContract | null | undefined,
  month: string,
): { amount: number; note: string }[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  return validOneTimePayments(contract ?? emptyPayContract())
    .filter((row) => row.month === month)
    .map((row) => ({ amount: Math.round(row.amount), note: row.note.trim() }));
}

export function oneTimeMonthsForContract(
  contract: EmployeePayContract | null | undefined,
): string[] {
  return [
    ...new Set(
      validOneTimePayments(contract ?? emptyPayContract()).map((row) => row.month),
    ),
  ].sort();
}

export function variableExpensesTotal(contract: EmployeePayContract): number {
  return validVariableExpenses(contract).reduce((sum, row) => sum + Math.round(row.amount), 0);
}

export function variableExpensesIncomplete(contract: EmployeePayContract): boolean {
  return (contract.variableExpenses ?? []).some(
    (row) => row.amount > 0 && row.note.trim().length === 0,
  );
}

export function oneTimePaymentsIncomplete(contract: EmployeePayContract): boolean {
  return (contract.oneTimePayments ?? []).some((row) => {
    if (row.amount <= 0 && !row.note.trim() && !row.month) return false;
    return row.amount > 0 && (!row.note.trim() || !/^\d{4}-\d{2}$/.test(row.month));
  });
}

export function parseEmploymentKind(value: unknown): EmploymentKind | null {
  return value === "salaried" || value === "freelancer" || value === "unpaid" ? value : null;
}

function looksLikeLegacyContract(row: Record<string, unknown>): boolean {
  return (
    "hourlyRate" in row ||
    "volumePercent" in row ||
    "settledPercent" in row ||
    "productionTiers" in row ||
    "agentAppointmentPercent" in row
  );
}

function parseAgreementItem(item: unknown): EmployeeAgreement | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const kind = parseEmploymentKind(row.employmentKind);
  if (!kind) return null;
  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : newAgreementId(),
    from: isoDateOnly(row.from),
    to: isoDateOnly(row.to),
    employmentKind: kind,
    contract:
      kind === "salaried"
        ? withSalariedBenefitDefaults(parsePayContract(row), row)
        : parsePayContract(row),
  };
}

export function parsePayAgreements(
  raw: unknown,
  fallbackKind: EmploymentKind | null = null,
): EmployeeAgreement[] {
  if (!raw || typeof raw !== "object") return [];
  const row = raw as Record<string, unknown>;
  if (Array.isArray(row.agreements)) {
    return row.agreements
      .map((item) => parseAgreementItem(item))
      .filter((item): item is EmployeeAgreement => Boolean(item));
  }
  if (fallbackKind && looksLikeLegacyContract(row)) {
    return [
      {
        id: "legacy",
        from: "",
        to: "",
        employmentKind: fallbackKind,
        contract:
          fallbackKind === "salaried"
            ? withSalariedBenefitDefaults(parsePayContract(row), row)
            : parsePayContract(row),
      },
    ];
  }
  return [];
}

export function serializePayAgreements(agreements: EmployeeAgreement[]): {
  agreements: Record<string, unknown>[];
} {
  return {
    agreements: agreements.map((row) => ({
      id: row.id,
      from: isoDateOnly(row.from),
      to: isoDateOnly(row.to),
      employmentKind: row.employmentKind,
      ...parsePayContract(row.contract),
    })),
  };
}

export function dateInAgreement(date: string, agreement: EmployeeAgreement): boolean {
  const day = isoDateOnly(date);
  if (!day) return false;
  if (agreement.from && day < agreement.from) return false;
  if (agreement.to && day > agreement.to) return false;
  return true;
}

export function agreementForDate(
  agreements: EmployeeAgreement[],
  date: string,
): EmployeeAgreement | null {
  const day = isoDateOnly(date);
  if (!day) return null;
  const matches = agreements.filter((row) => dateInAgreement(day, row));
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.from || "").localeCompare(b.from || ""));
  return matches[matches.length - 1] ?? null;
}

export function currentAgreement(
  agreements: EmployeeAgreement[],
  today = todayIso(),
): EmployeeAgreement | null {
  const live = agreementForDate(agreements, today);
  if (live) return live;
  const sorted = [...agreements].sort((a, b) => (a.from || "").localeCompare(b.from || ""));
  return sorted.at(-1) ?? null;
}

export function currentEmploymentKind(
  agreements: EmployeeAgreement[],
  today = todayIso(),
): EmploymentKind | null {
  return currentAgreement(agreements, today)?.employmentKind ?? null;
}

export function toPayProfile(input: {
  fullName: string;
  employmentKind?: EmploymentKind | null;
  contract?: EmployeePayContract;
  agreements?: EmployeeAgreement[];
  hoursByMonth?: Record<string, number>;
  vacationDaysByMonth?: Record<string, number>;
}): EmployeePayProfile {
  const agreements = input.agreements ?? [];
  const current = currentAgreement(agreements);
  return {
    fullName: input.fullName,
    employmentKind: current?.employmentKind ?? input.employmentKind ?? null,
    contract: current?.contract ?? input.contract ?? emptyPayContract(),
    agreements,
    hoursByMonth: input.hoursByMonth,
    vacationDaysByMonth: input.vacationDaysByMonth,
  };
}

export function multiplierForTiers(production: number, tiers: ProductionTier[]): number {
  return tierForProduction(production, tiers)?.multiplier ?? 0;
}

export function tierForProduction(
  production: number,
  tiers: ProductionTier[],
): ProductionTier | null {
  const sorted = [...tiers].sort((a, b) => a.from - b.from);
  let found: ProductionTier | null = null;
  for (const tier of sorted) {
    if (production >= tier.from && (tier.to == null || production <= tier.to)) {
      found = tier;
    }
  }
  return found;
}

export function formatTierRange(tier: Pick<ProductionTier, "from" | "to"> | null): string {
  if (!tier) return "—";
  const from = tier.from.toLocaleString("he-IL");
  if (tier.to == null) return `${from}+`;
  return `${from}–${tier.to.toLocaleString("he-IL")}`;
}

export function travelAmountForMonth(contract: EmployeePayContract): number {
  return Math.round(Math.max(0, contract.travelAmount || 0));
}

export function extrasAmountForMonth(
  contract: EmployeePayContract,
  month?: string,
): number {
  const oneTime = month ? oneTimeAmountForMonth(contract, month) : 0;
  return variableExpensesTotal(contract) + fixedMonthlyForMonth(contract) + oneTime;
}

export const MONTHLY_COST_FIELDS = [
  { key: "stationCost" as const, label: "עלויות עמדה" },
  { key: "operationsCost" as const, label: "עלויות תפעול" },
  { key: "officeCost" as const, label: "עלויות משרד" },
];

export type MonthlyCostLine = {
  key: (typeof MONTHLY_COST_FIELDS)[number]["key"];
  label: string;
  amount: number;
};

export function monthlyCostLines(
  contract: Pick<EmployeePayContract, "stationCost" | "operationsCost" | "officeCost">,
): MonthlyCostLine[] {
  return MONTHLY_COST_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    amount: Math.round(Math.max(0, contract[field.key] || 0)),
  })).filter((row) => row.amount > 0);
}

export function monthlyCostsTotal(
  contract:
    | Pick<EmployeePayContract, "stationCost" | "operationsCost" | "officeCost">
    | null
    | undefined,
): number {
  if (!contract) return 0;
  return monthlyCostLines(contract).reduce((sum, row) => sum + row.amount, 0);
}

export function freelancerSettledSpec(
  contract: EmployeePayContract | null | undefined,
): FreelancerSettledSpec | null {
  const id = contract?.freelancerFormula;
  if (id === "freelancers_1" || id === "freelancers_2" || id === "freelancers_4") {
    return FREELANCER_SETTLED_SPECS[id];
  }
  return null;
}

export function usesFreelancerSettledBook(
  contract: EmployeePayContract | null | undefined,
): boolean {
  return freelancerSettledSpec(contract) != null;
}

export function usesFreelancers1(contract: EmployeePayContract | null | undefined): boolean {
  return usesFreelancerSettledBook(contract);
}

export function freelancers1SettledMultiplier(
  contract?: EmployeePayContract | null,
): number {
  const spec = freelancerSettledSpec(contract) ?? FREELANCERS_1;
  return spec.settledPercent / 100;
}

export function freelancers1SettledWage(
  premium: number,
  contract?: EmployeePayContract | null,
): number {
  return Math.round(Math.max(0, premium) * freelancers1SettledMultiplier(contract));
}

function percentAmount(base: number, percent: number): number {
  if (base <= 0 || percent <= 0) return 0;
  return Math.round((base * percent) / 100);
}

export type BenefitMonthContext = {
  month?: string;
  agreementFrom?: string;
};

/** מספר חודשי לוח מ־fromMonth עד toMonth. אותו חודש = 0. */
export function calendarMonthsBetween(fromMonth: string, toMonth: string): number {
  if (!/^\d{4}-\d{2}$/.test(fromMonth) || !/^\d{4}-\d{2}$/.test(toMonth)) return 0;
  const fromYear = Number(fromMonth.slice(0, 4));
  const fromIndex = Number(fromMonth.slice(5, 7));
  const toYear = Number(toMonth.slice(0, 4));
  const toIndex = Number(toMonth.slice(5, 7));
  return toYear * 12 + toIndex - (fromYear * 12 + fromIndex);
}

/** פנסיה / גמל מהחודש הראשון, אלא אם סומן במפורש אחרת. */
export function pensionStartsFromFirstMonth(
  contract: Pick<EmployeePayContract, "pensionFromFirstMonth"> | null | undefined,
): boolean {
  return contract?.pensionFromFirstMonth !== false;
}

/**
 * אחרי 3 חודשים = שלושת חודשי ההסכם הראשונים בלי הפרשה, מהרביעי משלמים.
 * בלי תאריך התחלה נשארים עם תשלום (לא מאפסים בשקט).
 */
export function pensionDueForWageMonth(
  contract: Pick<EmployeePayContract, "pensionFromFirstMonth">,
  context?: BenefitMonthContext,
): boolean {
  if (pensionStartsFromFirstMonth(contract)) return true;
  const month = context?.month;
  const startDay = isoDateOnly(context?.agreementFrom);
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !startDay) return true;
  const startMonth = startDay.slice(0, 7);
  if (month < startMonth) return false;
  return calendarMonthsBetween(startMonth, month) >= PENSION_WAIT_MONTHS;
}

/** שכר מבוטח להפרשות — שעתי×שעות או גלובלי, בלי נסיעות. */
export function pensionableSalaryForMonth(
  contract: EmployeePayContract,
  hours: number,
): number {
  if (usesMonthlySalary(contract.salaryKind)) {
    return Math.round(Math.max(0, contract.globalSalary));
  }
  const rate = Math.max(0, contract.hourlyRate);
  const monthHours = Math.max(0, hours);
  return rate > 0 && monthHours > 0 ? Math.round(rate * monthHours) : 0;
}

export function contributionBaseForMonth(
  contract: EmployeePayContract,
  hours: number,
  salesWage = 0,
): { gross: number; capped: number; ceiling: number; overCeiling: boolean } {
  const salary = pensionableSalaryForMonth(contract, hours);
  const extraSales = usesMonthlySalary(contract.salaryKind)
    ? 0
    : Math.max(0, Math.round(salesWage));
  const gross = salary + extraSales;
  const ceiling = Math.max(0, contract.contributionCeiling || 0);
  if (ceiling <= 0) {
    return { gross, capped: gross, ceiling: 0, overCeiling: false };
  }
  const capped = Math.min(gross, ceiling);
  return { gross, capped, ceiling, overCeiling: gross > ceiling };
}

export function salaryBenefitsForMonth(
  contract: EmployeePayContract,
  hours: number,
  salesWage = 0,
  context?: BenefitMonthContext,
): SalaryBenefits {
  const roundedSales = usesMonthlySalary(contract.salaryKind)
    ? 0
    : Math.max(0, Math.round(salesWage));
  const { gross, capped, ceiling, overCeiling } = contributionBaseForMonth(
    contract,
    hours,
    roundedSales,
  );
  const severanceEmployerPercent = Math.max(0, contract.severanceEmployerPercent || 0);
  const pensionEmployeePercent = Math.max(0, contract.pensionEmployeePercent || 0);
  const pensionEmployerPercent = Math.max(0, contract.pensionEmployerPercent || 0);
  const studyFundEmployeePercent = Math.max(0, contract.studyFundEmployeePercent || 0);
  const studyFundEmployerPercent = Math.max(0, contract.studyFundEmployerPercent || 0);
  const pensionWaiting = !pensionDueForWageMonth(contract, context);
  const severanceEmployer = percentAmount(capped, severanceEmployerPercent);
  const pensionEmployee = pensionWaiting ? 0 : percentAmount(capped, pensionEmployeePercent);
  const pensionEmployer = pensionWaiting ? 0 : percentAmount(capped, pensionEmployerPercent);
  const studyFundEmployee = percentAmount(capped, studyFundEmployeePercent);
  const studyFundEmployer = percentAmount(capped, studyFundEmployerPercent);
  return {
    grossPensionable: gross,
    pensionable: capped,
    ceiling,
    overCeiling,
    salesWage: roundedSales,
    severanceEmployerPercent,
    pensionEmployeePercent,
    pensionEmployerPercent,
    studyFundEmployeePercent,
    studyFundEmployerPercent,
    severanceEmployer,
    pensionEmployee,
    pensionEmployer,
    studyFundEmployee,
    studyFundEmployer,
    employerExtra: severanceEmployer + pensionEmployer + studyFundEmployer,
    pensionWaiting,
  };
}

export function salariedGrossWageForMonth(
  contract: EmployeePayContract,
  hours: number,
): number {
  if (isSalaryOnly(contract.salaryKind)) {
    return Math.round(Math.max(0, contract.globalSalary));
  }
  const travel = travelAmountForMonth(contract);
  const extras = extrasAmountForMonth(contract);
  if (contract.salaryKind === "global") {
    return Math.round(Math.max(0, contract.globalSalary)) + travel + extras;
  }
  const wage = pensionableSalaryForMonth(contract, hours);
  if (hours > 0) return wage + travel + extras;
  return wage + extras;
}

export const VACATION_WORK_DAYS = 22;

export type VacationPay = {
  days: number;
  dayValue: number;
  amount: number;
  averageGross: number;
  monthsUsed: string[];
};

export function emptyVacationPay(): VacationPay {
  return { days: 0, dayValue: 0, amount: 0, averageGross: 0, monthsUsed: [] };
}

export function vacationPayForMonth(
  month: string,
  days: number,
  grossByMonth: Record<string, number>,
): VacationPay {
  const count = Math.max(0, Math.round(days));
  if (count <= 0 || !/^\d{4}-\d{2}$/.test(month)) return emptyVacationPay();
  const monthsUsed: string[] = [];
  let cursor = month;
  for (let i = 0; i < 3; i += 1) {
    cursor = previousCalendarMonth(cursor);
    if (grossByMonth[cursor] == null) continue;
    monthsUsed.push(cursor);
  }
  if (monthsUsed.length === 0) return { ...emptyVacationPay(), days: count };
  const averageGross = Math.round(
    monthsUsed.reduce((sum, key) => sum + (grossByMonth[key] ?? 0), 0) / monthsUsed.length,
  );
  const dayValue = Math.round(averageGross / VACATION_WORK_DAYS);
  return {
    days: count,
    dayValue,
    amount: dayValue * count,
    averageGross,
    monthsUsed,
  };
}

export function salariedVacationByMonth(
  profile: EmployeePayProfile,
  salesByMonth: Record<string, number> = {},
): Record<string, VacationPay> {
  const months = new Set<string>([
    ...Object.keys(profile.hoursByMonth ?? {}),
    ...Object.keys(profile.vacationDaysByMonth ?? {}),
    ...Object.keys(salesByMonth),
  ]);
  const ordered = Array.from(months).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort();
  const grossByMonth: Record<string, number> = {};
  const out: Record<string, VacationPay> = {};
  for (const month of ordered) {
    const terms = termsForRow(profile, `${month}-01`);
    const hours = profile.hoursByMonth?.[month] ?? 0;
    const sales = Math.max(0, Math.round(salesByMonth[month] ?? 0));
    const work =
      terms?.employmentKind === "salaried"
        ? salariedGrossWageForMonth(terms.contract, hours) + sales
        : 0;
    const vacation = vacationPayForMonth(
      month,
      profile.vacationDaysByMonth?.[month] ?? 0,
      grossByMonth,
    );
    out[month] = vacation;
    grossByMonth[month] = work + vacation.amount;
  }
  return out;
}

export function salariedBaseWageForMonth(
  contract: EmployeePayContract,
  hours: number,
  salesWage = 0,
  vacationPay = 0,
  context?: BenefitMonthContext,
): number {
  return (
    salariedGrossWageForMonth(contract, hours) +
    Math.round(Math.max(0, vacationPay)) +
    salaryBenefitsForMonth(contract, hours, salesWage, context).employerExtra
  );
}

export function salariedBaseWageForMonths(
  profile: EmployeePayProfile,
  months: string[],
  salesByMonth: Record<string, number> = {},
): number {
  const vacation = salariedVacationByMonth(profile, salesByMonth);
  let extra = 0;
  for (const month of months) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const terms = termsForRow(profile, `${month}-01`);
    if (!terms || terms.employmentKind !== "salaried") continue;
    extra += salariedBaseWageForMonth(
      terms.contract,
      profile.hoursByMonth?.[month] ?? 0,
      salesByMonth[month] ?? 0,
      vacation[month]?.amount ?? 0,
      { month, agreementFrom: terms.from },
    );
  }
  return extra;
}

function looksDirect(row: WageInputRow): boolean {
  const blob = `${row.source ?? ""} ${row.product ?? ""}`;
  return blob.includes("ישיר");
}

function looksTravel(row: WageInputRow): boolean {
  return (row.product ?? "").includes("נסיעות");
}

/**
 * פוליסות תאונות אישיות — אין עליהן שכר היקף לכל העובדים (עצמאים ושכירים).
 * נפרעים (מינוי סוכן) לא מושפעים.
 */
export function isPersonalAccidentProduct(product: string | null | undefined): boolean {
  const raw = (product ?? "")
    .trim()
    .toLowerCase()
    .replace(/["'«»]/g, "")
    .replace(/\s+/g, " ");
  if (!raw || raw === "—") return false;
  if (raw.includes("תאונות")) return true;
  if (raw === "ת.א" || raw === "ת.א." || raw.startsWith("ת.א ") || raw.startsWith("תא ")) {
    return true;
  }
  if (raw.includes("personal accident")) return true;
  return false;
}

/** האם ההפקה נספרת להיקף (שכר + סף מדרגות). תאונות אישיות = לא. */
export function countsForVolumeCommission(
  row: Pick<WageInputRow, "product" | "process" | "status">,
): boolean {
  if (row.status && row.status !== "active") return false;
  if (sourcePnlKindForProcess(row.process ?? "") !== "volume") return false;
  if (isPersonalAccidentProduct(row.product)) return false;
  return true;
}

function profileForAgent(
  agentName: string,
  profiles: EmployeePayProfile[],
): EmployeePayProfile | null {
  const key = excelAgentKey(agentName);
  if (!key || key === "—") return null;
  return profiles.find((row) => excelAgentKey(row.fullName) === key) ?? null;
}

/** Exact Excel name only (spacing / בראון). Does not merge different people. */
export function agentBelongsToEmployee(agentName: string, employeeName: string): boolean {
  const agent = excelAgentKey(agentName);
  const employee = excelAgentKey(employeeName);
  if (!agent || !employee || agent === "—" || employee === "—") return false;
  return agent === employee;
}

function rowCountsForFreelancerBook(
  profile: EmployeePayProfile,
  row: WageInputRow,
  contract: EmployeePayContract,
): boolean {
  if (usesHubProductions(contract)) return isLibaHubProduction(row);
  return agentBelongsToEmployee(row.agent, profile.fullName);
}

function termsForRow(
  profile: EmployeePayProfile | null,
  date: string | undefined,
): { employmentKind: EmploymentKind; contract: EmployeePayContract; from: string } | null {
  if (!profile) return null;
  const agreements = profile.agreements ?? [];
  if (agreements.length === 0) return null;
  const day = isoDateOnly(date);
  if (day) {
    const match = agreementForDate(agreements, day);
    return match
      ? { employmentKind: match.employmentKind, contract: match.contract, from: match.from }
      : null;
  }
  const current = currentAgreement(agreements);
  return current
    ? { employmentKind: current.employmentKind, contract: current.contract, from: current.from }
    : null;
}

export type Freelancers1SettledBundle = {
  count: number;
  premium: number;
  wage: number;
  saleMonth: string;
  newCount: number;
  newPremium: number;
  newWage: number;
  trailCount: number;
  trailPremium: number;
  trailWage: number;
};

function emptyFreelancers1Settled(saleMonth = ""): Freelancers1SettledBundle {
  return {
    count: 0,
    premium: 0,
    wage: 0,
    saleMonth,
    newCount: 0,
    newPremium: 0,
    newWage: 0,
    trailCount: 0,
    trailPremium: 0,
    trailWage: 0,
  };
}

function rowStartsPayingOn(saleMonth: string): string {
  return shiftCalendarMonth(saleMonth, FREELANCERS_1.payDelayMonths);
}

export function freelancers1SettledForPayMonth(
  profile: EmployeePayProfile,
  rows: WageInputRow[],
  payMonth: string,
): Freelancers1SettledBundle {
  const newSaleMonth = shiftCalendarMonth(payMonth, FREELANCERS_1.payDelayMonths * -1);
  const out = emptyFreelancers1Settled(newSaleMonth);
  if (!/^\d{4}-\d{2}$/.test(payMonth) || !isEmployeeWageMonth(payMonth)) return out;
  const payTerms = termsForRow(profile, `${payMonth}-01`);
  if (
    !payTerms ||
    payTerms.employmentKind !== "freelancer" ||
    !usesFreelancerSettledBook(payTerms.contract)
  ) {
    return out;
  }
  for (const row of rows) {
    if (row.status !== "active" || row.premium <= 0) continue;
    if (!rowCountsForFreelancerBook(profile, row, payTerms.contract)) continue;
    if (sourcePnlKindForProcess(row.process ?? "") !== "volume") continue;
    const saleMonth = productionMonthKey(row);
    if (!saleMonth || saleMonth > newSaleMonth) continue;
    if (!isEmployeeWageMonth(saleMonth)) continue;
    const terms = termsForRow(profile, `${saleMonth}-01`);
    if (!terms || terms.employmentKind !== "freelancer" || !usesFreelancers1(terms.contract)) {
      continue;
    }
    const wage = freelancers1SettledWage(row.premium, terms.contract);
    const premium = row.premium;
    out.count += 1;
    out.premium += premium;
    out.wage += wage;
    if (saleMonth === newSaleMonth) {
      out.newCount += 1;
      out.newPremium += premium;
      out.newWage += wage;
    } else {
      out.trailCount += 1;
      out.trailPremium += premium;
      out.trailWage += wage;
    }
  }
  out.premium = Math.round(out.premium);
  out.newPremium = Math.round(out.newPremium);
  out.trailPremium = Math.round(out.trailPremium);
  return out;
}

export function freelancers1PayMonthsThrough(
  profile: EmployeePayProfile,
  rows: WageInputRow[],
  throughMonth: string,
): string[] {
  if (!/^\d{4}-\d{2}$/.test(throughMonth)) return [];
  let first: string | null = null;
  for (const row of rows) {
    if (row.status !== "active") continue;
    if (sourcePnlKindForProcess(row.process ?? "") !== "volume") continue;
    const saleMonth = productionMonthKey(row);
    if (!saleMonth || !isEmployeeWageMonth(saleMonth)) continue;
    const terms = termsForRow(profile, `${saleMonth}-01`);
    if (!terms || terms.employmentKind !== "freelancer" || !usesFreelancers1(terms.contract)) {
      continue;
    }
    if (!rowCountsForFreelancerBook(profile, row, terms.contract)) continue;
    const start = rowStartsPayingOn(saleMonth);
    if (start > throughMonth) continue;
    if (!first || start < first) first = start;
  }
  if (!first) return [];
  if (first < EMPLOYEE_WAGE_FROM_MONTH) first = EMPLOYEE_WAGE_FROM_MONTH;
  if (first > throughMonth) return [];
  const out: string[] = [];
  let cursor = first;
  while (cursor <= throughMonth) {
    out.push(cursor);
    cursor = shiftCalendarMonth(cursor, 1);
  }
  return out;
}

export function freelancers1SettledLifetime(
  profile: EmployeePayProfile,
  rows: WageInputRow[],
  throughMonth = jerusalemYmd().slice(0, 7),
): Freelancers1SettledBundle {
  return freelancers1SettledForPayMonths(
    profile,
    rows,
    freelancers1PayMonthsThrough(profile, rows, throughMonth),
  );
}

export function freelancers1SettledForPayMonths(
  profile: EmployeePayProfile,
  rows: WageInputRow[],
  payMonths: string[],
): Freelancers1SettledBundle {
  const out = emptyFreelancers1Settled();
  for (const payMonth of payMonths) {
    const part = freelancers1SettledForPayMonth(profile, rows, payMonth);
    out.wage += part.wage;
    out.newWage += part.newWage;
    out.trailWage += part.trailWage;
    out.newCount += part.newCount;
    out.newPremium += part.newPremium;
    out.count = part.count;
    out.premium = part.premium;
    out.trailCount = part.trailCount;
    out.trailPremium = part.trailPremium;
    if (part.saleMonth) out.saleMonth = part.saleMonth;
  }
  return out;
}

export type AgentPremiumTotals = {
  volume: Map<string, number>;
  settled: Map<string, number>;
  libaHubVolume: number;
};

export function buildAgentPremiumTotals(rows: WageInputRow[]): AgentPremiumTotals {
  const volume = new Map<string, number>();
  const settled = new Map<string, number>();
  let libaHubVolume = 0;
  for (const row of rows) {
    if (row.status !== "active") continue;
    const key = excelAgentKey(row.agent);
    if (!key || key === "—") continue;
    const kind = sourcePnlKindForProcess(row.process ?? "");
    if (kind === "volume" && countsForVolumeCommission(row)) {
      volume.set(key, (volume.get(key) ?? 0) + row.premium);
      if (countsForFreelancers4Volume(row)) libaHubVolume += row.premium;
    }
    if (kind === "settled") settled.set(key, (settled.get(key) ?? 0) + row.premium);
  }
  return { volume, settled, libaHubVolume };
}

export function buildMonthlyAgentPremiumTotals(rows: WageInputRow[]): Map<string, AgentPremiumTotals> {
  const byMonth = new Map<string, WageInputRow[]>();
  for (const row of rows) {
    const key = productionMonthKey(row) || "_";
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }
  const out = new Map<string, AgentPremiumTotals>();
  for (const [key, list] of byMonth) {
    out.set(key, buildAgentPremiumTotals(list));
  }
  return out;
}

export type WageExplainReason =
  | "inactive"
  | "unpaid"
  | "settled_blocked"
  | "personal_accident"
  | "travel"
  | "freelancer"
  | "freelancers_1"
  | "freelancers_2"
  | "freelancers_4"
  | "tier"
  | "appointment"
  | "none";

export type WageExplanation = {
  wage: number;
  multiplier: number;
  reason: WageExplainReason;
  monthProduction: number;
  tier: ProductionTier | null;
};

export function explainWageForProduction(
  row: WageInputRow,
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
    kind: WageKind;
    volumeByAgent: Map<string, number>;
    settledByAgent: Map<string, number>;
    monthlyTotals?: Map<string, AgentPremiumTotals>;
  },
): WageExplanation {
  const empty: WageExplanation = {
    wage: 0,
    multiplier: 0,
    reason: "none",
    monthProduction: 0,
    tier: null,
  };
  if (row.status !== "active" || row.premium <= 0) {
    return { ...empty, reason: "inactive" };
  }
  const rowKind = sourcePnlKindForProcess(row.process ?? "");
  if (rowKind === "other") return empty;
  if (options.kind !== "all" && rowKind !== options.kind) return empty;
  if (rowKind === "volume" && isPersonalAccidentProduct(row.product)) {
    return { ...empty, reason: "personal_accident" };
  }

  const agent = excelAgentKey(row.agent);
  if (!agent || agent === "—") return empty;
  const wageMonth = productionMonthKey(row);
  const solo = options.profiles.length === 1 ? options.profiles[0] : null;
  const soloHubTerms =
    solo && wageMonth ? termsForRow(solo, `${wageMonth}-01`) : null;
  const profile =
    soloHubTerms?.employmentKind === "freelancer" &&
    usesHubProductions(soloHubTerms.contract) &&
    countsForFreelancers4Volume(row)
      ? solo
      : profileForAgent(row.agent, options.profiles);
  const payMonthTerms = wageMonth && profile ? termsForRow(profile, `${wageMonth}-01`) : null;
  if (
    payMonthTerms?.employmentKind === "salaried" &&
    isSalaryOnly(payMonthTerms.contract.salaryKind)
  ) {
    return { ...empty, reason: "none" };
  }
  const dateTerms = termsForRow(profile, productionDateOf(row));
  const salariedHourlyMonth =
    payMonthTerms?.employmentKind === "salaried" &&
    !usesMonthlySalary(payMonthTerms.contract.salaryKind);
  const terms = salariedHourlyMonth ? payMonthTerms : dateTerms ?? payMonthTerms;

  if (!terms) return empty;
  if (terms.employmentKind === "unpaid") return { ...empty, reason: "unpaid" };
  if (terms.employmentKind === "salaried" && rowKind === "settled") {
    return { ...empty, reason: "settled_blocked" };
  }

  const contract = terms.contract;
  if (terms.employmentKind === "salaried" && usesMonthlySalary(contract.salaryKind)) {
    return { ...empty, reason: "none" };
  }
  const month = productionMonthKey(row) || "_";
  const monthly = options.monthlyTotals?.get(month);
  const volumeByAgent = monthly?.volume ?? options.volumeByAgent;
  const settledByAgent = monthly?.settled ?? options.settledByAgent;
  const monthProduction = usesHubProductions(contract)
    ? monthly?.libaHubVolume ?? sumAgentPremiumMap(volumeByAgent)
    : volumeByAgent.get(agent) ?? 0;
  const tier = tierForProduction(monthProduction, contract.productionTiers);

  if (looksTravel(row) && contract.travelPercent > 0) {
    const multiplier = contract.travelPercent / 100;
    return {
      wage: Math.round(row.premium * multiplier),
      multiplier,
      reason: "travel",
      monthProduction,
      tier,
    };
  }

  if (terms.employmentKind === "freelancer") {
    if (isFreelancers4(contract)) {
      if (!countsForFreelancers4Volume(row) || rowKind !== "volume") {
        return { ...empty, reason: "freelancers_4", monthProduction, tier };
      }
      const percent = freelancers4VolumePercent(monthProduction);
      const multiplier = percent / 100;
      return {
        wage: Math.round(row.premium * multiplier),
        multiplier,
        reason: "freelancers_4",
        monthProduction,
        tier,
      };
    }
    if (isFreelancers3(contract)) {
      if (rowKind !== "volume") {
        return { ...empty, reason: "freelancer", monthProduction, tier };
      }
      const multiplier = FREELANCERS_3.volumeMultiplier;
      return {
        wage: Math.round(row.premium * multiplier),
        multiplier,
        reason: "freelancer",
        monthProduction,
        tier,
      };
    }
    if (usesFreelancerSettledBook(contract) && rowKind === "settled") {
      return {
        ...empty,
        reason:
          contract.freelancerFormula === "freelancers_2"
            ? "freelancers_2"
            : contract.freelancerFormula === "freelancers_4"
              ? "freelancers_4"
              : "freelancers_1",
        monthProduction,
        tier,
      };
    }
    const percent = rowKind === "volume" ? contract.volumePercent : contract.settledPercent;
    const multiplier = percent / 100;
    return {
      wage: Math.round(row.premium * multiplier),
      multiplier,
      reason: "freelancer",
      monthProduction,
      tier,
    };
  }

  if (rowKind === "volume") {
    const multiplier = tier?.multiplier ?? 0;
    return {
      wage: Math.round(row.premium * multiplier),
      multiplier,
      reason: "tier",
      monthProduction,
      tier,
    };
  }

  if (contract.excludeDirectFromAppointment && looksDirect(row)) {
    return { ...empty, reason: "none", monthProduction, tier };
  }
  const settledTotal = settledByAgent.get(agent) ?? 0;
  if (
    contract.agentAppointmentMinTarget > 0 &&
    settledTotal < contract.agentAppointmentMinTarget
  ) {
    return { ...empty, reason: "appointment", monthProduction, tier };
  }
  const multiplier = contract.agentAppointmentPercent / 100;
  return {
    wage: Math.round(row.premium * multiplier),
    multiplier,
    reason: "appointment",
    monthProduction,
    tier,
  };
}

export function wageForOneProduction(
  row: WageInputRow,
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
    kind: WageKind;
    volumeByAgent: Map<string, number>;
    settledByAgent: Map<string, number>;
    monthlyTotals?: Map<string, AgentPremiumTotals>;
  },
): number {
  return explainWageForProduction(row, options).wage;
}

export function wageForContractProductions(
  rows: WageInputRow[],
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
    kind: WageKind;
    contextRows?: WageInputRow[];
  },
): number {
  const monthlyTotals = buildMonthlyAgentPremiumTotals(options.contextRows ?? rows);
  return rows.reduce(
    (sum, row) =>
      sum +
      wageForOneProduction(row, {
        ...options,
        volumeByAgent: new Map(),
        settledByAgent: new Map(),
        monthlyTotals,
      }),
    0,
  );
}

export type ContractWageTotal = {
  agentName: string;
  count: number;
  premium: number;
  volumeCount: number;
  volumePremium: number;
  volumeWage: number;
  settledCount: number;
  settledPremium: number;
  settledWage: number;
  pensionWage: number;
  earned: number;
  employmentKind: EmploymentKind | null;
};

export function contractWageTotals(
  rows: WageInputRow[],
  options: {
    profiles: EmployeePayProfile[];
    rates: AgentRate[];
    fallback?: number;
    contextRows?: WageInputRow[];
  },
): ContractWageTotal[] {
  const context = options.contextRows ?? rows;
  const monthlyTotals = buildMonthlyAgentPremiumTotals(context);
  const map = new Map<
    string,
    {
      count: number;
      premium: number;
      volumeCount: number;
      volumePremium: number;
      volumeWage: number;
      settledCount: number;
      settledPremium: number;
      settledWage: number;
    }
  >();

  for (const row of rows) {
    if (row.status !== "active") continue;
    const agent = excelAgentKey(row.agent);
    if (!agent || agent === "—") continue;
    const current = map.get(agent) ?? {
      count: 0,
      premium: 0,
      volumeCount: 0,
      volumePremium: 0,
      volumeWage: 0,
      settledCount: 0,
      settledPremium: 0,
      settledWage: 0,
    };
    const rowKind = sourcePnlKindForProcess(row.process ?? "");
    current.count += 1;
    current.premium += row.premium;
    const wage = wageForOneProduction(row, {
      ...options,
      kind: "all",
      volumeByAgent: new Map(),
      settledByAgent: new Map(),
      monthlyTotals,
    });
    if (rowKind === "volume") {
      if (!countsForVolumeCommission(row)) {
        map.set(agent, current);
        continue;
      }
      current.volumeCount += 1;
      current.volumePremium += row.premium;
      current.volumeWage += wage;
    } else if (rowKind === "settled") {
      current.settledCount += 1;
      current.settledPremium += row.premium;
      current.settledWage += wage;
    }
    map.set(agent, current);
  }

  const names = new Set<string>([
    ...Array.from(map.keys()),
    ...options.profiles.map((row) => excelAgentKey(row.fullName)).filter(Boolean),
  ]);

  return Array.from(names)
    .map((agentName) => {
      const item = map.get(agentName) ?? {
        count: 0,
        premium: 0,
        volumeCount: 0,
        volumePremium: 0,
        volumeWage: 0,
        settledCount: 0,
        settledPremium: 0,
        settledWage: 0,
      };
      const profile = profileForAgent(agentName, options.profiles);
      const current = profile ? currentAgreement(profile.agreements ?? []) : null;
      const pensionWage = 0;
      let volumeWage = Math.round(item.volumeWage);
      if (profile && (current?.employmentKind === "salaried" || profile.employmentKind === "salaried")) {
        const months = new Set<string>();
        for (const row of rows) {
          if (!agentBelongsToEmployee(row.agent, profile.fullName)) continue;
          const month = productionMonthKey(row);
          if (month) months.add(month);
        }
        for (const month of Object.keys(profile.hoursByMonth ?? {})) months.add(month);
        for (const month of Object.keys(profile.vacationDaysByMonth ?? {})) months.add(month);
        for (const month of salariedMonthlyPayMonths(profile, jerusalemYmd().slice(0, 7))) {
          months.add(month);
        }
        const salesByMonth: Record<string, number> = {};
        for (const month of months) {
          const monthRows = rows.filter(
            (row) =>
              agentBelongsToEmployee(row.agent, profile.fullName) &&
              productionMonthKey(row) === month,
          );
          salesByMonth[month] = wageForContractProductions(monthRows, {
            ...options,
            kind: "volume",
            profiles: [profile],
          });
        }
        const vacation = salariedVacationByMonth(profile, salesByMonth);
        for (const month of months) {
          const terms = termsForRow(profile, `${month}-01`);
          if (!terms || terms.employmentKind !== "salaried") continue;
          volumeWage += salariedBaseWageForMonth(
            terms.contract,
            profile.hoursByMonth?.[month] ?? 0,
            salesByMonth[month] ?? 0,
            vacation[month]?.amount ?? 0,
            { month, agreementFrom: terms.from },
          );
        }
      } else if (profile) {
        const hub = profileUsesHubProductions(profile);
        const extraMonths = new Set<string>();
        for (const row of rows) {
          if (hub ? !countsForFreelancers4Volume(row) : !agentBelongsToEmployee(row.agent, profile.fullName)) {
            continue;
          }
          const month = productionMonthKey(row);
          if (month) extraMonths.add(month);
        }
        if (hub) {
          volumeWage = 0;
          let hubCount = 0;
          let hubPremium = 0;
          for (const month of extraMonths) {
            const terms = termsForRow(profile, `${month}-01`);
            if (!terms || terms.employmentKind !== "freelancer" || !isFreelancers4(terms.contract)) {
              continue;
            }
            const monthRows = rows.filter((row) => productionMonthKey(row) === month);
            const stats = hubVolumeStats(monthRows);
            hubCount += stats.count;
            hubPremium += stats.premium;
            volumeWage += freelancers4VolumeWage(stats.premium);
          }
          item.volumeCount = hubCount;
          item.volumePremium = hubPremium;
          item.count = hubCount;
          item.premium = hubPremium;
        }
        for (const month of extraMonths) {
          const terms = termsForRow(profile, `${month}-01`);
          if (terms?.employmentKind === "freelancer") {
            volumeWage += extrasAmountForMonth(terms.contract, month);
          }
        }
        const asOfMonth = jerusalemYmd().slice(0, 7);
        for (const agreement of profile.agreements ?? []) {
          if (agreement.employmentKind !== "freelancer") continue;
          for (const month of oneTimeMonthsForContract(agreement.contract)) {
            // כבר נספר ב־extrasAmountForMonth לחודשי הפקה.
            if (extraMonths.has(month)) continue;
            if (!isEmployeeWageMonth(month)) continue;
            // לא לשלם חודש עתידי.
            if (month > asOfMonth) continue;
            // חייב לחול בתוך תקופת ההסכם (לא תלוי בטווח חודשי הפקה — אחרת פער קיזוזים נעלם).
            if (
              !dateInAgreement(`${month}-01`, agreement) &&
              !dateInAgreement(`${month}-28`, agreement)
            ) {
              continue;
            }
            const terms = termsForRow(profile, `${month}-01`);
            if (terms?.employmentKind !== "freelancer") continue;
            volumeWage += oneTimeAmountForMonth(terms.contract, month);
          }
        }
      }
      const f1Settled = profile ? freelancers1SettledLifetime(profile, rows) : null;
      const salariedNow =
        current?.employmentKind === "salaried" || profile?.employmentKind === "salaried";
      const formula1 = Boolean(
        !salariedNow && usesFreelancerSettledBook(current?.contract ?? profile?.contract),
      );
      const settledWage = salariedNow ? 0 : Math.round(item.settledWage) + (f1Settled?.wage ?? 0);
      return {
        agentName,
        count: item.count,
        premium: Math.round(item.premium),
        volumeCount: item.volumeCount,
        volumePremium: Math.round(item.volumePremium),
        volumeWage,
        settledCount: formula1 ? f1Settled?.count ?? 0 : item.settledCount,
        settledPremium: formula1 ? f1Settled?.premium ?? 0 : Math.round(item.settledPremium),
        settledWage,
        pensionWage,
        earned: Math.round(volumeWage + settledWage + pensionWage),
        employmentKind:
          current?.employmentKind ?? profile?.employmentKind ?? null,
      };
    })
    .sort((a, b) => b.earned - a.earned || a.agentName.localeCompare(b.agentName, "he"));
}

export function wageTotalForEmployeeContract(
  employeeName: string,
  totals: ContractWageTotal[],
): ContractWageTotal {
  const key = excelAgentKey(employeeName);
  const exact = totals.find((row) => row.agentName === key);
  if (exact) return exact;
  return {
    agentName: key,
    count: 0,
    premium: 0,
    volumeCount: 0,
    volumePremium: 0,
    volumeWage: 0,
    settledCount: 0,
    settledPremium: 0,
    settledWage: 0,
    pensionWage: 0,
    earned: 0,
    employmentKind: null,
  };
}

export function assertContractWagesDoNotMix(): void {
  if (productionMonthKey({ startDate: "2026-08-01" }) !== "2026-07") {
    throw new Error("expected 01/08 production to count as July sales");
  }
  if (productionMonthKey({ startDate: "2026-08-15" }) !== "2026-08") {
    throw new Error("expected mid-month production to stay in its calendar month");
  }
  if (productionMonthKey({ startDate: "2026-01-01" }) !== "2025-12") {
    throw new Error("expected 01/01 production to count as December of the previous year");
  }

  const vacationSample = vacationPayForMonth("2026-08", 3, {
    "2026-05": 11000,
    "2026-06": 12000,
    "2026-07": 13000,
  });
  if (vacationSample.averageGross !== 12000 || vacationSample.dayValue !== 545 || vacationSample.amount !== 1635) {
    throw new Error(
      `expected vacation 12000/22×3 = 1635, got ${vacationSample.averageGross}/${vacationSample.dayValue}/${vacationSample.amount}`,
    );
  }

  const freelancerContract = {
    ...emptyPayContract(),
    volumePercent: 500,
    settledPercent: 42,
  };
  const profiles: EmployeePayProfile[] = [
    {
      fullName: "ניב קובי",
      employmentKind: "freelancer",
      contract: freelancerContract,
      agreements: [
        {
          id: "open",
          from: "",
          to: "",
          employmentKind: "freelancer",
          contract: freelancerContract,
        },
      ],
    },
  ];
  const rows: WageInputRow[] = [
    {
      status: "active",
      agent: "ניב קובי",
      premium: 1000,
      process: "מכירה",
      product: "בריאות",
      source: "שיחות נכנסות",
    },
    {
      status: "active",
      agent: "ניב קובי",
      premium: 2000,
      process: "מינוי סוכן",
      product: "בריאות",
      source: "שיחות נכנסות",
    },
  ];
  const volume = wageForContractProductions(rows, {
    profiles,
    rates: [],
    kind: "volume",
  });
  const settled = wageForContractProductions(rows, {
    profiles,
    rates: [],
    kind: "settled",
  });
  if (volume !== 5000) {
    throw new Error(`expected volume wage 5000, got ${volume}`);
  }
  if (settled !== 840) {
    throw new Error(`expected settled wage 840, got ${settled}`);
  }

  const dated: EmployeePayProfile[] = [
    {
      fullName: "ניב קובי",
      employmentKind: "freelancer",
      contract: emptyPayContract(),
      agreements: [
        {
          id: "jan",
          from: "2026-01-01",
          to: "2026-01-31",
          employmentKind: "freelancer",
          contract: { ...emptyPayContract(), volumePercent: 500, settledPercent: 42 },
        },
        {
          id: "feb",
          from: "2026-02-01",
          to: "",
          employmentKind: "freelancer",
          contract: { ...emptyPayContract(), volumePercent: 100, settledPercent: 10 },
        },
      ],
    },
  ];
  const january = wageForContractProductions(
    [{ status: "active", agent: "ניב קובי", premium: 1000, process: "מכירה", transferDate: "2026-01-15" }],
    { profiles: dated, rates: [], kind: "volume" },
  );
  const february = wageForContractProductions(
    [{ status: "active", agent: "ניב קובי", premium: 1000, process: "מכירה", transferDate: "2026-02-15" }],
    { profiles: dated, rates: [], kind: "volume" },
  );
  if (january !== 5000) {
    throw new Error(`expected January volume wage 5000, got ${january}`);
  }
  if (february !== 1000) {
    throw new Error(`expected February volume wage 1000, got ${february}`);
  }

  const unpaid: EmployeePayProfile[] = [
    {
      fullName: "ניב קובי",
      employmentKind: "unpaid",
      contract: emptyPayContract(),
      agreements: [
        {
          id: "none",
          from: "",
          to: "",
          employmentKind: "unpaid",
          contract: emptyPayContract(),
        },
      ],
    },
  ];
  const unpaidWage = wageForContractProductions(
    [{ status: "active", agent: "ניב קובי", premium: 1000, process: "מכירה", transferDate: "2026-03-01" }],
    { profiles: unpaid, rates: [{ agentName: "ניב קובי", multiplier: 5 }], kind: "volume" },
  );
  if (unpaidWage !== 0) {
    throw new Error(`expected unpaid wage 0, got ${unpaidWage}`);
  }

  const noAgreement = wageForContractProductions(
    [{ status: "active", agent: "ניב קובי", premium: 1000, process: "מכירה", transferDate: "2026-03-01" }],
    {
      profiles: [
        {
          fullName: "ניב קובי",
          employmentKind: null,
          contract: emptyPayContract(),
          agreements: [],
        },
      ],
      rates: [{ agentName: "ניב קובי", multiplier: 5 }],
      fallback: 5,
      kind: "volume",
    },
  );
  if (noAgreement !== 0) {
    throw new Error(`expected no-agreement wage 0, got ${noAgreement}`);
  }

  const nathan = wageForContractProductions(
    [{ status: "active", agent: "נתן יוסיפוב", premium: 1000, process: "מכירה", transferDate: "2026-03-01" }],
    {
      profiles: [
        {
          fullName: "בן סגל",
          employmentKind: "freelancer",
          contract: emptyPayContract(),
          agreements: [
            {
              id: "open",
              from: "",
              to: "",
              employmentKind: "freelancer",
              contract: { ...emptyPayContract(), volumePercent: 500, settledPercent: 42 },
            },
          ],
        },
      ],
      rates: [],
      kind: "volume",
    },
  );
  if (nathan !== 0) {
    throw new Error(`expected exact-name miss to pay 0, got ${nathan}`);
  }

  const producedAugust = wageForContractProductions(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 1000,
        process: "מכירה",
        transferDate: "2026-04-10",
        startDate: "2026-08-01",
      },
    ],
    { profiles: dated, rates: [], kind: "volume" },
  );
  if (producedAugust !== 1000) {
    throw new Error(
      `expected August production to use February-onward 100% terms, got ${producedAugust}`,
    );
  }

  const salariedMonthly: EmployeePayProfile[] = [
    {
      fullName: "ניב קובי",
      employmentKind: "salaried",
      contract: emptyPayContract(),
      agreements: [
        {
          id: "open",
          from: "",
          to: "",
          employmentKind: "salaried",
          contract: {
            ...emptyPayContract(),
            productionTiers: [
              { from: 0, to: 2500, multiplier: 1 },
              { from: 2501, to: null, multiplier: 4 },
            ],
          },
        },
      ],
    },
  ];
  const splitMonths = wageForContractProductions(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 2000,
        process: "מכירה",
        transferDate: "2026-04-10",
        startDate: "2026-07-01",
      },
      {
        status: "active",
        agent: "ניב קובי",
        premium: 2000,
        process: "מכירה",
        transferDate: "2026-04-11",
        startDate: "2026-08-01",
      },
    ],
    { profiles: salariedMonthly, rates: [], kind: "volume" },
  );
  if (splitMonths !== 4000) {
    throw new Error(
      `expected each production month on its own tier (2000+2000), got ${splitMonths}`,
    );
  }

  const salariedNoSettled = wageForContractProductions(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 2000,
        process: "מינוי סוכן",
        startDate: "2026-08-01",
      },
    ],
    {
      profiles: [
        {
          fullName: "ניב קובי",
          employmentKind: "salaried",
          contract: emptyPayContract(),
          agreements: [
            {
              id: "open",
              from: "",
              to: "",
              employmentKind: "salaried",
              contract: {
                ...emptyPayContract(),
                agentAppointmentPercent: 50,
                productionTiers: [{ from: 0, to: null, multiplier: 2 }],
              },
            },
          ],
        },
      ],
      rates: [],
      kind: "settled",
    },
  );
  if (salariedNoSettled !== 0) {
    throw new Error(`expected salaried settled wage 0, got ${salariedNoSettled}`);
  }

  const hourlyContract = {
    ...emptyPayContract(),
    salaryKind: "hourly" as const,
    hourlyRate: 50,
  };
  const hourlyTotals = contractWageTotals(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 1000,
        process: "מכירה",
        startDate: "2026-08-01",
      },
    ],
    {
      profiles: [
        {
          fullName: "ניב קובי",
          employmentKind: "salaried",
          contract: hourlyContract,
          hoursByMonth: { "2026-07": 160 },
          agreements: [
            {
              id: "open",
              from: "",
              to: "",
              employmentKind: "salaried",
              contract: hourlyContract,
            },
          ],
        },
      ],
      rates: [],
    },
  );
  if (hourlyTotals[0]?.volumeWage !== 8000 || hourlyTotals[0]?.settledWage !== 0) {
    throw new Error(
      `expected hourly salaried 8000 volume / 0 settled, got ${hourlyTotals[0]?.volumeWage}/${hourlyTotals[0]?.settledWage}`,
    );
  }

  const globalContract = {
    ...emptyPayContract(),
    salaryKind: "global" as const,
    globalSalary: 12000,
  };
  const globalTotals = contractWageTotals(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 1000,
        process: "מינוי סוכן",
        startDate: "2026-08-01",
      },
    ],
    {
      profiles: [
        {
          fullName: "ניב קובי",
          employmentKind: "salaried",
          contract: globalContract,
          hoursByMonth: { "2026-07": 140 },
          agreements: [
            {
              id: "open",
              from: "",
              to: "",
              employmentKind: "salaried",
              contract: globalContract,
            },
          ],
        },
      ],
      rates: [],
    },
  );
  if (globalTotals[0]?.volumeWage !== 12000 || globalTotals[0]?.settledWage !== 0 || globalTotals[0]?.earned !== 12000) {
    throw new Error(
      `expected global salaried 12000 volume / 0 settled, got ${globalTotals[0]?.volumeWage}/${globalTotals[0]?.settledWage}/${globalTotals[0]?.earned}`,
    );
  }

  const withTravel = {
    ...emptyPayContract(),
    salaryKind: "hourly" as const,
    hourlyRate: 50,
    travelAmount: 400,
  };
  const travelWorked = salariedBaseWageForMonth(withTravel, 160);
  const travelIdle = salariedBaseWageForMonth(withTravel, 0);
  if (travelWorked !== 8400) {
    throw new Error(`expected hourly plus monthly travel 8400, got ${travelWorked}`);
  }
  if (travelIdle !== 0) {
    throw new Error(`expected no travel without hours, got ${travelIdle}`);
  }
  const globalTravel = salariedBaseWageForMonth(
    { ...emptyPayContract(), salaryKind: "global", globalSalary: 12000, travelAmount: 400 },
    0,
  );
  if (globalTravel !== 12400) {
    throw new Error(`expected global plus travel 12400, got ${globalTravel}`);
  }
  const salaryOnly = {
    ...emptyPayContract(),
    salaryKind: "salary_only" as const,
    globalSalary: 3400,
    travelAmount: 400,
    variableExpenses: [{ id: "bonus", amount: 500, note: "בונוס" }],
    productionTiers: [{ from: 0, to: null, multiplier: 5 }],
  };
  if (salariedGrossWageForMonth(salaryOnly, 160) !== 3400) {
    throw new Error(
      `expected salary-only 3400 with no travel or bonus, got ${salariedGrossWageForMonth(salaryOnly, 160)}`,
    );
  }
  const salaryOnlyTotals = contractWageTotals(
    [
      {
        status: "active",
        agent: "ניב קובי",
        premium: 1000,
        process: "מכירה",
        startDate: "2026-08-01",
      },
    ],
    {
      profiles: [
        {
          fullName: "ניב קובי",
          employmentKind: "salaried",
          contract: salaryOnly,
          hoursByMonth: { "2026-07": 140 },
          agreements: [
            {
              id: "july",
              from: "2026-07-01",
              to: "2026-07-31",
              employmentKind: "salaried",
              contract: salaryOnly,
            },
          ],
        },
      ],
      rates: [],
    },
  );
  if (
    salaryOnlyTotals[0]?.volumeWage !== 3400 ||
    salaryOnlyTotals[0]?.settledWage !== 0 ||
    salaryOnlyTotals[0]?.earned !== 3400
  ) {
    throw new Error(
      `expected salary-only 3400 with no production bonus, got ${salaryOnlyTotals[0]?.volumeWage}/${salaryOnlyTotals[0]?.settledWage}/${salaryOnlyTotals[0]?.earned}`,
    );
  }

  const withFunds = {
    ...emptyPayContract(),
    salaryKind: "hourly" as const,
    hourlyRate: 50,
    travelAmount: 400,
    pensionEmployeePercent: 6,
    pensionEmployerPercent: 6.5,
    studyFundEmployeePercent: 2.5,
    studyFundEmployerPercent: 7.5,
  };
  const funds = salaryBenefitsForMonth(withFunds, 160);
  if (funds.pensionable !== 8000) {
    throw new Error(`expected pensionable 8000, got ${funds.pensionable}`);
  }
  if (funds.pensionEmployee !== 480 || funds.pensionEmployer !== 520) {
    throw new Error(
      `expected pension 480/520, got ${funds.pensionEmployee}/${funds.pensionEmployer}`,
    );
  }
  if (funds.studyFundEmployee !== 200 || funds.studyFundEmployer !== 600) {
    throw new Error(
      `expected study fund 200/600, got ${funds.studyFundEmployee}/${funds.studyFundEmployer}`,
    );
  }
  const fundedWage = salariedBaseWageForMonth(withFunds, 160);
  if (fundedWage !== 9520) {
    throw new Error(`expected gross 8400 plus employer 1120 = 9520, got ${fundedWage}`);
  }
  const idleFunds = salaryBenefitsForMonth(withFunds, 0);
  if (idleFunds.employerExtra !== 0 || salariedBaseWageForMonth(withFunds, 0) !== 0) {
    throw new Error("expected no pension or study fund without hourly hours");
  }

  const withCeiling = {
    ...withFunds,
    contributionCeiling: 5000,
    severanceEmployerPercent: 6,
  };
  const capped = salaryBenefitsForMonth(withCeiling, 160);
  if (capped.grossPensionable !== 8000 || capped.pensionable !== 5000 || !capped.overCeiling) {
    throw new Error(
      `expected cap 5000 of 8000, got gross ${capped.grossPensionable} / base ${capped.pensionable}`,
    );
  }
  if (capped.severanceEmployer !== 300) {
    throw new Error(`expected severance 300 on ceiling, got ${capped.severanceEmployer}`);
  }
  if (capped.pensionEmployee !== 300 || capped.pensionEmployer !== 325) {
    throw new Error(
      `expected capped pension 300/325, got ${capped.pensionEmployee}/${capped.pensionEmployer}`,
    );
  }
  if (capped.studyFundEmployee !== 125 || capped.studyFundEmployer !== 375) {
    throw new Error(
      `expected capped study 125/375, got ${capped.studyFundEmployee}/${capped.studyFundEmployer}`,
    );
  }

  const withTiers = salaryBenefitsForMonth(withFunds, 160, 759);
  if (withTiers.grossPensionable !== 8759 || withTiers.salesWage !== 759) {
    throw new Error(
      `expected salary+tiers 8759, got ${withTiers.grossPensionable} / ${withTiers.salesWage}`,
    );
  }
  if (withTiers.pensionEmployee !== 526 || withTiers.pensionEmployer !== 569) {
    throw new Error(
      `expected pension on salary+tiers 526/569, got ${withTiers.pensionEmployee}/${withTiers.pensionEmployer}`,
    );
  }
  const cappedWithTiers = salaryBenefitsForMonth(withCeiling, 160, 759);
  if (cappedWithTiers.pensionable !== 5000) {
    throw new Error(`expected ceiling still 5000 with tiers, got ${cappedWithTiers.pensionable}`);
  }

  const parsedDefaults = parsePayAgreements({
    agreements: [
      {
        id: "blank",
        from: "",
        to: "",
        employmentKind: "salaried",
        salaryKind: "hourly",
        hourlyRate: 50,
      },
    ],
  });
  const blankSalaried = parsedDefaults[0]?.contract;
  if (
    !blankSalaried ||
    blankSalaried.contributionCeiling !== DEFAULT_SALARIED_BENEFITS.contributionCeiling ||
    blankSalaried.travelAmount !== DEFAULT_SALARIED_BENEFITS.travelAmount ||
    blankSalaried.pensionEmployeePercent !== DEFAULT_SALARIED_BENEFITS.pensionEmployeePercent ||
    blankSalaried.pensionEmployerPercent !== DEFAULT_SALARIED_BENEFITS.pensionEmployerPercent ||
    blankSalaried.severanceEmployerPercent !== DEFAULT_SALARIED_BENEFITS.severanceEmployerPercent ||
    blankSalaried.studyFundEmployeePercent !== DEFAULT_SALARIED_BENEFITS.studyFundEmployeePercent ||
    blankSalaried.studyFundEmployerPercent !== DEFAULT_SALARIED_BENEFITS.studyFundEmployerPercent
  ) {
    throw new Error("expected blank salaried agreement to use Niv Lev Ran benefit defaults");
  }
  const keptCustom = parsePayAgreements({
    agreements: [
      {
        id: "custom",
        from: "",
        to: "",
        employmentKind: "salaried",
        ...emptyPayContract(),
        pensionEmployeePercent: 7,
        travelAmount: 180,
      },
    ],
  })[0]?.contract;
  if (!keptCustom || keptCustom.pensionEmployeePercent !== 7 || keptCustom.travelAmount !== 180) {
    throw new Error("expected manual salaried overrides to stay");
  }
  const keptZero = parsePayAgreements({
    agreements: [
      {
        id: "zero",
        from: "",
        to: "",
        employmentKind: "salaried",
        ...emptyPayContract(),
        pensionEmployeePercent: 0,
        pensionEmployerPercent: 0,
        severanceEmployerPercent: 0,
        studyFundEmployeePercent: 0,
        studyFundEmployerPercent: 0,
        contributionCeiling: 0,
        travelAmount: 0,
      },
    ],
  })[0]?.contract;
  if (
    !keptZero ||
    keptZero.pensionEmployeePercent !== 0 ||
    keptZero.pensionEmployerPercent !== 0 ||
    keptZero.severanceEmployerPercent !== 0 ||
    keptZero.studyFundEmployeePercent !== 0 ||
    keptZero.studyFundEmployerPercent !== 0 ||
    keptZero.contributionCeiling !== 0 ||
    keptZero.travelAmount !== 0
  ) {
    throw new Error("expected explicit zeros on a salaried agreement to stay");
  }
  const roundTrip = parsePayAgreements(
    serializePayAgreements([
      {
        id: "rt",
        from: "",
        to: "",
        employmentKind: "salaried",
        contract: {
          ...defaultSalariedPayContract(),
          pensionEmployeePercent: 0,
          pensionEmployerPercent: 3,
          travelAmount: 0,
        },
      },
    ]),
  )[0]?.contract;
  if (
    !roundTrip ||
    roundTrip.pensionEmployeePercent !== 0 ||
    roundTrip.pensionEmployerPercent !== 3 ||
    roundTrip.travelAmount !== 0 ||
    roundTrip.pensionFromFirstMonth !== true
  ) {
    throw new Error("expected saved manual benefits, including zero, to round-trip");
  }

  const waitPension = parsePayAgreements(
    serializePayAgreements([
      {
        id: "wait",
        from: "2026-01-01",
        to: "",
        employmentKind: "salaried",
        contract: {
          ...defaultSalariedPayContract(),
          salaryKind: "salary_only",
          globalSalary: 10000,
          pensionFromFirstMonth: false,
        },
      },
    ]),
  )[0]?.contract;
  if (!waitPension || waitPension.pensionFromFirstMonth !== false) {
    throw new Error("expected pension-after-3-months flag to round-trip");
  }
  const waitCtxJan = { month: "2026-01", agreementFrom: "2026-01-01" };
  const waitCtxMar = { month: "2026-03", agreementFrom: "2026-01-01" };
  const waitCtxApr = { month: "2026-04", agreementFrom: "2026-01-01" };
  const waitJanFunds = salaryBenefitsForMonth(waitPension, 0, 0, waitCtxJan);
  const waitMarFunds = salaryBenefitsForMonth(waitPension, 0, 0, waitCtxMar);
  const waitAprFunds = salaryBenefitsForMonth(waitPension, 0, 0, waitCtxApr);
  if (
    !waitJanFunds.pensionWaiting ||
    waitJanFunds.pensionEmployee !== 0 ||
    waitJanFunds.pensionEmployer !== 0 ||
    waitJanFunds.severanceEmployer <= 0
  ) {
    throw new Error("expected January pension wait with severance still paid");
  }
  if (!waitMarFunds.pensionWaiting || waitMarFunds.pensionEmployer !== 0) {
    throw new Error("expected March still in the 3-month pension wait");
  }
  if (
    waitAprFunds.pensionWaiting ||
    waitAprFunds.pensionEmployee !== 600 ||
    waitAprFunds.pensionEmployer !== 650
  ) {
    throw new Error(
      `expected April pension 600/650 after wait, got ${waitAprFunds.pensionEmployee}/${waitAprFunds.pensionEmployer}`,
    );
  }

  const withExtras = {
    ...emptyPayContract(),
    salaryKind: "hourly" as const,
    hourlyRate: 50,
    travelAmount: 400,
    variableExpenses: [{ id: "bonus", amount: 500, note: "תוספת מהחברה" }],
  };
  const extrasWorked = salariedGrossWageForMonth(withExtras, 160);
  if (extrasWorked !== 8900) {
    throw new Error(`expected hourly+travel+variable 8900, got ${extrasWorked}`);
  }
  if (salaryBenefitsForMonth(withExtras, 160).pensionable !== 8000) {
    throw new Error("variable expenses must not enter the pension base");
  }

  const formula1 = {
    ...emptyPayContract(),
    volumePercent: 550,
    freelancerFormula: "freelancers_1" as const,
  };
  const formula1Profile: EmployeePayProfile = {
    fullName: "ניב קובי",
    employmentKind: "freelancer",
    contract: formula1,
    agreements: [
      {
        id: "open",
        from: "",
        to: "",
        employmentKind: "freelancer",
        contract: formula1,
      },
    ],
  };
  const sale300: WageInputRow = {
    status: "active",
    agent: "ניב קובי",
    premium: 300,
    process: "מכירה",
    product: "בריאות",
    source: "שיחות",
    startDate: "2026-01-15",
  };
  const januaryVolume = wageForContractProductions([sale300], {
    profiles: [formula1Profile],
    rates: [],
    kind: "volume",
  });
  if (januaryVolume !== 1650) {
    throw new Error(`expected עצמאים 1 volume 550% of 300 = 1650, got ${januaryVolume}`);
  }
  const januarySettled = wageForContractProductions([sale300], {
    profiles: [formula1Profile],
    rates: [],
    kind: "settled",
  });
  if (januarySettled !== 0) {
    throw new Error(`expected no settled wage on the sale row itself, got ${januarySettled}`);
  }
  const janPay = freelancers1SettledForPayMonth(formula1Profile, [sale300], "2026-01");
  const marPay = freelancers1SettledForPayMonth(formula1Profile, [sale300], "2026-03");
  const aprPay = freelancers1SettledForPayMonth(formula1Profile, [sale300], "2026-04");
  if (janPay.wage !== 0) {
    throw new Error(`expected שוטף 60 not to pay in the sale month, got ${janPay.wage}`);
  }
  if (marPay.wage !== 33 || marPay.newWage !== 33 || marPay.trailWage !== 0 || marPay.saleMonth !== "2026-01") {
    throw new Error(`expected March נפרעים 1 = 33 new from January 300, got ${marPay.wage} / ${marPay.saleMonth}`);
  }
  if (aprPay.wage !== 33 || aprPay.newWage !== 0 || aprPay.trailWage !== 33) {
    throw new Error(`expected April trailing 33 from January, got new=${aprPay.newWage} trail=${aprPay.trailWage}`);
  }
  const saleFeb: WageInputRow = {
    ...sale300,
    premium: 500,
    startDate: "2026-02-10",
  };
  const aprMix = freelancers1SettledForPayMonth(formula1Profile, [sale300, saleFeb], "2026-04");
  if (aprMix.newWage !== 55 || aprMix.trailWage !== 33 || aprMix.wage !== 88) {
    throw new Error(`expected April 55 new + 33 trail = 88, got ${aprMix.newWage}+${aprMix.trailWage}`);
  }
  const cancelledJan: WageInputRow = { ...sale300, status: "cancelled" };
  const aprCancelled = freelancers1SettledForPayMonth(formula1Profile, [cancelledJan, saleFeb], "2026-04");
  if (aprCancelled.trailWage !== 0 || aprCancelled.newWage !== 55) {
    throw new Error("cancelled policies must drop out of the trailing book");
  }
  const lifeApr = freelancers1SettledLifetime(formula1Profile, [sale300], "2026-04");
  if (lifeApr.wage !== 66) {
    throw new Error(`expected lifetime through April = March 33 + April 33 trail, got ${lifeApr.wage}`);
  }

  const formula3 = {
    ...emptyPayContract(),
    freelancerFormula: "freelancers_3" as const,
    volumePercent: 100,
    settledPercent: 42,
  };
  const formula3Profile: EmployeePayProfile = {
    fullName: "בן סגל",
    employmentKind: "freelancer",
    contract: formula3,
    agreements: [
      {
        id: "open",
        from: "",
        to: "",
        employmentKind: "freelancer",
        contract: formula3,
      },
    ],
  };
  const benSale: WageInputRow = {
    status: "active",
    agent: "בן סגל",
    premium: 1000,
    process: "מכירה",
    product: "בריאות",
    source: "שיחות",
    startDate: "2026-06-15",
  };
  const benAppointment: WageInputRow = {
    ...benSale,
    process: "מינוי סוכן",
    premium: 2000,
  };
  const benVolume = wageForContractProductions([benSale, benAppointment], {
    profiles: [formula3Profile],
    rates: [],
    kind: "volume",
  });
  const benSettled = wageForContractProductions([benSale, benAppointment], {
    profiles: [formula3Profile],
    rates: [],
    kind: "settled",
  });
  if (benVolume !== 7000) {
    throw new Error(`expected עצמאים 3 volume 7×1000 = 7000, got ${benVolume}`);
  }
  if (benSettled !== 0) {
    throw new Error(`expected עצמאים 3 with no settled, got ${benSettled}`);
  }
  const benBook = freelancers1SettledForPayMonth(formula3Profile, [benSale], "2026-08");
  if (benBook.wage !== 0) {
    throw new Error(`expected no שוטף 60 book for עצמאים 3, got ${benBook.wage}`);
  }
  const costs = {
    ...emptyPayContract(),
    stationCost: 100,
    operationsCost: 50,
    officeCost: 25.4,
  };
  if (monthlyCostsTotal(costs) !== 175) {
    throw new Error(`expected monthly costs 175, got ${monthlyCostsTotal(costs)}`);
  }
  const oldSale: WageInputRow = { ...sale300, startDate: "2021-02-15" };
  const oldPay = freelancers1SettledForPayMonth(formula1Profile, [oldSale], "2021-04");
  if (oldPay.wage !== 0) {
    throw new Error("expected pre-2026 productions not to enter wage months");
  }
  const from2026 = freelancers1PayMonthsThrough(formula1Profile, [oldSale, sale300], "2026-04");
  if (from2026[0] !== "2026-03" || from2026.some((month) => month < "2026-01")) {
    throw new Error(`expected pay months from 2026 only, got ${from2026.join(",")}`);
  }
  const formula2 = {
    ...emptyPayContract(),
    volumePercent: 550,
    freelancerFormula: "freelancers_2" as const,
  };
  const formula2Profile: EmployeePayProfile = {
    ...formula1Profile,
    fullName: "חן בר און",
    contract: formula2,
    agreements: [
      {
        id: "open2",
        from: "",
        to: "",
        employmentKind: "freelancer",
        contract: formula2,
      },
    ],
  };
  const chenSale: WageInputRow = { ...sale300, agent: "חן בר און" };
  const mar2 = freelancers1SettledForPayMonth(formula2Profile, [chenSale], "2026-03");
  if (mar2.wage !== 28 || mar2.newWage !== 28) {
    throw new Error(`expected עצמאים 2 March 9.3% of 300 = 28, got ${mar2.wage}`);
  }

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
  const splitProfile: EmployeePayProfile = {
    fullName: "חן בר און",
    employmentKind: "freelancer",
    contract: freelancerFromMay,
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
  const aprilSale: WageInputRow = {
    status: "active",
    agent: "חן בר און",
    premium: 800,
    process: "מכירה",
    product: "בריאות",
    source: "שיחות",
    startDate: "2026-04-15",
  };
  const maySale: WageInputRow = {
    ...aprilSale,
    premium: 1000,
    startDate: "2026-05-15",
  };
  const splitRows = [aprilSale, maySale];
  const aprilVolume = wageForContractProductions(splitRows.filter((row) => row.startDate === "2026-04-15"), {
    profiles: [splitProfile],
    rates: [],
    kind: "volume",
  });
  if (aprilVolume !== 0) {
    throw new Error(`expected global salaried April to ignore leftover tiers, got ${aprilVolume}`);
  }
  const mayVolume = wageForContractProductions(splitRows.filter((row) => row.startDate === "2026-05-15"), {
    profiles: [splitProfile],
    rates: [],
    kind: "volume",
  });
  if (mayVolume !== 5000) {
    throw new Error(`expected May freelancer 500% of 1000 = 5000, got ${mayVolume}`);
  }
  const aprilSettledPay = freelancers1SettledForPayMonth(splitProfile, splitRows, "2026-04");
  if (aprilSettledPay.wage !== 0 || aprilSettledPay.count !== 0) {
    throw new Error(`expected no נפרעים in salaried April, got ${aprilSettledPay.wage}/${aprilSettledPay.count}`);
  }
  const julySettledPay = freelancers1SettledForPayMonth(splitProfile, splitRows, "2026-07");
  if (julySettledPay.wage !== 93 || julySettledPay.newWage !== 93 || julySettledPay.count !== 1) {
    throw new Error(
      `expected July נפרעים only from May 1000 at 9.3% = 93, got wage=${julySettledPay.wage} new=${julySettledPay.newWage} count=${julySettledPay.count}`,
    );
  }

  const formula4 = {
    ...emptyPayContract(),
    freelancerFormula: "freelancers_4" as const,
    volumePercent: 10,
    settledPercent: 42,
  };
  const avichaiProfile: EmployeePayProfile = {
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
    agent: string,
    premium: number,
    startDate: string,
  ): WageInputRow => ({
    status: "active",
    agent,
    premium,
    process: "מכירה",
    product: "בריאות",
    source: "שיחות",
    startDate,
  });
  if (extrasAmountForMonth(formula4) !== FREELANCERS_4.fixedMonthly) {
    throw new Error("expected עצמאים 4 fixed monthly 5000 on top of the formula");
  }
  const aprilHubRows = [
    hubSale("ניב קובי", 10000, "2026-04-10"),
    hubSale("בן סגל", 11000, "2026-04-20"),
  ];
  const aprilHubWage = wageForContractProductions(aprilHubRows, {
    profiles: [avichaiProfile],
    rates: [],
    kind: "volume",
  });
  if (aprilHubWage !== 15750) {
    throw new Error(`expected מוקד 21,000 × 75% = 15750, got ${aprilHubWage}`);
  }
  const aprilWithShemesh = wageForContractProductions(
    [
      ...aprilHubRows,
      { ...hubSale("ניב - שמש", 8000, "2026-04-12"), source: "קמפיין שמש" },
    ],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (aprilWithShemesh !== 21750) {
    throw new Error(`expected ניב - שמש in April to join hub 29,000 × 75% = 21750, got ${aprilWithShemesh}`);
  }
  const shemeshOnly = wageForContractProductions(
    [{ ...hubSale("שי בר און", 21000, "2026-04-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (shemeshOnly !== 0) {
    throw new Error(`expected no ליבה volume from שמש-only month, got ${shemeshOnly}`);
  }
  const guestApril = wageForContractProductions(
    [
      hubSale("ניב קובי", 15000, "2026-04-10"),
      { ...hubSale("שמש", 6000, "2026-04-12"), source: "קמפיין שמש" },
    ],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestApril !== 15750) {
    throw new Error(`expected guest שמש in April to join ליבה hub 21,000 × 75%, got ${guestApril}`);
  }
  const guestHyphen = wageForContractProductions(
    [{ ...hubSale("דניאל כהן שמש", 21000, "2026-04-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestHyphen !== 15750) {
    throw new Error(`expected דניאל כהן שמש without hyphen to count in April, got ${guestHyphen}`);
  }
  const guestNiv = wageForContractProductions(
    [{ ...hubSale("ניב לב רן - שמש", 21000, "2026-05-15"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestNiv !== 15750) {
    throw new Error(`expected ניב לב רן - שמש to count in May, got ${guestNiv}`);
  }
  const guestNivJune = wageForContractProductions(
    [{ ...hubSale("ניב לב רן - שמש", 21000, "2026-06-15"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestNivJune !== 0) {
    throw new Error(`expected ניב לב רן - שמש in June excluded, got ${guestNivJune}`);
  }
  const guestNivJune1 = wageForContractProductions(
    [{ ...hubSale("שמש", 21000, "2026-06-01"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestNivJune1 !== 15750) {
    throw new Error(`expected 01/06 שמש production to stay in May window, got ${guestNivJune1}`);
  }
  const guestNivShortName = wageForContractProductions(
    [{ ...hubSale("ניב לב רן", 21000, "2026-04-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestNivShortName !== 15750) {
    throw new Error(`expected ניב לב רן on קמפיין שמש to count in April, got ${guestNivShortName}`);
  }
  const guestNivShort = wageForContractProductions(
    [{ ...hubSale("ניב שמש", 21000, "2026-04-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestNivShort !== 15750) {
    throw new Error(`expected ניב שמש to count in April, got ${guestNivShort}`);
  }
  const guestJuly1 = wageForContractProductions(
    [{ ...hubSale("שמש", 21000, "2026-07-01"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestJuly1 !== 0) {
    throw new Error(`expected 01/07 שמש production (June wage month) excluded, got ${guestJuly1}`);
  }
  const guestAfter = wageForContractProductions(
    [{ ...hubSale("שמש", 21000, "2026-07-02"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (guestAfter !== 0) {
    throw new Error(`expected שמש from July 2026 onward excluded, got ${guestAfter}`);
  }
  const alwaysNivJuly = wageForContractProductions(
    [{ ...hubSale("ניב לב רן", 21000, "2026-07-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysNivJuly !== 15750) {
    throw new Error(`expected ניב לב רן on שמש in July to count, got ${alwaysNivJuly}`);
  }
  const alwaysNivMay = wageForContractProductions(
    [{ ...hubSale("ניב לב רן", 21000, "2026-05-15"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysNivMay !== 15750) {
    throw new Error(`expected ניב לב רן on שמש in May to count, got ${alwaysNivMay}`);
  }
  const alwaysNivJune = wageForContractProductions(
    [{ ...hubSale("ניב לב רן", 21000, "2026-06-15"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysNivJune !== 15750) {
    throw new Error(`expected ניב לב רן on שמש in June to count, got ${alwaysNivJune}`);
  }
  const alwaysNivJuly1 = wageForContractProductions(
    [{ ...hubSale("ניב לב רן", 21000, "2026-07-01"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysNivJuly1 !== 15750) {
    throw new Error(`expected ניב לב רן on שמש 01/07 (June wage) to count, got ${alwaysNivJuly1}`);
  }
  const alwaysLibaJune = wageForContractProductions(
    [hubSale("ניב לב רן", 21000, "2026-06-15")],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysLibaJune !== 15750) {
    throw new Error(`expected ניב לב רן ליבה in June to still count, got ${alwaysLibaJune}`);
  }
  const alwaysDanielJuly = wageForContractProductions(
    [{ ...hubSale("דניאל כהן", 21000, "2026-07-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (alwaysDanielJuly !== 0) {
    throw new Error(`expected דניאל כהן on שמש from June onward excluded, got ${alwaysDanielJuly}`);
  }
  const windowDanielJuly = wageForContractProductions(
    [{ ...hubSale("דניאל כהן - שמש", 21000, "2026-07-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (windowDanielJuly !== 0) {
    throw new Error(`expected דניאל כהן - שמש from July excluded, got ${windowDanielJuly}`);
  }
  const windowNivJuly = wageForContractProductions(
    [{ ...hubSale("ניב לב רן - שמש", 21000, "2026-07-10"), source: "קמפיין שמש" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (windowNivJuly !== 0) {
    throw new Error(`expected ניב לב רן - שמש from July excluded, got ${windowNivJuly}`);
  }
  const guestSettled = freelancers1SettledForPayMonth(
    avichaiProfile,
    [{ ...hubSale("שמש", 15000, "2026-01-15"), source: "קמפיין שמש" }],
    "2026-03",
  );
  if (guestSettled.wage !== 0) {
    throw new Error(`expected no נפרעים on guest שמש sales, got ${guestSettled.wage}`);
  }
  const nivLibaShemeshSettled = freelancers1SettledForPayMonth(
    avichaiProfile,
    [{ ...hubSale("ניב לב רן", 15000, "2026-01-15"), source: "קמפיין שמש" }],
    "2026-03",
  );
  if (nivLibaShemeshSettled.wage !== 0) {
    throw new Error(`expected no נפרעים on ניב לב רן קמפיין שמש, got ${nivLibaShemeshSettled.wage}`);
  }
  const mixedSettled = freelancers1SettledForPayMonth(
    avichaiProfile,
    [
      hubSale("ניב קובי", 15000, "2026-01-15"),
      { ...hubSale("שמש", 6000, "2026-01-20"), source: "קמפיין שמש" },
    ],
    "2026-03",
  );
  if (mixedSettled.wage !== 450 || mixedSettled.premium !== 15000) {
    throw new Error(
      `expected March נפרעים only on ליבה 15,000, got wage=${mixedSettled.wage} premium=${mixedSettled.premium}`,
    );
  }
  const juneHubWage = wageForContractProductions([hubSale("ניב קובי", 19000, "2026-06-15")], {
    profiles: [avichaiProfile],
    rates: [],
    kind: "volume",
  });
  if (juneHubWage !== 9500) {
    throw new Error(`expected מוקד 19,000 × 50% = 9500, got ${juneHubWage}`);
  }
  const exactThreshold = wageForContractProductions([hubSale("ניב קובי", 20000, "2026-05-15")], {
    profiles: [avichaiProfile],
    rates: [],
    kind: "volume",
  });
  if (exactThreshold !== 10000) {
    throw new Error(`expected exactly 20,000 to stay at 50% = 10000, got ${exactThreshold}`);
  }
  const crossed = wageForContractProductions([hubSale("ניב קובי", 20001, "2026-05-15")], {
    profiles: [avichaiProfile],
    rates: [],
    kind: "volume",
  });
  if (crossed !== 15001) {
    throw new Error(`expected 20,001 × 75% = 15001, got ${crossed}`);
  }
  const hubAppointment = wageForContractProductions(
    [{ ...hubSale("ניב קובי", 21000, "2026-04-10"), process: "מינוי סוכן" }],
    { profiles: [avichaiProfile], rates: [], kind: "volume" },
  );
  if (hubAppointment !== 0) {
    throw new Error(`expected עצמאים 4 היקף on מכירה only, got ${hubAppointment}`);
  }
  const janSettledRows = [hubSale("מישהו מהמוקד", 15000, "2026-01-15")];
  const shemeshSettled = {
    ...hubSale("ניב - שמש", 15000, "2026-01-15"),
    source: "קמפיין שמש",
  };
  const janBook = freelancers1SettledForPayMonth(avichaiProfile, janSettledRows, "2026-01");
  const marBook = freelancers1SettledForPayMonth(avichaiProfile, janSettledRows, "2026-03");
  const aprBook = freelancers1SettledForPayMonth(avichaiProfile, janSettledRows, "2026-04");
  const marShemesh = freelancers1SettledForPayMonth(avichaiProfile, [shemeshSettled], "2026-03");
  if (janBook.wage !== 0) {
    throw new Error(`expected שוטף 60 not to pay in January, got ${janBook.wage}`);
  }
  if (marBook.wage !== 450 || marBook.newWage !== 450) {
    throw new Error(`expected March 3% of 15,000 = 450, got ${marBook.wage}`);
  }
  if (aprBook.wage !== 450 || aprBook.newWage !== 0 || aprBook.trailWage !== 450) {
    throw new Error(`expected April trailing 450, got new=${aprBook.newWage} trail=${aprBook.trailWage}`);
  }
  if (marShemesh.wage !== 0) {
    throw new Error(`expected no נפרעים from שמש productions, got ${marShemesh.wage}`);
  }
  const aprilTotals = contractWageTotals(aprilHubRows, {
    profiles: [avichaiProfile],
    rates: [],
  });
  const avichaiLive = wageTotalForEmployeeContract("אביחי יוסף", aprilTotals);
  if (avichaiLive.volumePremium !== 21000 || avichaiLive.volumeWage !== 20750 + FREELANCERS_4.oneTimeGap.amount) {
    throw new Error(
      `expected live היקף 21,000 and wage 15,750+5,000+one-time, got premium=${avichaiLive.volumePremium} wage=${avichaiLive.volumeWage}`,
    );
  }

  const paSale: WageInputRow = {
    status: "active",
    agent: "אביחי יוסף",
    premium: 5000,
    process: "מכירה",
    product: "תאונות אישיות",
    source: "שיחות נכנסות",
    startDate: "2026-04-20",
  };
  const healthSale: WageInputRow = {
    ...paSale,
    product: "בריאות",
    premium: 1000,
  };
  const paOnly = wageForContractProductions([paSale], {
    profiles: [avichaiProfile],
    rates: [],
    kind: "volume",
  });
  if (paOnly !== 0) {
    throw new Error(`expected no volume wage on תאונות אישיות, got ${paOnly}`);
  }
  const withPa = buildAgentPremiumTotals([paSale, healthSale]);
  if ((withPa.volume.get(excelAgentKey("אביחי יוסף")) ?? 0) !== 1000) {
    throw new Error(
      `expected volume threshold to ignore תאונות and keep 1000 בריאות, got ${withPa.volume.get(excelAgentKey("אביחי יוסף"))}`,
    );
  }
  if (!isPersonalAccidentProduct("תאונות") || !isPersonalAccidentProduct("ת.א.")) {
    throw new Error("expected תאונות / ת.א. to count as personal accident");
  }
}
