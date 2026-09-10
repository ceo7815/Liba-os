"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { listEmployeeHours } from "@/app/actions/finance-employee-hours";
import { listFinanceEmployees } from "@/app/actions/finance-people";
import {
  EmployeeCardDialog,
  employmentKindLabel,
} from "@/components/employees/employee-card-dialog";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { Input } from "@/components/ui/input";
import { type EmploymentKind, type SalaryKind } from "@/lib/employees/contract";
import { groupHoursByEmployeeId, groupVacationDaysByEmployeeId, type EmployeeHoursRow } from "@/lib/employees/hours";
import {
  buildPayrollLedger,
  collectActivityMonths,
  monthsInRange,
  resolvePayrollMonths,
  sumPayrollByMonth,
  type PayrollEmployeeRow,
  type PayrollPreset,
} from "@/lib/employees/payroll";
import { monthLabel } from "@/lib/employees/review";
import {
  employeeOperatingBrand,
  matchesOperatingBrand,
} from "@/lib/finance/operating-brand";
import type { FinanceEmployee } from "@/lib/finance/categories";
import { formatIls, jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import { HEBREW_MONTHS } from "@/lib/sales-dashboard/columns";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";

const PRESETS: { id: PayrollPreset; label: string }[] = [
  { id: "this_month", label: "החודש" },
  { id: "last_month", label: "חודש שעבר" },
  { id: "month", label: "חודש מהרשימה" },
  { id: "ytd", label: "מתחילת השנה" },
  { id: "range", label: "טווח חודשים" },
  { id: "all", label: "כל התקופה" },
];

function shortMonthLabel(monthKey: string): string {
  const [, month] = monthKey.split("-");
  return HEBREW_MONTHS[month ?? ""] ?? monthKey;
}

const KIND_FILTERS: { id: "all" | EmploymentKind; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "salaried", label: "שכיר" },
  { id: "freelancer", label: "עצמאי" },
  { id: "unpaid", label: "ללא שכר" },
];

function salaryKindTitle(kind: SalaryKind | null): string {
  if (kind === "salary_only") return "רק משכורת";
  if (kind === "global") return "גלובלי";
  if (kind === "hourly") return "שעתי";
  return "—";
}

function payModelTitle(row: Pick<PayrollEmployeeRow, "employmentKind" | "salaryKind">): string {
  if (row.employmentKind === "unpaid") return "ללא שכר";
  if (row.employmentKind === "freelancer") return "עמלות (היקף + נפרעים)";
  if (row.employmentKind === "salaried") {
    return `שכיר · ${salaryKindTitle(row.salaryKind)}`;
  }
  return "אין הסכם";
}

function kindBadge(kind: EmploymentKind | null) {
  const label = employmentKindLabel(kind) ?? "אין הסכם";
  if (kind === "unpaid") {
    return { label, className: "bg-emerald-700 text-white" };
  }
  if (kind === "salaried") {
    return { label, className: "bg-black text-white" };
  }
  if (kind === "freelancer") {
    return { label, className: "bg-amber-700 text-white" };
  }
  return { label, className: "bg-amber-100 text-amber-900" };
}

function MoneyCell({
  value,
  emphasize,
  muted,
}: {
  value: number;
  emphasize?: boolean;
  muted?: boolean;
}) {
  if (muted) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        emphasize ? "font-semibold text-foreground" : "font-medium",
        value === 0 && "text-muted-foreground",
      )}
    >
      {formatIls(value)}
    </span>
  );
}

function SummaryCube({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "highlight" | "neutral" | "profit" | "amber";
}) {
  const bar =
    accent === "profit"
      ? "bg-emerald-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "highlight"
          ? "bg-highlight"
          : "bg-zinc-300";
  return (
    <div className="relative overflow-hidden rounded-[1.15rem] border border-black/[0.06] bg-white px-2.5 py-2.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:px-4 sm:py-4">
      <span className={cn("absolute inset-y-0 start-0 w-1", bar)} />
      <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 break-words text-[13px] font-semibold leading-tight tracking-tight tabular-nums sm:mt-2 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-[11px]">
        {hint}
      </p>
    </div>
  );
}

function MetricTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#fafafa] px-2.5 py-2 text-end sm:rounded-none sm:bg-transparent sm:p-0">
      <p className="text-[10px] font-medium text-muted-foreground sm:hidden">
        {label}
      </p>
      <div className="mt-0.5 sm:mt-0">{children}</div>
    </div>
  );
}

export function PayrollScreen({
  initialEmployees,
}: {
  initialEmployees: FinanceEmployee[];
}) {
  const { brand } = useOperatingBrand();
  const [employees, setEmployees] = useState(initialEmployees);
  const [productions, setProductions] = useState<MarketingProduction[]>([]);
  const [hours, setHours] = useState<EmployeeHoursRow[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PayrollPreset>("this_month");
  const [pickedMonth, setPickedMonth] = useState(() => jerusalemYmd().slice(0, 7));
  const [pickedYear, setPickedYear] = useState(() => jerusalemYmd().slice(0, 4));
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | EmploymentKind>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"employees" | "months">("employees");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogEmp, setDialogEmp] = useState<FinanceEmployee | null>(null);
  const { dashboard: liveDashboard, ready: liveReady } = useLiveDashboard();

  const hoursByEmployee = useMemo(() => groupHoursByEmployeeId(hours), [hours]);
  const vacationByEmployee = useMemo(() => groupVacationDaysByEmployeeId(hours), [hours]);

  const applyDashboard = useCallback((data: DashboardData) => {
    setProductions(data.marketing?.productions ?? []);
    setSyncedAt(data.syncedAt ?? null);
    setLoading(false);
  }, []);

  const reloadHours = useCallback(async () => {
    const result = await listEmployeeHours();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setHours(result.hours);
  }, []);

  const loadPeople = useCallback(async () => {
    try {
      const list = await listFinanceEmployees();
      if (!list.error) setEmployees(list.employees);
      await reloadHours();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאת טעינת משכורות");
    }
  }, [reloadHours]);

  useLayoutEffect(() => {
    if (liveDashboard) applyDashboard(liveDashboard);
    else if (liveReady) setLoading(false);
  }, [applyDashboard, liveDashboard, liveReady]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  useEffect(() => {
    const onGlobalSync = () => {
      void loadPeople();
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
  }, [loadPeople]);

  const activityMonths = useMemo(() => {
    const contracts = employees.flatMap((emp) => [
      emp.pay_contract,
      ...(emp.agreements ?? []).map((row) => row.contract),
    ]);
    return collectActivityMonths(
      productions,
      hours.map((row) => row.month),
      contracts,
    );
  }, [employees, hours, productions]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(jerusalemYmd().slice(0, 4));
    for (const month of activityMonths) {
      if (/^\d{4}-\d{2}$/.test(month)) years.add(month.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [activityMonths]);

  const yearMonthOptions = useMemo(() => {
    const today = jerusalemYmd().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);
    const end =
      pickedYear === currentYear ? thisMonth : `${pickedYear}-12`;
    const calendar = monthsInRange(`${pickedYear}-01`, end);
    const fromActivity = activityMonths.filter((month) =>
      month.startsWith(`${pickedYear}-`),
    );
    return Array.from(new Set([...calendar, ...fromActivity])).sort();
  }, [activityMonths, pickedYear]);

  const months = useMemo(
    () =>
      resolvePayrollMonths({
        preset,
        from: rangeFrom,
        to: rangeTo,
        month: pickedMonth,
        activityMonths,
      }),
    [activityMonths, pickedMonth, preset, rangeFrom, rangeTo],
  );

  const ledger = useMemo(
    () =>
      buildPayrollLedger({
        employees,
        productions,
        hoursByEmployee,
        vacationByEmployee,
        months,
      }),
    [employees, hoursByEmployee, months, productions, vacationByEmployee],
  );

  const branded = useMemo(
    () =>
      ledger.employees.filter((row) => {
        const emp = employees.find((item) => item.id === row.employeeId);
        return matchesOperatingBrand(
          employeeOperatingBrand({
            fullName: row.fullName,
            waitCircle: row.waitCircle,
            notes: emp?.notes,
          }),
          brand,
        );
      }),
    [brand, employees, ledger.employees],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return branded.filter((row) => {
      if (kindFilter !== "all" && row.employmentKind !== kindFilter) return false;
      if (!q) return true;
      return [row.fullName, row.department ?? "", row.waitCircle ?? "", row.agreementLabel]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [branded, kindFilter, query]);

  const visibleTotals = useMemo(() => {
    const next = {
      hours: 0,
      agreementWage: 0,
      volumeWage: 0,
      settledWage: 0,
      premiumWage: 0,
      monthlyCosts: 0,
      total: 0,
      withPay: 0,
      salaried: 0,
      freelancer: 0,
    };
    for (const row of visible) {
      next.hours += row.hours;
      next.agreementWage += row.agreementWage;
      next.volumeWage += row.volumeWage;
      next.settledWage += row.settledWage;
      next.premiumWage += row.premiumWage;
      next.monthlyCosts += row.monthlyCosts;
      next.total += row.total;
      if (row.total > 0) next.withPay += 1;
      if (row.employmentKind === "salaried") next.salaried += 1;
      if (row.employmentKind === "freelancer") next.freelancer += 1;
    }
    return next;
  }, [visible]);

  const filteredByMonth = useMemo(
    () => sumPayrollByMonth(visible, months),
    [months, visible],
  );

  const periodLabel =
    months.length === 0
      ? "אין חודשים"
      : months.length === 1
        ? ledger.byMonth[0]?.label ?? months[0]
        : `${ledger.byMonth[0]?.label ?? months[0]} – ${ledger.byMonth.at(-1)?.label ?? months.at(-1)}`;

  function openEmployee(row: PayrollEmployeeRow) {
    const emp = employees.find((item) => item.id === row.employeeId);
    if (emp) setDialogEmp(emp);
  }

  return (
    <div className="space-y-3.5 sm:space-y-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <p className="text-[12px] leading-snug text-muted-foreground sm:text-sm">
          {loading
            ? "טוען משכורות מהסנכרון האחרון…"
            : `${visible.length} עובדים · ${periodLabel}${syncedAt ? ` · ${formatLastUpdatedAt(syncedAt)}` : ""}`}
        </p>
        <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-black/[0.06] bg-white p-1 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:flex sm:w-auto sm:flex-wrap">
          <button
            type="button"
            onClick={() => setView("employees")}
            className={cn(
              "h-10 rounded-xl px-3 text-xs font-semibold active:scale-95 sm:h-9 sm:px-4",
              view === "employees" ? "bg-black text-white" : "text-muted-foreground hover:bg-muted",
            )}
          >
            לפי עובד
          </button>
          <button
            type="button"
            onClick={() => setView("months")}
            className={cn(
              "h-10 rounded-xl px-3 text-xs font-semibold active:scale-95 sm:h-9 sm:px-4",
              view === "months" ? "bg-black text-white" : "text-muted-foreground hover:bg-muted",
            )}
          >
            לפי חודש
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:p-5">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPreset(item.id);
                if (item.id === "month") {
                  setPickedYear(pickedMonth.slice(0, 4));
                }
              }}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                preset === item.id
                  ? "bg-black text-white"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "month" ? (
          <div className="mt-3 space-y-2.5">
            {yearOptions.length > 1 ? (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 hide-scrollbar">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setPickedYear(year);
                      const today = jerusalemYmd().slice(0, 7);
                      const mm = pickedMonth.slice(5, 7);
                      const end = year === today.slice(0, 4) ? today : `${year}-12`;
                      let candidate = `${year}-${mm}`;
                      if (candidate < `${year}-01` || candidate > end) {
                        candidate = year === today.slice(0, 4) ? today : `${year}-01`;
                      }
                      setPickedMonth(candidate);
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold active:scale-95",
                      pickedYear === year
                        ? "bg-zinc-800 text-white"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-[11px] font-medium text-muted-foreground">
              בחרו חודש מ־{pickedYear}
              {pickedMonth.startsWith(`${pickedYear}-`) ? (
                <>
                  {" · "}
                  <span className="font-semibold text-foreground">
                    {monthLabel(pickedMonth)}
                  </span>
                </>
              ) : null}
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {yearMonthOptions.map((monthKey) => {
                const selected = pickedMonth === monthKey;
                const hasActivity = activityMonths.includes(monthKey);
                return (
                  <button
                    key={monthKey}
                    type="button"
                    onClick={() => {
                      setPickedMonth(monthKey);
                      setPickedYear(monthKey.slice(0, 4));
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                      selected
                        ? "bg-black text-white"
                        : hasActivity
                          ? "bg-highlight/35 text-foreground hover:bg-highlight/50"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {shortMonthLabel(monthKey)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {preset === "range" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:max-w-md sm:grid-cols-2 sm:gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">מ</span>
              <Input
                type="month"
                className="h-11 rounded-xl border-black/[0.06] sm:h-10"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">עד</span>
              <Input
                type="month"
                className="h-11 rounded-xl border-black/[0.06] sm:h-10"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        <div className="mt-3.5 space-y-3 sm:mt-4 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <div className="relative w-full min-w-0 sm:min-w-[14rem] sm:flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש עובד…"
              className="h-11 rounded-xl border-black/[0.06] bg-[#fafafa] ps-10 text-start sm:h-10"
            />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {KIND_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setKindFilter(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                  kindFilter === item.id
                    ? item.id === "freelancer"
                      ? "bg-amber-700 text-white"
                      : item.id === "unpaid"
                        ? "bg-emerald-700 text-white"
                        : "bg-black text-white"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="group rounded-[1.25rem] border border-black/[0.06] bg-[#fafafa] open:pb-0 sm:rounded-[var(--radius)] sm:open:pb-0">
        <summary className="cursor-pointer list-none px-3.5 py-3 text-[12px] font-semibold text-foreground marker:content-none sm:px-4 sm:py-3.5 sm:text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            מה כולל כל רכיב שכר?
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="grid gap-3 border-t border-black/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground sm:grid-cols-3 sm:px-4 sm:py-3.5">
          <div>
            <p className="font-semibold text-foreground">שכר קבוע</p>
            <p className="mt-0.5">
              שכיר: שעתי × שעות, גלובלי, או רק משכורת. עצמאי: תוספות קבועות מההסכם (אם יש).
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">פרמיית היקף</p>
            <p className="mt-0.5">
              עמלה על סגירות / פרמיה מהאקסל לפי מדרגות או אחוז בהסכם.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">נפרעים</p>
            <p className="mt-0.5">
              רק לעצמאי. שכיר לא מקבל נפרעים — העמודה שלו ריקה בכוונה.
            </p>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <SummaryCube
          label="סה״כ לתשלום"
          value={formatIls(visibleTotals.total)}
          hint={`${visibleTotals.withPay} עם שכר · ${visibleTotals.salaried} שכירים · ${visibleTotals.freelancer} עצמאים`}
          accent="profit"
        />
        <SummaryCube
          label="שכר קבוע"
          value={formatIls(visibleTotals.agreementWage)}
          hint={
            visibleTotals.hours
              ? `${visibleTotals.hours.toLocaleString("he-IL")} שעות בטווח`
              : "שעתי / גלובלי / רק משכורת"
          }
          accent="highlight"
        />
        <SummaryCube
          label="פרמיית היקף"
          value={formatIls(visibleTotals.volumeWage)}
          hint="מדרגות ואחוזי היקף מהאקסל"
          accent="neutral"
        />
        <SummaryCube
          label="נפרעים (עצמאים)"
          value={formatIls(visibleTotals.settledWage)}
          hint="שכירים לא נכללים כאן"
          accent="amber"
        />
      </div>

      {view === "months" ? (
        <section className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          <div className="border-b border-black/[0.06] px-3.5 py-3 sm:px-5 sm:py-3.5">
            <p className="text-sm font-semibold tracking-tight">סיכום לפי חודש</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              אותם רכיבי שכר — מצטבר על כל העובדים בטווח
            </p>
          </div>
          <div className="hidden gap-y-3 border-b border-black/[0.06] bg-[#f7f7f7] px-4 py-2.5 text-[11px] font-semibold text-muted-foreground sm:grid sm:grid-cols-6">
            <span>חודש</span>
            <span className="text-end">שכר קבוע</span>
            <span className="text-end">פרמיית היקף</span>
            <span className="text-end">נפרעים</span>
            <span className="text-end">ניכויים</span>
            <span className="text-end">סה״כ</span>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {filteredByMonth.map((row) => (
              <div key={row.month} className="px-3.5 py-3 sm:px-4">
                <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-0 sm:hidden">
                  <span className="font-semibold tracking-tight">{row.label}</span>
                  <MoneyCell value={row.total} emphasize />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-baseline sm:gap-x-3 sm:gap-y-2">
                  <span className="hidden truncate font-medium sm:col-span-1 sm:block">
                    {row.label}
                  </span>
                  <MetricTile label="שכר קבוע">
                    <MoneyCell value={row.agreementWage} />
                  </MetricTile>
                  <MetricTile label="פרמיית היקף">
                    <MoneyCell value={row.volumeWage} />
                  </MetricTile>
                  <MetricTile label="נפרעים">
                    <MoneyCell value={row.settledWage} />
                  </MetricTile>
                  <MetricTile label="ניכויים">
                    <span className="tabular-nums text-muted-foreground">
                      {row.monthlyCosts ? `−${formatIls(row.monthlyCosts)}` : "—"}
                    </span>
                  </MetricTile>
                  <div className="hidden text-end sm:block">
                    <MoneyCell value={row.total} emphasize />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-black/10 bg-[#fafafa] px-3.5 py-3 sm:px-4">
            <div className="mb-2 flex items-baseline justify-between gap-2 font-semibold sm:hidden">
              <span>סה״כ</span>
              <span className="tabular-nums">{formatIls(visibleTotals.total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm font-semibold sm:grid-cols-6 sm:gap-x-3">
              <span className="hidden sm:block">סה״כ</span>
              <MetricTile label="שכר קבוע">
                <span className="tabular-nums">{formatIls(visibleTotals.agreementWage)}</span>
              </MetricTile>
              <MetricTile label="פרמיית היקף">
                <span className="tabular-nums">{formatIls(visibleTotals.volumeWage)}</span>
              </MetricTile>
              <MetricTile label="נפרעים">
                <span className="tabular-nums">{formatIls(visibleTotals.settledWage)}</span>
              </MetricTile>
              <MetricTile label="ניכויים">
                <span className="tabular-nums text-muted-foreground">
                  {visibleTotals.monthlyCosts
                    ? `−${formatIls(visibleTotals.monthlyCosts)}`
                    : "—"}
                </span>
              </MetricTile>
              <span className="hidden text-end tabular-nums sm:block">
                {formatIls(visibleTotals.total)}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          <div className="border-b border-black/[0.06] px-3.5 py-3 sm:px-5 sm:py-3.5">
            <p className="text-sm font-semibold tracking-tight">פירוט לפי עובד</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              שם לפתיחת כרטיס · חץ לפירוט הסכם וחודשים
            </p>
          </div>
          <div className="hidden gap-3 border-b border-black/[0.06] bg-[#f7f7f7] px-4 py-2.5 text-[11px] font-semibold text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))_minmax(0,1.05fr)]">
            <span>עובד · מעמד · מודל</span>
            <span className="text-end">שכר קבוע</span>
            <span className="text-end">פרמיית היקף</span>
            <span className="text-end">נפרעים</span>
            <span className="text-end">סה״כ קיבל</span>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              אין עובדים בטווח ובסינון שנבחרו.
            </p>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {visible.map((row) => {
                const open = openId === row.employeeId;
                const badge = kindBadge(row.employmentKind);
                return (
                  <EmployeePayrollRows
                    key={row.employeeId}
                    row={row}
                    open={open}
                    badge={badge}
                    onToggle={() => setOpenId(open ? null : row.employeeId)}
                    onOpen={() => openEmployee(row)}
                  />
                );
              })}
            </div>
          )}
          {visible.length > 0 ? (
            <div className="border-t border-black/10 bg-[#fafafa] px-3.5 py-3 sm:px-4">
              <div className="mb-2 flex items-baseline justify-between gap-2 font-semibold lg:hidden">
                <span className="text-sm">סה״כ {visible.length}</span>
                <span className="tabular-nums">{formatIls(visibleTotals.total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))_minmax(0,1.05fr)] lg:gap-3">
                <span className="hidden lg:block">סה״כ {visible.length} עובדים</span>
                <MetricTile label="שכר קבוע">
                  <span className="tabular-nums">{formatIls(visibleTotals.agreementWage)}</span>
                </MetricTile>
                <MetricTile label="פרמיית היקף">
                  <span className="tabular-nums">{formatIls(visibleTotals.volumeWage)}</span>
                </MetricTile>
                <MetricTile label="נפרעים">
                  <span className="tabular-nums">{formatIls(visibleTotals.settledWage)}</span>
                </MetricTile>
                <span className="hidden text-end tabular-nums lg:block">
                  {formatIls(visibleTotals.total)}
                </span>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {dialogEmp ? (
        <EmployeeCardDialog
          emp={dialogEmp}
          open
          onOpenChange={(open) => {
            if (!open) setDialogEmp(null);
          }}
          productions={productions}
          hours={hours}
          onHoursChanged={() => void reloadHours()}
          rates={[]}
          onSaved={(saved) => {
            setEmployees((current) =>
              current.map((row) => (row.id === saved.id ? saved : row)),
            );
            setDialogEmp(saved);
          }}
        />
      ) : null}
    </div>
  );
}

function EmployeePayrollRows({
  row,
  open,
  badge,
  onToggle,
  onOpen,
}: {
  row: PayrollEmployeeRow;
  open: boolean;
  badge: { label: string; className: string };
  onToggle: () => void;
  onOpen: () => void;
}) {
  const isSalaried = row.employmentKind === "salaried";
  const model = payModelTitle(row);

  return (
    <div className="hover:bg-[#fffcf0]/60">
      <div className="grid gap-2.5 px-3.5 py-3 sm:gap-3 sm:px-4 sm:py-3.5 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))_minmax(0,1.05fr)] lg:items-center">
        <div className="flex min-w-0 items-start gap-1">
          <button
            type="button"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:scale-95 hover:bg-muted sm:size-8 sm:rounded-lg"
            onClick={onToggle}
            aria-label={open ? "סגירת פירוט" : "פתיחת פירוט"}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className="max-w-full truncate text-start text-[15px] font-semibold tracking-tight hover:underline sm:text-sm"
                onClick={onOpen}
              >
                {row.fullName}
              </button>
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  badge.className,
                )}
              >
                {badge.label}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:truncate sm:leading-normal">
              {model}
              {(row.department || row.waitCircle)
                ? ` · ${[row.department, row.waitCircle].filter(Boolean).join(" · ")}`
                : ""}
            </p>
          </div>
          <div className="shrink-0 pt-0.5 text-end lg:hidden">
            <p className="text-[10px] font-medium text-muted-foreground">סה״כ</p>
            <MoneyCell value={row.total} emphasize />
            {row.monthlyCosts > 0 ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                −{formatIls(row.monthlyCosts)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:contents">
          <MetricTile label="שכר קבוע">
            <MoneyCell value={row.agreementWage} />
          </MetricTile>
          <MetricTile label="פרמיית היקף">
            <MoneyCell value={row.volumeWage} />
          </MetricTile>
          <MetricTile label="נפרעים">
            {isSalaried ? (
              <span className="text-[11px] font-medium text-muted-foreground">לא חל</span>
            ) : (
              <MoneyCell value={row.settledWage} />
            )}
          </MetricTile>
        </div>

        <div className="hidden text-end lg:block">
          <MoneyCell value={row.total} emphasize />
          {row.monthlyCosts > 0 ? (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              ניכוי −{formatIls(row.monthlyCosts)}
            </span>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="border-t border-black/[0.04] bg-[#fafafa] px-3.5 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-4 lg:px-5 lg:pb-4">
          <div className="mb-3 rounded-xl border border-black/[0.06] bg-white px-3.5 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground">הסכם</p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground sm:text-sm">
              {row.agreementLabel || "אין הסכם"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {row.hours > 0 ? (
                <span>{row.hours.toLocaleString("he-IL")} שעות</span>
              ) : null}
              {row.volumeCount > 0 ? (
                <span>
                  היקף: {row.volumeCount} סגירות · פרמיה {formatIls(row.volumePremium)}
                </span>
              ) : null}
              {!isSalaried && row.settledCount > 0 ? (
                <span>
                  נפרעים: {row.settledCount} סגירות · {formatIls(row.settledPremium)}
                </span>
              ) : null}
              {row.monthlyCosts > 0 ? (
                <span>ניכויים −{formatIls(row.monthlyCosts)}</span>
              ) : null}
            </div>
          </div>

          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
            פירוט חודשי
          </p>
          <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white">
            <div className="hidden gap-2 border-b border-black/[0.06] bg-[#f7f7f7] px-3 py-2 text-[11px] font-semibold text-muted-foreground sm:grid sm:grid-cols-6">
              <span>חודש</span>
              <span className="text-end">שכר קבוע</span>
              <span className="text-end">פרמיית היקף</span>
              <span className="text-end">נפרעים</span>
              <span className="text-end">ניכויים</span>
              <span className="text-end">סה״כ</span>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {row.months.map((month) => (
                <div key={month.month} className="px-3 py-2.5">
                  <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-0 sm:hidden">
                    <span className="font-medium">
                      {month.label}
                      <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">
                        {employmentKindLabel(month.employmentKind) ?? ""}
                      </span>
                    </span>
                    <MoneyCell value={month.total} emphasize />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6 sm:gap-2">
                    <span className="hidden font-medium sm:block">
                      {month.label}
                      <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">
                        {employmentKindLabel(month.employmentKind) ?? ""}
                      </span>
                    </span>
                    <MetricTile label="שכר קבוע">
                      <MoneyCell value={month.agreementWage} />
                    </MetricTile>
                    <MetricTile label="פרמיית היקף">
                      <MoneyCell value={month.volumeWage} />
                    </MetricTile>
                    <MetricTile label="נפרעים">
                      {month.employmentKind === "salaried" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <MoneyCell value={month.settledWage} />
                      )}
                    </MetricTile>
                    <MetricTile label="ניכויים">
                      <span className="tabular-nums text-muted-foreground">
                        {month.monthlyCosts
                          ? `−${formatIls(month.monthlyCosts)}`
                          : "—"}
                      </span>
                    </MetricTile>
                    <div className="hidden text-end sm:block">
                      <MoneyCell value={month.total} emphasize />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
