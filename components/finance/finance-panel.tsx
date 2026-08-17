"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getFinancePlReport,
  listFinanceEntries,
  updateFinanceEntry,
  uploadFinanceAttachment,
} from "@/app/actions/finance";
import {
  COMMISSION_TYPES,
  COMMISSION_TYPE_LABELS,
  FINANCE_KIND_LABELS,
  FINANCE_PORTAL_OPTIONS,
  categoriesForKind,
  formatIls,
  formatPayrollMonthHe,
  getFinanceCategoryLabel,
  getPortalFinanceLabel,
  isFinanceOk,
  isPayrollMonth,
  isSalaryCategory,
  currentPayrollMonth,
  payrollMonthToDate,
  toPayrollMonth,
  INCOME_SUMMARY_BUCKETS,
  EXPENSE_SUMMARY_BUCKETS,
  entryMatchesBucket,
  sumBucket,
  type CommissionType,
  type FinanceEmployee,
  type FinanceEntry,
  type FinanceKind,
  type FinanceSupplier,
  type PlReport,
} from "@/lib/finance/categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickAddEmployee, SuppliersSection } from "@/components/finance/finance-people";

type TabId = "overview" | "income" | "expense" | "payroll" | "suppliers" | "pl";

type Props = {
  initialEntries: FinanceEntry[];
  initialEmployees: FinanceEmployee[];
  initialSuppliers: FinanceSupplier[];
  initialFrom: string;
  initialTo: string;
  listError?: string | null;
};

type FormState = {
  kind: FinanceKind;
  category: string;
  amount: string;
  occurred_at: string;
  portal_slug: string;
  commission_type: CommissionType | "";
  description: string;
  reference_number: string;
  vat_included: boolean;
  notes: string;
  employee_id: string;
  supplier_id: string;
  payroll_month: string;
};

const INCOME_KINDS: FinanceKind[] = ["income", "income_adjustment"];
const EXPENSE_KINDS: FinanceKind[] = ["expense"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(
  defaultKind: FinanceKind = "income",
  salaryOnly = false,
): FormState {
  const cats = categoriesForKind(defaultKind).filter((c) => {
    if (defaultKind !== "expense") return true;
    return salaryOnly ? isSalaryCategory(c.id) : !isSalaryCategory(c.id);
  });
  return {
    kind: defaultKind,
    category:
      cats[0]?.id ??
      (salaryOnly
        ? "salary_gross"
        : defaultKind === "expense"
          ? "expense_other"
          : "commission_portal"),
    amount: "",
    occurred_at: todayIso(),
    portal_slug: "",
    commission_type: defaultKind === "income" ? "service" : "",
    description: "",
    reference_number: "",
    vat_included: true,
    notes: "",
    employee_id: "",
    supplier_id: "",
    payroll_month: currentPayrollMonth(),
  };
}

function formFromEntry(entry: FinanceEntry): FormState {
  return {
    kind: entry.kind,
    category: entry.category,
    amount: String(entry.amount),
    occurred_at: entry.occurred_at,
    portal_slug: entry.portal_slug ?? "",
    commission_type: entry.commission_type ?? "",
    description: entry.description ?? "",
    reference_number: entry.reference_number ?? "",
    vat_included: entry.vat_included,
    notes: entry.notes ?? "",
    employee_id: entry.employee_id ?? "",
    supplier_id: entry.supplier_id ?? "",
    payroll_month:
      entry.payroll_month ?? toPayrollMonth(entry.occurred_at),
  };
}

function matchesTab(entry: FinanceEntry, tab: TabId): boolean {
  if (tab === "income") return INCOME_KINDS.includes(entry.kind);
  if (tab === "expense") {
    return EXPENSE_KINDS.includes(entry.kind) && !isSalaryCategory(entry.category);
  }
  if (tab === "payroll") {
    return EXPENSE_KINDS.includes(entry.kind) && isSalaryCategory(entry.category);
  }
  return false;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "סקירה כללית" },
  { id: "income", label: "הכנסות" },
  { id: "expense", label: "הוצאות" },
  { id: "payroll", label: "משכורות עובדים" },
  { id: "suppliers", label: "ספקים" },
  { id: "pl", label: "רווח והפסד" },
];

export function FinancePanel({
  initialEntries,
  initialEmployees,
  initialSuppliers,
  initialFrom,
  initialTo,
  listError,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [entries, setEntries] = useState(initialEntries);
  const [employees, setEmployees] = useState(initialEmployees);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<PlReport | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const buckets =
      tab === "income"
        ? INCOME_SUMMARY_BUCKETS
        : tab === "expense"
          ? EXPENSE_SUMMARY_BUCKETS.filter((b) => b.id !== "payroll")
          : [];
    const activeBucket = buckets.find((b) => b.id === bucketFilter) ?? null;
    return entries.filter((e) => {
      if (tab !== "pl" && tab !== "overview" && !matchesTab(e, tab)) return false;
      if (activeBucket && !entryMatchesBucket(e, activeBucket)) return false;
      if (companyFilter && e.portal_slug !== companyFilter) return false;
      if (employeeFilter && e.employee_id !== employeeFilter) return false;
      if (!q) return true;
      const hay = [
        e.description ?? "",
        e.reference_number ?? "",
        e.notes ?? "",
        getFinanceCategoryLabel(e.category),
        getPortalFinanceLabel(e.portal_slug),
        FINANCE_KIND_LABELS[e.kind],
        employees.find((emp) => emp.id === e.employee_id)?.full_name ?? "",
        e.payroll_month ? formatPayrollMonthHe(e.payroll_month) : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query, tab, bucketFilter, companyFilter, employeeFilter, employees]);

  const overview = useMemo(() => {
    let income = 0;
    let adj = 0;
    let expense = 0;
    let incomeCount = 0;
    let adjCount = 0;
    let expenseCount = 0;
    const portalMap = new Map<string, number>();
    const expenseGroupMap = new Map<string, number>();

    for (const e of entries) {
      if (e.kind === "income") {
        income += e.amount;
        incomeCount += 1;
        const key = e.portal_slug ?? "_none";
        portalMap.set(key, (portalMap.get(key) ?? 0) + e.amount);
      } else if (e.kind === "income_adjustment") {
        adj += e.amount;
        adjCount += 1;
      } else if (e.kind === "expense") {
        expense += e.amount;
        expenseCount += 1;
        const group =
          categoriesForKind("expense").find((c) => c.id === e.category)
            ?.group ?? "אחר";
        expenseGroupMap.set(group, (expenseGroupMap.get(group) ?? 0) + e.amount);
      }
    }

    const topPortals = Array.from(portalMap.entries())
      .map(([slug, amount]) => ({
        slug,
        label: slug === "_none" ? "ללא חברת ביטוח" : getPortalFinanceLabel(slug),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const topExpenseGroups = Array.from(expenseGroupMap.entries())
      .map(([group, amount]) => ({ group, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const recent = [...entries]
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 6);

    const netIncome = income - adj;
    const profit = netIncome - expense;

    return {
      income,
      adj,
      expense,
      netIncome,
      profit,
      incomeCount,
      adjCount,
      expenseCount,
      topPortals,
      topExpenseGroups,
      recent,
    };
  }, [entries]);

  function refreshRange() {
    startTransition(async () => {
      const result = await listFinanceEntries({ from, to });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEntries(result.entries);
      router.refresh();
    });
  }

  function loadPl() {
    startTransition(async () => {
      const pl = await getFinancePlReport({ from, to });
      if (pl.error || !pl.report) {
        toast.error(pl.error ?? "טעינת הדוח נכשלה");
        return;
      }
      setReport(pl.report);
    });
  }

  const createDefaultKind: FinanceKind =
    tab === "expense" || tab === "payroll" ? "expense" : "income";

  return (
    <div className="space-y-4">
      {listError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {listError}
        </div>
      ) : null}

      {tab !== "suppliers" ? (
      <div className="app-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">מתאריך</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-40 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">עד תאריך</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-40 rounded-xl"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={pending}
              onClick={() => {
                refreshRange();
                if (tab === "pl") loadPl();
              }}
            >
              החל טווח
            </Button>
          </div>
          {tab === "income" || tab === "expense" || tab === "payroll" ? (
            <EntryDialog
              mode="create"
              defaultKind={createDefaultKind}
              salaryOnly={tab === "payroll"}
              allowedKinds={
                tab === "income" ? INCOME_KINDS : EXPENSE_KINDS
              }
              employees={employees}
              suppliers={suppliers}
              disabled={pending}
              onEmployeeCreated={(row) => {
                setEmployees((prev) => [
                  row,
                  ...prev.filter((e) => e.id !== row.id),
                ]);
              }}
              onSaved={(entry) => {
                setEntries((prev) => [
                  entry,
                  ...prev.filter((e) => e.id !== entry.id),
                ]);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-black/[0.08] pb-px">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setQuery("");
              setBucketFilter(null);
              setCompanyFilter(null);
              setEmployeeFilter(null);
              if (item.id === "pl") loadPl();
            }}
            className={cn(
              "relative px-3 py-2 text-sm transition-colors",
              tab === item.id
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {tab === item.id && (
              <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-highlight" />
            )}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewSection
          from={from}
          to={to}
          data={overview}
          onGoIncome={() => setTab("income")}
          onGoExpense={() => setTab("expense")}
          onGoPl={() => {
            setTab("pl");
            loadPl();
          }}
        />
      ) : null}

      {tab === "income" || tab === "expense" || tab === "payroll" ? (
        <div className="space-y-3">
          {tab === "income" || tab === "expense" ? (
            <TabSummaryCubes
              tab={tab}
              entries={entries}
              selected={bucketFilter}
              onSelect={(id) =>
                setBucketFilter((current) => (current === id ? null : id))
              }
            />
          ) : null}
          {tab === "income" ? (
            <InsurerSummaryCubes
              entries={entries}
              selected={companyFilter}
              onSelect={(slug) =>
                setCompanyFilter((current) => (current === slug ? null : slug))
              }
            />
          ) : null}
          {tab === "payroll" ? (
            <PayrollEmployeeCubes
              entries={entries}
              employees={employees}
              selected={employeeFilter}
              onSelect={(id) =>
                setEmployeeFilter((current) => (current === id ? null : id))
              }
            />
          ) : null}
          <div className="app-surface p-4">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "income"
                    ? "חיפוש הכנסות לפי תיאור, חברת ביטוח או אסמכתא…"
                    : tab === "payroll"
                      ? "חיפוש משכורות לפי עובד, חודש או אסמכתא…"
                      : "חיפוש הוצאות לפי תיאור, סעיף או אסמכתא…"
                }
                className="h-10 rounded-xl ps-10"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={
                tab === "income"
                  ? "אין הכנסות בטווח"
                  : tab === "payroll"
                    ? "אין משכורות בטווח"
                    : "אין הוצאות בטווח"
              }
              body={
                tab === "income"
                  ? "הוסיפו עמלות ושייכו לחברת ביטוח — מגדל, פניקס, כלל וכו׳."
                  : tab === "payroll"
                    ? "הוסיפו משכורת עם שיוך לעובד ולחודש. רשימת העובדים נמצאת בקטגוריית עובדים."
                    : "הוסיפו הוצאות משרד — שכירות, אינטרנט, שיווק וספקים."
              }
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  pending={pending}
                  salaryOnly={tab === "payroll"}
                  allowedKinds={
                    tab === "income" ? INCOME_KINDS : EXPENSE_KINDS
                  }
                  employees={employees}
                  suppliers={suppliers}
                  onEmployeeCreated={(row) => {
                    setEmployees((prev) => [
                      row,
                      ...prev.filter((e) => e.id !== row.id),
                    ]);
                  }}
                  onUpdated={(next) => {
                    setEntries((prev) =>
                      prev.map((e) => (e.id === next.id ? next : e)),
                    );
                    router.refresh();
                  }}
                  onDeleted={(id) => {
                    setEntries((prev) => prev.filter((e) => e.id !== id));
                    router.refresh();
                  }}
                  startTransition={startTransition}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "suppliers" ? (
        <SuppliersSection suppliers={suppliers} onChanged={setSuppliers} />
      ) : null}

      {tab === "pl" ? (
        <PlSection report={report} pending={pending} onRefresh={loadPl} />
      ) : null}
    </div>
  );
}

function OverviewSection({
  from,
  to,
  data,
  onGoIncome,
  onGoExpense,
  onGoPl,
}: {
  from: string;
  to: string;
  data: {
    income: number;
    adj: number;
    expense: number;
    netIncome: number;
    profit: number;
    incomeCount: number;
    adjCount: number;
    expenseCount: number;
    topPortals: { slug: string; label: string; amount: number }[];
    topExpenseGroups: { group: string; amount: number }[];
    recent: FinanceEntry[];
  };
  onGoIncome: () => void;
  onGoExpense: () => void;
  onGoPl: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          סקירה לטווח <span className="font-medium text-foreground">{from}</span>{" "}
          – <span className="font-medium text-foreground">{to}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={onGoIncome}
          >
            להכנסות
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={onGoExpense}
          >
            להוצאות
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            onClick={onGoPl}
          >
            לדוח רוו״ה
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="הכנסות ברוטו"
          value={formatIls(data.income)}
          hint={`${data.incomeCount} רשומות`}
          tone="income"
        />
        <MetricCard
          label="ביטולים / קיזוזים"
          value={formatIls(data.adj)}
          hint={`${data.adjCount} רשומות`}
          tone="warn"
        />
        <MetricCard
          label="הוצאות"
          value={formatIls(data.expense)}
          hint={`${data.expenseCount} רשומות`}
          tone="expense"
        />
        <MetricCard
          label="רווח תפעולי"
          value={formatIls(data.profit)}
          hint={`הכנסה נטו ${formatIls(data.netIncome)}`}
          tone={data.profit >= 0 ? "income" : "expense"}
          emphasize
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="app-surface border-2 border-black p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">הכנסות לפי חברת ביטוח</h3>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={onGoIncome}
            >
              הכל
            </button>
          </div>
          {data.topPortals.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין הכנסות בטווח.</p>
          ) : (
            <ul className="space-y-2">
              {data.topPortals.map((p) => (
                <li
                  key={p.slug}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{p.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-emerald-700">
                    {formatIls(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="app-surface border-2 border-black p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">הוצאות לפי קבוצה</h3>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={onGoExpense}
            >
              הכל
            </button>
          </div>
          {data.topExpenseGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין הוצאות בטווח.</p>
          ) : (
            <ul className="space-y-2">
              {data.topExpenseGroups.map((g) => (
                <li
                  key={g.group}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate">{g.group}</span>
                  <span className="shrink-0 font-medium tabular-nums text-red-700">
                    {formatIls(g.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="app-surface border-2 border-black p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">רשומות אחרונות</h3>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            עדיין אין רשומות בטווח — התחילו מהכנסות או הוצאות.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {data.recent.map((e) => {
              const positive = e.kind === "income";
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {getFinanceCategoryLabel(e.category)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.occurred_at} · {FINANCE_KIND_LABELS[e.kind]}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      positive ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {positive ? "+" : "−"}
                    {formatIls(e.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabSummaryCubes({
  tab,
  entries,
  selected,
  onSelect,
}: {
  tab: "income" | "expense";
  entries: FinanceEntry[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const buckets =
    tab === "income"
      ? INCOME_SUMMARY_BUCKETS
      : EXPENSE_SUMMARY_BUCKETS.filter((b) => b.id !== "payroll");

  const totals = buckets.map((bucket) => ({
    bucket,
    ...sumBucket(entries, bucket),
  }));

  const grossIncome = totals
    .filter((t) => t.bucket.tone === "income")
    .reduce((s, t) => s + t.amount, 0);
  const adjustments = totals
    .filter((t) => t.bucket.id === "adjustments")
    .reduce((s, t) => s + t.amount, 0);
  const expenseTotal = totals.reduce((s, t) => s + t.amount, 0);
  const netIncome = grossIncome - adjustments;

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        tab === "income" ? "lg:grid-cols-5" : "lg:grid-cols-3",
      )}
    >
      {totals.map(({ bucket, amount, count }) => (
        <button
          key={bucket.id}
          type="button"
          onClick={() => onSelect(bucket.id)}
          className="text-start"
        >
          <MetricCard
            label={bucket.label}
            value={formatIls(amount)}
            hint={`${bucket.hint} · ${count} רשומות`}
            tone={bucket.tone}
            emphasize={selected === bucket.id}
          />
        </button>
      ))}
      {tab === "income" ? (
        <MetricCard
          label="הכנסה נטו"
          value={formatIls(netIncome)}
          hint="עמלות פחות ביטולים"
          tone={netIncome >= 0 ? "income" : "expense"}
          emphasize
        />
      ) : (
        <MetricCard
          label="סה״כ הוצאות"
          value={formatIls(expenseTotal)}
          hint="קבועות + משתנות"
          tone="expense"
          emphasize
        />
      )}
    </div>
  );
}

function InsurerSummaryCubes({
  entries,
  selected,
  onSelect,
}: {
  entries: FinanceEntry[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const totals = FINANCE_PORTAL_OPTIONS.map((company) => {
    let income = 0;
    let adjustments = 0;
    let count = 0;
    for (const e of entries) {
      if (e.portal_slug !== company.slug) continue;
      if (e.kind === "income") {
        income += e.amount;
        count += 1;
      } else if (e.kind === "income_adjustment") {
        adjustments += e.amount;
        count += 1;
      }
    }
    return {
      slug: company.slug,
      label: company.label,
      income,
      adjustments,
      net: income - adjustments,
      count,
    };
  });

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">לפי חברת ביטוח</p>
      <p className="text-[11px] text-muted-foreground">
        לחיצה על חברה מסננת את הרשימה. הפורטלים הם חברות הביטוח.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {totals.map((row) => (
          <button
            key={row.slug}
            type="button"
            onClick={() => onSelect(row.slug)}
            className="text-start"
          >
            <MetricCard
              label={row.label}
              value={formatIls(row.net)}
              hint={
                row.adjustments > 0
                  ? `נכנס ${formatIls(row.income)} · קיזוז ${formatIls(row.adjustments)}`
                  : `${row.count} רשומות`
              }
              tone={row.net >= 0 ? "income" : "expense"}
              emphasize={selected === row.slug}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function PayrollEmployeeCubes({
  entries,
  employees,
  selected,
  onSelect,
}: {
  entries: FinanceEntry[];
  employees: FinanceEmployee[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const totals = employees
    .filter((emp) => emp.is_active)
    .map((emp) => {
      let amount = 0;
      let count = 0;
      for (const e of entries) {
        if (e.kind !== "expense" || !isSalaryCategory(e.category)) continue;
        if (e.employee_id !== emp.id) continue;
        amount += e.amount;
        count += 1;
      }
      return { id: emp.id, label: emp.full_name, amount, count };
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">לפי עובד</p>
          <p className="text-[11px] text-muted-foreground">
            לחיצה על עובד מסננת את רשימת המשכורות.
          </p>
        </div>
        <Link
          href="/employees"
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          לרשימת עובדים
        </Link>
      </div>
      {totals.length === 0 ? (
        <p className="app-surface px-4 py-6 text-center text-sm text-muted-foreground">
          אין עובדים ברשימה. הוסיפו עובדים בקטגוריית עובדים, או מהטופס כאן.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {totals.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className="text-start"
            >
              <MetricCard
                label={row.label}
                value={formatIls(row.amount)}
                hint={`${row.count} רשומות`}
                tone="expense"
                emphasize={selected === row.id}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "income" | "expense" | "warn";
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "app-surface px-4 py-4",
        emphasize ? "border-2 border-black" : "border border-black/[0.08]",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          tone === "income" && "text-emerald-700",
          tone === "expense" && "text-red-700",
          tone === "warn" && "text-amber-800",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="app-surface px-5 py-14 text-center">
      <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-highlight/30">
        <Wallet className="size-5" />
      </span>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function EntryCard({
  entry,
  pending,
  allowedKinds,
  salaryOnly,
  employees,
  suppliers,
  onEmployeeCreated,
  onUpdated,
  onDeleted,
  startTransition,
}: {
  entry: FinanceEntry;
  pending: boolean;
  allowedKinds: FinanceKind[];
  salaryOnly?: boolean;
  employees: FinanceEmployee[];
  suppliers: FinanceSupplier[];
  onEmployeeCreated: (row: FinanceEmployee) => void;
  onUpdated: (e: FinanceEntry) => void;
  onDeleted: (id: string) => void;
  startTransition: (fn: () => void) => void;
}) {
  function onDelete() {
    const ok = window.confirm("למחוק את הרשומה לצמיתות?");
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteFinanceEntry(entry.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("נמחק");
      onDeleted(entry.id);
    });
  }

  const amountClass =
    entry.kind === "income"
      ? "text-emerald-700"
      : "text-red-700";

  const employeeName = employees.find((e) => e.id === entry.employee_id)
    ?.full_name;
  const supplier = suppliers.find((s) => s.id === entry.supplier_id);
  const salaryLabel =
    isSalaryCategory(entry.category) && entry.payroll_month
      ? formatPayrollMonthHe(entry.payroll_month)
      : null;

  return (
    <article className="app-surface overflow-hidden border-2 border-black">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              {getFinanceCategoryLabel(entry.category)}
            </h3>
            <span className="rounded-md bg-highlight/35 px-2 py-0.5 text-[11px] font-medium">
              {FINANCE_KIND_LABELS[entry.kind]}
            </span>
            {entry.portal_slug ? (
              <span className="rounded-md bg-background px-2 py-0.5 text-[11px]">
                {getPortalFinanceLabel(entry.portal_slug)}
              </span>
            ) : null}
            {employeeName ? (
              <span className="rounded-md bg-background px-2 py-0.5 text-[11px]">
                {employeeName}
              </span>
            ) : null}
            {supplier ? (
              <span className="rounded-md bg-background px-2 py-0.5 text-[11px]">
                {supplier.category
                  ? `${supplier.name} · ${supplier.category}`
                  : supplier.name}
              </span>
            ) : null}
            {salaryLabel ? (
              <span className="rounded-md bg-background px-2 py-0.5 text-[11px]">
                {salaryLabel}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {salaryLabel ?? entry.occurred_at}
            {entry.description ? ` · ${entry.description}` : ""}
            {entry.reference_number ? ` · אסמכתא ${entry.reference_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className={cn("text-base font-semibold tabular-nums", amountClass)}>
            {entry.kind === "income" ? "+" : "−"}
            {formatIls(entry.amount)}
          </p>
          <EntryDialog
            mode="edit"
            entry={entry}
            defaultKind={entry.kind}
            salaryOnly={salaryOnly}
            allowedKinds={allowedKinds}
            employees={employees}
            suppliers={suppliers}
            disabled={pending}
            onEmployeeCreated={onEmployeeCreated}
            onSaved={onUpdated}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-lg text-red-700 hover:bg-red-50"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            מחיקה
          </Button>
        </div>
      </div>
    </article>
  );
}

function EntryDialog({
  mode,
  entry,
  defaultKind,
  allowedKinds,
  salaryOnly = false,
  employees,
  suppliers,
  disabled,
  onEmployeeCreated,
  onSaved,
}: {
  mode: "create" | "edit";
  entry?: FinanceEntry;
  defaultKind: FinanceKind;
  allowedKinds: FinanceKind[];
  salaryOnly?: boolean;
  employees: FinanceEmployee[];
  suppliers: FinanceSupplier[];
  disabled?: boolean;
  onEmployeeCreated?: (row: FinanceEmployee) => void;
  onSaved: (entry: FinanceEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() =>
    entry ? formFromEntry(entry) : emptyForm(defaultKind, salaryOnly),
  );
  const [file, setFile] = useState<File | null>(null);

  const categoryOptions = categoriesForKind(form.kind).filter((c) => {
    if (form.kind !== "expense") return true;
    return salaryOnly ? isSalaryCategory(c.id) : !isSalaryCategory(c.id);
  });
  const salaryMode =
    form.kind === "expense" && isSalaryCategory(form.category);

  function resetForOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(entry ? formFromEntry(entry) : emptyForm(defaultKind, salaryOnly));
      setFile(null);
    }
  }

  function onKindChange(kind: FinanceKind) {
    const cats = categoriesForKind(kind);
    setForm((f) => ({
      ...f,
      kind,
      category: cats[0]?.id ?? f.category,
      commission_type: kind === "income" ? f.commission_type || "service" : "",
      portal_slug:
        kind === "income" || kind === "income_adjustment" ? f.portal_slug : "",
      payroll_month: f.payroll_month || currentPayrollMonth(),
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const isSalary = form.kind === "expense" && isSalaryCategory(form.category);
      if (isSalary) {
        if (!form.employee_id) {
          toast.error("חובה לשייך את המשכורת לעובד");
          return;
        }
        if (!isPayrollMonth(form.payroll_month)) {
          toast.error("חובה לבחור חודש משכורת");
          return;
        }
      }

      const occurredAt = isSalary
        ? payrollMonthToDate(form.payroll_month)
        : form.occurred_at;

      const payload = {
        kind: form.kind,
        category: form.category,
        amount: form.amount,
        occurred_at: occurredAt,
        portal_slug: form.portal_slug || undefined,
        commission_type: form.commission_type || undefined,
        description: form.description,
        reference_number: form.reference_number,
        vat_included: form.vat_included,
        notes: form.notes,
        employee_id: isSalary ? form.employee_id : undefined,
        supplier_id: isSalary ? undefined : form.supplier_id || undefined,
        payroll_month: isSalary ? form.payroll_month : undefined,
      };

      if (
        (form.kind === "income" || form.kind === "income_adjustment") &&
        !form.portal_slug
      ) {
        toast.error("חובה לבחור חברת ביטוח");
        return;
      }

      if (mode === "create") {
        const result = await createFinanceEntry(payload);
        if (!isFinanceOk(result)) {
          toast.error(result.error);
          return;
        }
        const newId = result.id;
        if (file) {
          const fd = new FormData();
          fd.set("file", file);
          fd.set("entry_id", newId);
          const up = await uploadFinanceAttachment(fd);
          if (up.error) toast.error(up.error);
        }
        toast.success("נשמר");
        onSaved({
          id: newId,
          kind: form.kind,
          category: form.category,
          amount: Number(form.amount),
          currency: "ILS",
          occurred_at: occurredAt,
          portal_slug: form.portal_slug || null,
          commission_type:
            form.kind === "income" && form.commission_type
              ? form.commission_type
              : null,
          description: form.description.trim() || null,
          reference_number: form.reference_number.trim() || null,
          vat_included: form.vat_included,
          notes: form.notes.trim() || null,
          employee_id: isSalary ? form.employee_id : form.employee_id || null,
          supplier_id: isSalary ? null : form.supplier_id || null,
          payroll_month: isSalary ? form.payroll_month : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setOpen(false);
        return;
      }

      const result = await updateFinanceEntry({ id: entry!.id, ...payload });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("entry_id", entry!.id);
        const up = await uploadFinanceAttachment(fd);
        if (up.error) toast.error(up.error);
      }
      toast.success("עודכן");
      onSaved({
        ...entry!,
        kind: form.kind,
        category: form.category,
        amount: Number(form.amount),
        occurred_at: occurredAt,
        portal_slug: form.portal_slug || null,
        commission_type:
          form.kind === "income" && form.commission_type
            ? form.commission_type
            : null,
        description: form.description.trim() || null,
        reference_number: form.reference_number.trim() || null,
        vat_included: form.vat_included,
        notes: form.notes.trim() || null,
        employee_id: isSalary ? form.employee_id : form.employee_id || null,
        supplier_id: isSalary ? null : form.supplier_id || null,
        payroll_month: isSalary ? form.payroll_month : null,
        updated_at: new Date().toISOString(),
      });
      setOpen(false);
    });
  }

  const createLabel = salaryOnly
    ? "הוספת משכורת"
    : defaultKind === "expense"
      ? "הוספת הוצאה"
      : "הוספת הכנסה";

  return (
    <Dialog open={open} onOpenChange={resetForOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button
            type="button"
            className="h-10 shrink-0 gap-2 rounded-xl"
            disabled={disabled}
          >
            <Plus className="size-4" />
            {createLabel}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-lg"
            disabled={disabled}
          >
            <Pencil className="size-3.5" />
            עריכה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl text-start sm:max-w-lg"
        dir="rtl"
      >
        <DialogHeader className="space-y-1.5 text-start sm:text-start">
          <DialogTitle>
            {mode === "create"
              ? salaryOnly
                ? "משכורת חדשה"
                : defaultKind === "expense"
                  ? "הוצאה חדשה"
                  : "הכנסה חדשה"
              : "עריכה"}
          </DialogTitle>
          <DialogDescription>
            {salaryOnly
              ? "חובה לשייך לעובד ולחודש משכורת. אפשר להוסיף עובד חדש מהטופס."
              : "הזנה ידנית בשקלים. אפשר לצרף חשבונית או אישור."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 text-start" dir="rtl">
          {allowedKinds.length > 1 ? (
            <div className="space-y-1.5">
              <Label className="block text-start">סוג</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => onKindChange(v as FinanceKind)}
              >
                <SelectTrigger className="rounded-xl text-start" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {allowedKinds.map((k) => (
                    <SelectItem key={k} value={k}>
                      {FINANCE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {salaryMode ? (
              <div className="space-y-1.5">
                <Label className="block text-start">חודש משכורת</Label>
                <Input
                  type="month"
                  required
                  value={form.payroll_month}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payroll_month: e.target.value }))
                  }
                  className="rounded-xl text-start"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="block text-start">תאריך</Label>
                <Input
                  type="date"
                  required
                  value={form.occurred_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, occurred_at: e.target.value }))
                  }
                  className="rounded-xl text-start"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="block text-start">סכום (₪)</Label>
              <Input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="rounded-xl text-start"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="block text-start">סעיף</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  category: v,
                  payroll_month:
                    isSalaryCategory(v) && !f.payroll_month
                      ? currentPayrollMonth()
                      : f.payroll_month,
                }))
              }
            >
              <SelectTrigger className="rounded-xl text-start" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.group} — {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.vat_included}
              onChange={(e) =>
                setForm((f) => ({ ...f, vat_included: e.target.checked }))
              }
            />
            כולל מע״מ
          </label>

          {salaryMode ? (
            <div className="space-y-2">
              <Label className="block text-start">עובד</Label>
              <Select
                value={form.employee_id || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    employee_id: v,
                  }))
                }
              >
                <SelectTrigger className="rounded-xl text-start" dir="rtl">
                  <SelectValue placeholder="בחרו עובד" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {employees
                    .filter((e) => e.is_active || e.id === form.employee_id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <QuickAddEmployee
                disabled={pending}
                onCreated={(row) => {
                  onEmployeeCreated?.(row);
                  setForm((f) => ({ ...f, employee_id: row.id }));
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                משכורת חייבת להיות משויכת לעובד ולחודש. אפשר להוסיף עובד חדש כאן.
              </p>
            </div>
          ) : null}

          {form.kind === "expense" && !salaryMode ? (
            <div className="space-y-1.5">
              <Label className="block text-start">ספק</Label>
              <Select
                value={form.supplier_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    supplier_id: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className="rounded-xl text-start" dir="rtl">
                  <SelectValue placeholder="ללא" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">ללא</SelectItem>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.category ? `${s.name} · ${s.category}` : s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {form.kind === "income" || form.kind === "income_adjustment" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="block text-start">חברת ביטוח</Label>
                <Select
                  value={form.portal_slug || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      portal_slug: v,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl text-start" dir="rtl">
                    <SelectValue placeholder="בחרו חברה" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {FINANCE_PORTAL_OPTIONS.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.kind === "income" ? (
                <div className="space-y-1.5">
                  <Label className="block text-start">סוג עמלה</Label>
                  <Select
                    value={form.commission_type || "service"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        commission_type: v as CommissionType,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-xl text-start" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {COMMISSION_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {COMMISSION_TYPE_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="block text-start">תיאור</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="rounded-xl text-start"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="block text-start">מספר אסמכתא</Label>
            <Input
              value={form.reference_number}
              onChange={(e) =>
                setForm((f) => ({ ...f, reference_number: e.target.value }))
              }
              className="rounded-xl text-start"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="block text-start">הערות</Label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="rounded-xl text-start"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="block text-start">צירוף מסמך</Label>
            <Input
              type="file"
              className="rounded-xl text-start file:me-3"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" className="rounded-xl" disabled={pending}>
              {pending ? "שומר…" : mode === "create" ? "הוספה" : "שמירה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlSection({
  report,
  pending,
  onRefresh,
}: {
  report: PlReport | null;
  pending: boolean;
  onRefresh: () => void;
}) {
  if (!report) {
    return (
      <EmptyState
        title="דוח רווח והפסד"
        body="טוענים את הדוח לטווח שנבחר…"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={pending}
          onClick={onRefresh}
        >
          רענון דוח
        </Button>
      </div>

      <div className="app-surface space-y-4 border-2 border-black p-5">
        <h3 className="text-base font-semibold">
          רווח והפסד · {report.from} – {report.to}
        </h3>

        <PlBlock title="הכנסות עמלות" total={report.incomeTotal}>
          {report.incomeByCategory.map((l) => (
            <PlRow key={l.category} label={l.label} amount={l.amount} />
          ))}
          {report.incomeByPortal.length > 0 ? (
            <div className="mt-3 border-t border-black/[0.06] pt-3">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                לפי חברת ביטוח
              </p>
              {report.incomeByPortal.map((p) => (
                <PlRow key={p.portal_slug} label={p.label} amount={p.amount} />
              ))}
            </div>
          ) : null}
        </PlBlock>

        <PlBlock
          title="ביטולים וקיזוזים (−)"
          total={report.adjustmentTotal}
          negative
        >
          {report.adjustmentsByCategory.map((l) => (
            <PlRow key={l.category} label={l.label} amount={l.amount} />
          ))}
        </PlBlock>

        <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5 text-sm font-semibold">
          <span>הכנסה נטו</span>
          <span className="tabular-nums">{formatIls(report.netIncome)}</span>
        </div>

        <PlBlock title="הוצאות" total={report.expenseTotal} negative>
          {report.expensesByGroup.map((g) => (
            <div key={g.group} className="mb-3 last:mb-0">
              <div className="mb-1 flex justify-between text-xs font-medium">
                <span>{g.group}</span>
                <span className="tabular-nums">{formatIls(g.amount)}</span>
              </div>
              {g.lines.map((l) => (
                <PlRow
                  key={l.category}
                  label={l.label}
                  amount={l.amount}
                  muted
                />
              ))}
            </div>
          ))}
        </PlBlock>

        <div className="flex items-center justify-between rounded-xl border-2 border-black px-3 py-3 text-base font-semibold">
          <span>רווח / הפסד תפעולי</span>
          <span
            className={cn(
              "tabular-nums",
              report.operatingProfit >= 0 ? "text-emerald-700" : "text-red-700",
            )}
          >
            {formatIls(report.operatingProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlBlock({
  title,
  total,
  children,
  negative,
}: {
  title: string;
  total: number;
  children: ReactNode;
  negative?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            negative ? "text-red-700" : "",
          )}
        >
          {negative && total > 0 ? "−" : ""}
          {formatIls(total)}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PlRow({
  label,
  amount,
  muted,
}: {
  label: string;
  amount: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 text-sm",
        muted && "ps-3 text-muted-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{formatIls(amount)}</span>
    </div>
  );
}
