import { portals } from "@/lib/portals.config";

export const FINANCE_KINDS = [
  "income",
  "income_adjustment",
  "expense",
  "transfer",
] as const;

export type FinanceKind = (typeof FINANCE_KINDS)[number];

export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = {
  income: "הכנסה",
  income_adjustment: "ביטול / קיזוז",
  expense: "הוצאה",
  transfer: "העברה בנקאית",
};

export const COMMISSION_TYPES = [
  "service",
  "target",
  "volume",
  "office_reimburse",
  "other",
] as const;

export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  service: "עמלת שירות",
  target: "עמלת יעד",
  volume: "עמלת היקף",
  office_reimburse: "החזר הוצאות משרד",
  other: "אחר",
};

export type FinanceCategoryDef = {
  id: string;
  label: string;
  group: string;
  kinds: FinanceKind[];
};

export const FINANCE_CATEGORIES: FinanceCategoryDef[] = [
  // Income
  {
    id: "commission_portal",
    label: "עמלות מפורטל / חברת ביטוח",
    group: "הכנסות",
    kinds: ["income"],
  },
  {
    id: "commission_pension",
    label: "עמלות פנסיה / גמל / השתלמות",
    group: "הכנסות",
    kinds: ["income"],
  },
  {
    id: "commission_other",
    label: "הכנסה אחרת",
    group: "הכנסות",
    kinds: ["income"],
  },

  // Adjustments (reduce net income)
  {
    id: "cancel_policy",
    label: "ביטול פוליסה",
    group: "ביטולים וקיזוזים",
    kinds: ["income_adjustment"],
  },
  {
    id: "commission_clawback",
    label: "קיזוז עמלה",
    group: "ביטולים וקיזוזים",
    kinds: ["income_adjustment"],
  },
  {
    id: "client_refund",
    label: "החזר ללקוח",
    group: "ביטולים וקיזוזים",
    kinds: ["income_adjustment"],
  },
  {
    id: "adjustment_other",
    label: "התאמה שלילית אחרת",
    group: "ביטולים וקיזוזים",
    kinds: ["income_adjustment"],
  },

  // Payroll
  {
    id: "salary_gross",
    label: "משכורות ברוטו",
    group: "שכר",
    kinds: ["expense"],
  },
  {
    id: "salary_social",
    label: "הפרשות סוציאליות",
    group: "שכר",
    kinds: ["expense"],
  },
  {
    id: "salary_bonus",
    label: "בונוסים",
    group: "שכר",
    kinds: ["expense"],
  },

  // Office ops
  {
    id: "rent",
    label: "שכירות",
    group: "תפעול משרד",
    kinds: ["expense"],
  },
  {
    id: "arnona",
    label: "ארנונה",
    group: "תפעול משרד",
    kinds: ["expense"],
  },
  {
    id: "electricity",
    label: "חשמל",
    group: "תפעול משרד",
    kinds: ["expense"],
  },
  {
    id: "water",
    label: "מים",
    group: "תפעול משרד",
    kinds: ["expense"],
  },
  {
    id: "cleaning",
    label: "ניקיון",
    group: "תפעול משרד",
    kinds: ["expense"],
  },

  // Comms & tech
  {
    id: "internet",
    label: "אינטרנט",
    group: "תקשורת וטק",
    kinds: ["expense"],
  },
  {
    id: "telephony",
    label: "טלפוניה",
    group: "תקשורת וטק",
    kinds: ["expense"],
  },
  {
    id: "crm_software",
    label: "CRM / תוכנה",
    group: "תקשורת וטק",
    kinds: ["expense"],
  },
  {
    id: "cloud_hosting",
    label: "אחסון ענן",
    group: "תקשורת וטק",
    kinds: ["expense"],
  },

  // Marketing
  {
    id: "advertising",
    label: "פרסום",
    group: "שיווק ומכירות",
    kinds: ["expense"],
  },
  {
    id: "leads",
    label: "לידים",
    group: "שיווק ומכירות",
    kinds: ["expense"],
  },
  {
    id: "events",
    label: "אירועים",
    group: "שיווק ומכירות",
    kinds: ["expense"],
  },

  // Vehicle
  {
    id: "fuel",
    label: "דלק",
    group: "רכב ונסיעות",
    kinds: ["expense"],
  },
  {
    id: "parking",
    label: "חניה",
    group: "רכב ונסיעות",
    kinds: ["expense"],
  },
  {
    id: "leasing",
    label: "ליסינג",
    group: "רכב ונסיעות",
    kinds: ["expense"],
  },

  // Professional
  {
    id: "accountant",
    label: "רו״ח / הנהלת חשבונות",
    group: "מקצועי ורגולציה",
    kinds: ["expense"],
  },
  {
    id: "legal",
    label: "עו״ד",
    group: "מקצועי ורגולציה",
    kinds: ["expense"],
  },
  {
    id: "licenses",
    label: "אגרות ורישיונות",
    group: "מקצועי ורגולציה",
    kinds: ["expense"],
  },
  {
    id: "professional_insurance",
    label: "ביטוח אחריות מקצועית",
    group: "מקצועי ורגולציה",
    kinds: ["expense"],
  },

  {
    id: "expense_other",
    label: "הוצאה אחרת",
    group: "אחר",
    kinds: ["expense"],
  },

  // Transfers (excluded from P&L)
  {
    id: "bank_transfer",
    label: "העברה בין חשבונות",
    group: "בנק",
    kinds: ["transfer"],
  },
];

export const SALARY_CATEGORIES = [
  "salary_gross",
  "salary_social",
  "salary_bonus",
] as const;

export type SalaryCategory = (typeof SALARY_CATEGORIES)[number];

export function isSalaryCategory(category: string): category is SalaryCategory {
  return (SALARY_CATEGORIES as readonly string[]).includes(category);
}

export type FinanceSummaryBucket = {
  id: string;
  label: string;
  hint: string;
  categories: readonly string[];
  kinds: readonly FinanceKind[];
  tone: "income" | "expense" | "warn";
};

/** Income rollups for an insurance agency. */
export const INCOME_SUMMARY_BUCKETS: FinanceSummaryBucket[] = [
  {
    id: "portal",
    label: "עמלות פורטלים",
    hint: "חברות ביטוח",
    categories: ["commission_portal"],
    kinds: ["income"],
    tone: "income",
  },
  {
    id: "pension",
    label: "פנסיה / גמל",
    hint: "השתלמות וצבירה",
    categories: ["commission_pension"],
    kinds: ["income"],
    tone: "income",
  },
  {
    id: "other_income",
    label: "הכנסות אחרות",
    hint: "יעד, היקף, אחר",
    categories: ["commission_other"],
    kinds: ["income"],
    tone: "income",
  },
  {
    id: "adjustments",
    label: "ביטולים וקיזוזים",
    hint: "מוריד מההכנסה",
    categories: [
      "cancel_policy",
      "commission_clawback",
      "client_refund",
      "adjustment_other",
    ],
    kinds: ["income_adjustment"],
    tone: "warn",
  },
];

/** Expense rollups: payroll vs fixed vs variable — typical agency split. */
export const EXPENSE_SUMMARY_BUCKETS: FinanceSummaryBucket[] = [
  {
    id: "payroll",
    label: "משכורות",
    hint: "ברוטו, סוציאליות, בונוס",
    categories: ["salary_gross", "salary_social", "salary_bonus"],
    kinds: ["expense"],
    tone: "expense",
  },
  {
    id: "fixed",
    label: "הוצאות קבועות",
    hint: "שכירות, ארנונה, אינטרנט, טלפון",
    categories: [
      "rent",
      "arnona",
      "electricity",
      "water",
      "cleaning",
      "internet",
      "telephony",
      "crm_software",
      "cloud_hosting",
      "leasing",
      "accountant",
      "licenses",
      "professional_insurance",
    ],
    kinds: ["expense"],
    tone: "expense",
  },
  {
    id: "variable",
    label: "הוצאות משתנות",
    hint: "שיווק, לידים, רכב, אחר",
    categories: [
      "advertising",
      "leads",
      "events",
      "fuel",
      "parking",
      "legal",
      "expense_other",
    ],
    kinds: ["expense"],
    tone: "expense",
  },
];

export function entryMatchesBucket(
  entry: { kind: FinanceKind; category: string },
  bucket: FinanceSummaryBucket,
): boolean {
  return (
    (bucket.kinds as readonly string[]).includes(entry.kind) &&
    bucket.categories.includes(entry.category)
  );
}

export function sumBucket(
  entries: { kind: FinanceKind; category: string; amount: number }[],
  bucket: FinanceSummaryBucket,
): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const e of entries) {
    if (entryMatchesBucket(e, bucket)) {
      amount += e.amount;
      count += 1;
    }
  }
  return { amount, count };
}

export const FINANCE_PORTAL_OPTIONS = [
  ...portals.map((p) => ({ slug: p.slug, label: p.name })),
  { slug: "other_investment_house", label: "אחר / בית השקעות" },
] as const;

export type FinanceEntry = {
  id: string;
  kind: FinanceKind;
  category: string;
  amount: number;
  currency: string;
  occurred_at: string;
  portal_slug: string | null;
  commission_type: CommissionType | null;
  description: string | null;
  reference_number: string | null;
  vat_included: boolean;
  notes: string | null;
  employee_id: string | null;
  supplier_id: string | null;
  payroll_month: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceEmployee = {
  id: string;
  full_name: string;
  department: string | null;
  short_dial: string | null;
  email: string | null;
  direct_phone: string | null;
  outbound_number: string | null;
  sim_provider: string | null;
  wait_circle: string | null;
  dialer_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type FinanceSupplier = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export const SUPPLIER_CATEGORIES = [
  "תקשורת",
  "שכירות ומשרד",
  "תוכנה / CRM",
  "שיווק",
  "רכב",
  "הנהלת חשבונות",
  "משפטי",
  "ביטוח",
  "אחר",
] as const;

export const SUPPLIER_OTHER_CATEGORY = "אחר";

export function customSupplierCategories(
  suppliers: { category: string | null }[],
): string[] {
  const presets = new Set<string>(SUPPLIER_CATEGORIES);
  const extras = new Set<string>();
  for (const supplier of suppliers) {
    const category = supplier.category?.trim();
    if (category && !presets.has(category)) extras.add(category);
  }
  return Array.from(extras).sort((a, b) => a.localeCompare(b, "he"));
}

export function resolveSupplierCategory(input: {
  category?: string | null;
  customCategory?: string | null;
}): { error: string; category?: undefined } | { error: null; category: string | null } {
  const selected = input.category?.trim() || "";
  if (!selected) return { error: null, category: null };
  if (selected === SUPPLIER_OTHER_CATEGORY) {
    const custom = input.customCategory?.trim() || "";
    if (!custom) return { error: "חובה לרשום קטגוריה במקום «אחר»" };
    if (custom === SUPPLIER_OTHER_CATEGORY) {
      return { error: "רשמו שם קטגוריה ספציפי, לא «אחר»" };
    }
    return { error: null, category: custom };
  }
  return { error: null, category: selected };
}

export type FinanceBankSnapshot = {
  id: string;
  snapshot_date: string;
  balance: number;
  account_label: string;
  notes: string | null;
  created_at: string;
};

export type FinanceAttachment = {
  id: string;
  entry_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type PlLine = {
  category: string;
  label: string;
  group: string;
  amount: number;
};

export type PlReport = {
  from: string;
  to: string;
  incomeTotal: number;
  adjustmentTotal: number;
  netIncome: number;
  expenseTotal: number;
  operatingProfit: number;
  incomeByCategory: PlLine[];
  incomeByPortal: { portal_slug: string; label: string; amount: number }[];
  adjustmentsByCategory: PlLine[];
  expensesByGroup: { group: string; amount: number; lines: PlLine[] }[];
};

export function isFinanceKind(v: string): v is FinanceKind {
  return (FINANCE_KINDS as readonly string[]).includes(v);
}

export function isCommissionType(v: string): v is CommissionType {
  return (COMMISSION_TYPES as readonly string[]).includes(v);
}

export function getFinanceCategory(id: string): FinanceCategoryDef | undefined {
  return FINANCE_CATEGORIES.find((c) => c.id === id);
}

export function getFinanceCategoryLabel(id: string): string {
  return getFinanceCategory(id)?.label ?? id;
}

export function categoriesForKind(kind: FinanceKind): FinanceCategoryDef[] {
  return FINANCE_CATEGORIES.filter((c) => c.kinds.includes(kind));
}

export function getPortalFinanceLabel(slug: string | null): string {
  if (!slug) return "—";
  return (
    FINANCE_PORTAL_OPTIONS.find((p) => p.slug === slug)?.label ?? slug
  );
}

export function isFinancePortalSlug(slug: string): boolean {
  return FINANCE_PORTAL_OPTIONS.some((p) => p.slug === slug);
}

export function isPayrollMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentPayrollMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function toPayrollMonth(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function payrollMonthToDate(month: string): string {
  return `${month}-01`;
}

export function formatPayrollMonthHe(month: string): string {
  if (!isPayrollMonth(month)) return month;
  const [year, monthNum] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNum - 1, 1));
}

export function formatIls(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Local calendar month bounds (YYYY-MM-DD). */
export function monthRange(date = new Date()): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}

export type FinanceMutationResult =
  | { error: null; id: string }
  | { error: string; id?: undefined };

export function isFinanceOk(
  result: FinanceMutationResult,
): result is { error: null; id: string } {
  return result.error === null;
}

/** Signed cash effect for bank reconciliation (transfers ignored in P&L but counted in cash). */
export function cashDeltaForEntry(entry: Pick<FinanceEntry, "kind" | "amount">): number {
  switch (entry.kind) {
    case "income":
      return entry.amount;
    case "income_adjustment":
    case "expense":
      return -entry.amount;
    case "transfer":
      return 0;
  }
}

export function plDeltaForEntry(entry: Pick<FinanceEntry, "kind" | "amount">): {
  income: number;
  adjustment: number;
  expense: number;
} {
  switch (entry.kind) {
    case "income":
      return { income: entry.amount, adjustment: 0, expense: 0 };
    case "income_adjustment":
      return { income: 0, adjustment: entry.amount, expense: 0 };
    case "expense":
      return { income: 0, adjustment: 0, expense: entry.amount };
    case "transfer":
      return { income: 0, adjustment: 0, expense: 0 };
  }
}
