import { CASE_STAGES, type CaseStageId } from "@/lib/shemesh/catalog";
import { shemeshAdmin } from "@/lib/shemesh/db";
import { slaOverdue } from "@/lib/shemesh/fees";
import { monthLinesFromRules } from "@/lib/shemesh/ops";

export type StoryCase = { status: string; stage: string; deadline: string | null };
export type StoryLedger = { kind: string; status: string; gross: number | null; fee: number | null; net: number | null };
export type StoryRule = { id: string; kind: string; title: string; amount: number | null; cadence: string; startsOn: string | null; active: boolean };

export type ShemeshBooks = {
  missing: boolean;
  month: string;
  collectedNet: number;
  openRedemptionGross: number;
  openRedemptionNet: number;
  waitingTaxNet: number;
  monthIncome: number;
  monthCost: number;
  monthPayroll: number;
  monthCommission: number;
  monthDebt: number;
  operatingResult: number;
  licenseCommission: number;
  openCases: number;
  overdueCases: number;
  stageCounts: Record<CaseStageId, number>;
  incomeMatchesCollected: boolean;
};

const CLOSED = new Set(["done", "cancelled"]);

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function monthTotal(rules: StoryRule[], kind: string, month: string): number {
  return sum(monthLinesFromRules(
    rules.filter((rule) => rule.kind === kind).map((rule) => ({
      id: rule.id,
      kind: rule.kind,
      title: rule.title,
      amount: rule.amount,
      cadence: rule.cadence,
      day_of_month: null,
      starts_on: rule.startsOn,
      active: rule.active,
    })),
    month,
  ).map((line) => line.amount));
}

export function summarizeShemeshBooks(input: {
  month: string;
  today: string;
  cases: StoryCase[];
  ledger: StoryLedger[];
  rules: StoryRule[];
  licenseCommission: number;
}): ShemeshBooks {
  const stageCounts = Object.fromEntries(CASE_STAGES.map((stage) => [stage.id, 0])) as Record<CaseStageId, number>;
  for (const item of input.cases) {
    if (item.stage in stageCounts) stageCounts[item.stage as CaseStageId] += 1;
  }
  const collected = input.ledger.filter((row) => row.status === "done");
  const openRedemptions = input.ledger.filter((row) => row.kind === "redemption" && !CLOSED.has(row.status));
  const waitingTax = input.ledger.filter((row) => row.kind === "tax_refund" && row.status === "waiting");
  const collectedNet = sum(collected.map((row) => row.net));
  const monthIncome = monthTotal(input.rules, "income", input.month);
  const monthCost = monthTotal(input.rules, "cost", input.month);
  const monthPayroll = monthTotal(input.rules, "payroll", input.month);
  const monthCommission = monthTotal(input.rules, "commission", input.month);
  const monthDebt = monthTotal(input.rules, "debt", input.month);
  return {
    missing: false,
    month: input.month,
    collectedNet,
    openRedemptionGross: sum(openRedemptions.map((row) => row.gross)),
    openRedemptionNet: sum(openRedemptions.map((row) => row.net)),
    waitingTaxNet: sum(waitingTax.map((row) => row.net)),
    monthIncome,
    monthCost,
    monthPayroll,
    monthCommission,
    monthDebt,
    operatingResult: collectedNet - monthCost - monthPayroll - monthCommission,
    licenseCommission: input.licenseCommission,
    openCases: input.cases.filter((item) => !CLOSED.has(item.status)).length,
    overdueCases: input.cases.filter((item) => slaOverdue(item.deadline, item.status, input.today)).length,
    stageCounts,
    incomeMatchesCollected: monthIncome === collectedNet,
  };
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

export async function loadShemeshBooks(month = "2026-10"): Promise<ShemeshBooks> {
  const emptyCounts = Object.fromEntries(CASE_STAGES.map((stage) => [stage.id, 0])) as Record<CaseStageId, number>;
  const empty: ShemeshBooks = {
    missing: true,
    month,
    collectedNet: 0,
    openRedemptionGross: 0,
    openRedemptionNet: 0,
    waitingTaxNet: 0,
    monthIncome: 0,
    monthCost: 0,
    monthPayroll: 0,
    monthCommission: 0,
    monthDebt: 0,
    operatingResult: 0,
    licenseCommission: 0,
    openCases: 0,
    overdueCases: 0,
    stageCounts: emptyCounts,
    incomeMatchesCollected: false,
  };
  try {
    const admin = shemeshAdmin();
    const [cases, ledger, rules, insurer] = await Promise.all([
      admin.from("shemesh_cases").select("status, stage, deadline").limit(500),
      admin.from("shemesh_ledger").select("kind, status, gross, fee, net").limit(500),
      admin.from("shemesh_rules").select("id, kind, title, amount, cadence, starts_on, active").limit(500),
      admin.from("shemesh_insurer_rows").select("commission").limit(500),
    ]);
    const firstError = cases.error || ledger.error || rules.error;
    if (firstError) return empty;
    const caseRows = (cases.data ?? []) as Record<string, unknown>[];
    const ledgerRows = (ledger.data ?? []) as Record<string, unknown>[];
    const ruleRows = (rules.data ?? []) as Record<string, unknown>[];
    if (!caseRows.length && !ledgerRows.length && !ruleRows.length) return empty;
    const commissions = insurer.error ? [] : ((insurer.data ?? []) as Record<string, unknown>[]);
    return summarizeShemeshBooks({
      month,
      today: new Date().toISOString().slice(0, 10),
      licenseCommission: sum(commissions.map((row) => num(row.commission))),
      cases: caseRows.map((row) => ({ status: text(row.status), stage: text(row.stage), deadline: text(row.deadline) || null })),
      ledger: ledgerRows.map((row) => ({
        kind: text(row.kind),
        status: text(row.status),
        gross: num(row.gross),
        fee: num(row.fee),
        net: num(row.net),
      })),
      rules: ruleRows.map((row) => ({
        id: text(row.id),
        kind: text(row.kind),
        title: text(row.title),
        amount: num(row.amount),
        cadence: text(row.cadence) || "monthly",
        startsOn: text(row.starts_on) || null,
        active: Boolean(row.active),
      })),
    });
  } catch {
    return empty;
  }
}

function assertOctoberStory(): void {
  const books = summarizeShemeshBooks({
    month: "2026-10",
    today: "2026-10-29",
    licenseCommission: 900,
    cases: [
      { status: "open", stage: "documents", deadline: "2026-10-08" },
      { status: "waiting", stage: "filed", deadline: "2026-11-10" },
      { status: "done", stage: "collected", deadline: "2026-09-20" },
      { status: "open", stage: "lead", deadline: "2026-11-04" },
    ],
    ledger: [
      { kind: "redemption", status: "open", gross: 10000, fee: 1500, net: 8500 },
      { kind: "tax_refund", status: "waiting", gross: 6000, fee: 600, net: 5400 },
      { kind: "tax_refund", status: "done", gross: 4000, fee: 400, net: 3600 },
    ],
    rules: [
      { id: "rent", kind: "cost", title: "שכירות", amount: 8000, cadence: "monthly", startsOn: "2026-01-01", active: true },
      { id: "soft", kind: "cost", title: "תוכנה", amount: 450, cadence: "monthly", startsOn: "2026-01-01", active: true },
      { id: "income", kind: "income", title: "החזרי מס שנגבו", amount: 3600, cadence: "monthly", startsOn: "2026-01-01", active: true },
      { id: "pay", kind: "payroll", title: "שכר", amount: 9000, cadence: "monthly", startsOn: "2026-01-01", active: true },
      { id: "fee", kind: "commission", title: "עמלת מטפל", amount: 1800, cadence: "monthly", startsOn: "2026-01-01", active: true },
      { id: "debt", kind: "debt", title: "הלוואה", amount: 2500, cadence: "monthly", startsOn: "2026-01-01", active: true },
    ],
  });
  if (books.collectedNet !== 3600 || books.monthIncome !== 3600 || !books.incomeMatchesCollected) {
    throw new Error("collected net must match the income rule and stay out of the license commission");
  }
  if (books.collectedNet === 3600 + books.licenseCommission) throw new Error("license commission leaked into collected");
  if (books.openRedemptionGross !== 10000 || books.waitingTaxNet !== 5400) throw new Error("open ledger drifted");
  if (books.licenseCommission !== 900 || books.overdueCases !== 1 || books.openCases !== 3) throw new Error("case story drifted");
  if (books.monthCost !== 8450 || books.operatingResult !== 3600 - 8450 - 9000 - 1800) throw new Error("month result drifted");
}

assertOctoberStory();
