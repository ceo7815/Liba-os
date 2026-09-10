"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, CircleHelp, X } from "lucide-react";
import { toast } from "sonner";
import { saveEmployeePayContract, updateFinanceEmployee, getFinanceEmployee } from "@/app/actions/finance-people";
import { EmployeeReviewPanel } from "@/components/employees/employee-review-panel";
import { EmployeeHoursPanel } from "@/components/employees/employee-hours-panel";
import {
  contractWageTotals,
  currentAgreement,
  currentEmploymentKind,
  dayBeforeIso,
  emptyAgreement,
  extrasAmountForMonth,
  FREELANCER_FORMULA_OPTIONS,
  FREELANCERS_1,
  FREELANCERS_2,
  FREELANCERS_3,
  FREELANCERS_4,
  freelancerSettledSpec,
  formatAgreementRange,
  MONTHLY_COST_FIELDS,
  monthlyCostLines,
  monthlyCostsTotal,
  parsePayAgreements,
  salaryBenefitsForMonth,
  todayIso,
  toPayProfile,
  usesFreelancers1,
  validVariableExpenses,
  variableExpensesIncomplete,
  wageTotalForEmployeeContract,
  withSalariedBenefitDefaults,
  isSalaryOnly,
  usesMonthlySalary,
  isFreelancers3,
  isFreelancers4,
  fixedMonthlyForMonth,
  oneTimePaymentsIncomplete,
  resolvedOneTimePayments,
  withResolvedOneTimePayments,
  type EmployeeAgreement,
  type EmployeePayContract,
  type EmploymentKind,
  type FreelancerFormula,
  type OneTimePayment,
  type VariableExpense,
} from "@/lib/employees/contract";
import { buildEmployeeReview } from "@/lib/employees/review";
import type { FinanceEmployee } from "@/lib/finance/categories";
import {
  DEFAULT_AGENT_MULTIPLIER,
  formatIls,
  type AgentRate,
} from "@/lib/sales-dashboard/campaign-math";
import { countVacationDays, type EmployeeHoursRow } from "@/lib/employees/hours";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";

function n(value: string): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function agreementsFromEmployee(emp: FinanceEmployee): EmployeeAgreement[] {
  const existing = emp.agreements ?? [];
  const base =
    existing.length > 0
      ? existing.map((row) => ({
          ...row,
          contract: {
            ...row.contract,
            productionTiers: row.contract.productionTiers.map((tier) => ({ ...tier })),
            variableExpenses: (row.contract.variableExpenses ?? []).map((item) => ({
              ...item,
            })),
            oneTimePayments: (row.contract.oneTimePayments ?? []).map((item) => ({
              ...item,
            })),
          },
        }))
      : parsePayAgreements(emp.pay_contract, emp.employment_kind);
  return base.map((row) => ({
    ...row,
    contract: withResolvedOneTimePayments(row.contract),
  }));
}

function emptyDetails(emp: FinanceEmployee) {
  return {
    full_name: emp.full_name,
    department: emp.department ?? "",
    short_dial: emp.short_dial ?? "",
    email: emp.email ?? "",
    direct_phone: emp.direct_phone ?? "",
    outbound_number: emp.outbound_number ?? "",
    sim_provider: emp.sim_provider ?? "",
    wait_circle: emp.wait_circle ?? "",
    dialer_type: emp.dialer_type ?? "",
    notes: emp.notes ?? "",
  };
}

type CardTab = "review" | "details" | "agreement" | "hours";

const KIND_OPTIONS = [
  { id: "salaried", label: "שכיר" },
  { id: "freelancer", label: "עצמאי" },
  { id: "unpaid", label: "ללא שכר" },
] as const;

export function EmployeeCardDialog({
  emp,
  open,
  onOpenChange,
  productions,
  hours = [],
  onHoursChanged,
  rates,
  defaultMultiplier = DEFAULT_AGENT_MULTIPLIER,
  contactEditor: _contactEditor,
  onDelete,
  onSaved,
}: {
  emp: FinanceEmployee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productions: MarketingProduction[];
  hours?: EmployeeHoursRow[];
  onHoursChanged?: () => void;
  rates: AgentRate[];
  defaultMultiplier?: number;
  contactEditor?: React.ReactNode;
  onDelete?: () => void;
  onSaved: (row: FinanceEmployee) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<CardTab>("review");
  const [agreements, setAgreements] = useState<EmployeeAgreement[]>(() =>
    agreementsFromEmployee(emp),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => currentAgreement(agreementsFromEmployee(emp))?.id ?? null,
  );
  const [details, setDetails] = useState(() => emptyDetails(emp));

  useEffect(() => {
    if (!open) return;
    const local = agreementsFromEmployee(emp);
    setAgreements(local);
    setSelectedId(currentAgreement(local)?.id ?? local[0]?.id ?? null);
    setDetails(emptyDetails(emp));
    let cancelled = false;
    onHoursChanged?.();
    void getFinanceEmployee(emp.id).then((result) => {
      if (cancelled || !result.employee) return;
      onSaved(result.employee);
      const next = agreementsFromEmployee(result.employee);
      setAgreements(next);
      setSelectedId(currentAgreement(next)?.id ?? next[0]?.id ?? null);
      setDetails(emptyDetails(result.employee));
    });
    return () => {
      cancelled = true;
    };
  }, [emp.id, open]);

  useEffect(() => {
    if (open) setTab("review");
  }, [open]);

  const selected = agreements.find((row) => row.id === selectedId) ?? null;
  const kind = selected?.employmentKind ?? null;
  const contract = selected?.contract ?? null;
  const hoursByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of hours) {
      if (row.employeeId !== emp.id) continue;
      map[row.month] = row.hours;
    }
    return map;
  }, [emp.id, hours]);

  const vacationDaysByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of hours) {
      if (row.employeeId !== emp.id) continue;
      const days = countVacationDays(row.days);
      if (days > 0) map[row.month] = days;
    }
    return map;
  }, [emp.id, hours]);

  const profile = useMemo(
    () =>
      toPayProfile({
        fullName: emp.full_name,
        employmentKind: currentEmploymentKind(agreements),
        agreements,
        hoursByMonth,
        vacationDaysByMonth,
      }),
    [agreements, emp.full_name, hoursByMonth, vacationDaysByMonth],
  );

  const live = useMemo(() => {
    const totals = contractWageTotals(productions, {
      profiles: [profile],
      rates,
      fallback: 0,
    });
    return wageTotalForEmployeeContract(emp.full_name, totals);
  }, [defaultMultiplier, emp.full_name, productions, profile, rates]);

  const review = useMemo(
    () =>
      buildEmployeeReview(emp.full_name, productions, {
        profiles: [profile],
        rates,
        fallback: 0,
      }),
    [defaultMultiplier, emp.full_name, productions, profile, rates],
  );

  function patchAgreement(id: string, partial: Partial<EmployeeAgreement>) {
    setAgreements((current) =>
      current.map((row) => (row.id === id ? { ...row, ...partial } : row)),
    );
  }

  function patchContract(partial: Partial<EmployeePayContract>) {
    if (!selected) return;
    patchAgreement(selected.id, {
      contract: { ...selected.contract, ...partial },
    });
  }

  function addPeriod(
    employmentKind: EmploymentKind = selected?.employmentKind ?? "salaried",
    options?: { unbounded?: boolean },
  ) {
    const unbounded = Boolean(options?.unbounded) || agreements.length === 0;
    const from = unbounded ? "" : todayIso();
    const last = [...agreements].sort((a, b) => (a.from || "").localeCompare(b.from || "")).at(-1);
    const next = emptyAgreement(employmentKind, from);
    if (last) {
      next.contract = { ...last.contract };
      if (employmentKind === "salaried" && last.employmentKind !== "salaried") {
        next.contract = withSalariedBenefitDefaults(next.contract);
      }
    }
    setAgreements((current) => {
      const closed =
        last && from
          ? current.map((row) =>
              row.id === last.id && !row.to
                ? { ...row, to: dayBeforeIso(from) || row.to }
                : row,
            )
          : current;
      return [...closed, next];
    });
    setSelectedId(next.id);
  }

  function applyNoPeriod() {
    if (selected) {
      patchAgreement(selected.id, { from: "", to: "" });
      return;
    }
    addPeriod("salaried", { unbounded: true });
  }

  function removePeriod(id: string) {
    const next = agreements.filter((row) => row.id !== id);
    setAgreements(next);
    setSelectedId((current) =>
      current === id ? (currentAgreement(next)?.id ?? next[0]?.id ?? null) : current,
    );
  }

  function saveAgreement() {
    const incomplete = agreements.some(
      (row) =>
        variableExpensesIncomplete(row.contract) ||
        oneTimePaymentsIncomplete(row.contract),
    );
    if (incomplete) {
      toast.error("להוצאה / תשלום חד־פעמי חובה קטגוריה, סכום וחודש תקין");
      return;
    }
    startTransition(() => {
      void saveEmployeePayContract({
        id: emp.id,
        agreements,
      }).then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("ההסכם נשמר — השכר לפי חודש מכירה, כל חודש בנפרד");
        const current = currentAgreement(agreements);
        onSaved({
          ...emp,
          employment_kind: current?.employmentKind ?? null,
          pay_contract: current?.contract ?? emp.pay_contract,
          agreements,
        });
      });
    });
  }

  function saveDetails() {
    startTransition(() => {
      void updateFinanceEmployee({ id: emp.id, ...details }).then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("פרטי העובד נשמרו");
        onSaved({
          ...emp,
          ...details,
          department: details.department || null,
          short_dial: details.short_dial || null,
          email: details.email || null,
          direct_phone: details.direct_phone || null,
          outbound_number: details.outbound_number || null,
          sim_provider: details.sim_provider || null,
          wait_circle: details.wait_circle || null,
          dialer_type: details.dialer_type || null,
          notes: details.notes || null,
        });
      });
    });
  }

  const tabs: { id: CardTab; label: string }[] = [
    { id: "review", label: "סקירה" },
    { id: "details", label: "פרטי עובד" },
    { id: "agreement", label: "הסכם שכר" },
    { id: "hours", label: "נוכחות" },
  ];

  const primaryLabel =
    tab === "details" ? (pending ? "שומר פרטים…" : "שמירת פרטים")
    : tab === "agreement" ? (pending ? "שומר הסכם…" : "שמירת הסכם")
    : tab === "hours" ? ""
    : "לעריכת הסכם";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[1.25rem] border-black/[0.08] p-0 text-start shadow-[0_24px_80px_-24px_rgba(17,17,17,0.45)] data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:inset-auto sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:h-[min(52rem,calc(100dvh-1.5rem))] sm:max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:w-[min(96vw,64rem)] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]"
        dir="rtl"
      >
        <DialogHeader className="shrink-0 space-y-3 border-b border-black/[0.06] px-4 pb-3 pt-4 text-start sm:space-y-4 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="pe-8">
            <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
              {emp.full_name}
            </DialogTitle>
            <DialogDescription className="mt-1.5 line-clamp-2 max-w-3xl text-[12px] leading-relaxed sm:mt-2 sm:line-clamp-none sm:text-sm">
              שכר לפי חודש מכירה: הפקה ב־1 לחודש (תחילת ביטוח) נספרת לחודש
              שלפניו, והשעות נשארות כמו בדוח הנוכחות. העברה ליצרן בחודש אחר לא
              מעבירה את הלקוח.
            </DialogDescription>
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 hide-scrollbar sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "h-11 shrink-0 rounded-xl px-3.5 text-sm font-semibold sm:px-0",
                  tab === item.id ? "bg-black text-white" : "text-muted-foreground hover:bg-background/70",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tab === "review" ? (
            <div className="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
              <section className="grid gap-2 rounded-2xl border border-black/[0.06] bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["מחלקה", emp.department],
                  ["מעגל", emp.wait_circle],
                  ["חיוג מקוצר", emp.short_dial],
                  ["מספר ישיר", emp.direct_phone],
                  ["מספר יוצאות", emp.outbound_number],
                  ["ספק סים", emp.sim_provider],
                  ["חייגן", emp.dialer_type],
                  ["אימייל", emp.email],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-sm font-medium">{value?.trim() || "—"}</p>
                  </div>
                ))}
                {emp.notes?.trim() ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-[11px] text-muted-foreground">הערות</p>
                    <p className="mt-0.5 text-sm">{emp.notes}</p>
                  </div>
                ) : null}
              </section>
              <EmployeeReviewPanel review={review} />
            </div>
          ) : null}

          {tab === "details" ? (
            <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
              <div>
                <h3 className="text-base font-semibold">פרטי העובד</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  מלאו כאן שם, מחלקה ופרטי קשר. השכר מחושב מהאקסל לפי חודש מכירה.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="שם מלא">
                  <Input
                    value={details.full_name}
                    onChange={(e) => setDetails((f) => ({ ...f, full_name: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="מחלקה">
                  <Input
                    value={details.department}
                    onChange={(e) => setDetails((f) => ({ ...f, department: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                    placeholder="מכירות / תפעול"
                  />
                </Field>
                <Field label="מעגל המתנה">
                  <Input
                    value={details.wait_circle}
                    onChange={(e) => setDetails((f) => ({ ...f, wait_circle: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                    placeholder="ליבה / שמש"
                  />
                </Field>
                <Field label="חיוג מקוצר">
                  <Input
                    value={details.short_dial}
                    onChange={(e) => setDetails((f) => ({ ...f, short_dial: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="מספר ישיר">
                  <Input
                    value={details.direct_phone}
                    onChange={(e) => setDetails((f) => ({ ...f, direct_phone: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="מספר יוצאות">
                  <Input
                    value={details.outbound_number}
                    onChange={(e) => setDetails((f) => ({ ...f, outbound_number: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="ספק סים">
                  <Input
                    value={details.sim_provider}
                    onChange={(e) => setDetails((f) => ({ ...f, sim_provider: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="סוג חייגן">
                  <Input
                    value={details.dialer_type}
                    onChange={(e) => setDetails((f) => ({ ...f, dialer_type: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="אימייל">
                  <Input
                    value={details.email}
                    onChange={(e) => setDetails((f) => ({ ...f, email: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
                <Field label="הערות">
                  <Input
                    value={details.notes}
                    onChange={(e) => setDetails((f) => ({ ...f, notes: e.target.value }))}
                    className="h-10 rounded-xl text-start"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {tab === "agreement" ? (
            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-5 p-4 sm:p-6">
                <section className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold">תקופות הסכם</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={cn(
                          "h-10 rounded-xl px-4 text-sm font-semibold",
                          selected && !selected.from && !selected.to
                            ? "bg-black text-white hover:bg-black"
                            : "",
                        )}
                        variant={selected && !selected.from && !selected.to ? "default" : "outline"}
                        onClick={applyNoPeriod}
                      >
                        ללא תקופה
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl px-4 text-sm font-semibold"
                        onClick={() => addPeriod()}
                      >
                        <Plus className="size-4" />
                        הוספת תקופה
                      </Button>
                    </div>
                  </div>
                  {agreements.length === 0 ? (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                      אין תקופות. «ללא תקופה» מכסה מההתחלה ועד היום ומחשב ישר
                      על כל האקסל. «תקופה» להסכם עם תאריכים.
                    </p>
                  ) : (
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                      {agreements
                        .slice()
                        .sort((a, b) => (a.from || "").localeCompare(b.from || ""))
                        .map((row) => {
                          const active = selectedId === row.id;
                          return (
                            <div
                              key={row.id}
                              className={cn(
                                "inline-flex h-10 shrink-0 items-center overflow-hidden rounded-xl",
                                active
                                  ? "bg-black text-white"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedId(row.id)}
                                className="h-full px-3 text-sm font-semibold"
                              >
                                {formatAgreementRange(row.from, row.to)} ·{" "}
                                {employmentKindLabel(row.employmentKind)}
                              </button>
                              <button
                                type="button"
                                aria-label="מחיקת תקופת הסכם"
                                title="מחיקת תקופה"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removePeriod(row.id);
                                }}
                                className={cn(
                                  "flex h-full w-8 shrink-0 items-center justify-center",
                                  active
                                    ? "text-white/80 hover:bg-white/15 hover:text-white"
                                    : "hover:bg-black/10 hover:text-foreground",
                                )}
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>

                {selected && contract ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="מתאריך" hint="ריק = מתחילת האקסל">
                        <Input
                          type="date"
                          className="h-11 rounded-xl tabular-nums"
                          value={selected.from}
                          onChange={(e) => patchAgreement(selected.id, { from: e.target.value })}
                        />
                      </Field>
                      <Field label="עד תאריך" hint="ריק = בתוקף עד היום">
                        <Input
                          type="date"
                          className="h-11 rounded-xl tabular-nums"
                          value={selected.to}
                          onChange={(e) => patchAgreement(selected.id, { to: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-base font-semibold">סוג העסקה בתקופה זו</h3>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {KIND_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              const nextKind = option.id;
                              if (nextKind === selected.employmentKind) return;
                              if (nextKind === "salaried") {
                                patchAgreement(selected.id, {
                                  employmentKind: nextKind,
                                  contract: withSalariedBenefitDefaults(selected.contract),
                                });
                                return;
                              }
                              patchAgreement(selected.id, { employmentKind: nextKind });
                            }}
                            className={cn(
                              "h-11 rounded-xl px-1 text-[12px] font-semibold leading-tight sm:px-2 sm:text-sm",
                              kind === option.id
                                ? "bg-black text-white"
                                : "bg-muted text-muted-foreground hover:bg-muted/80",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {kind === "salaried" ? (
                      <SalariedFields
                        contract={contract}
                        hoursByMonth={hoursByMonth}
                        salesWage={previewSalesWage(hoursByMonth, review.months, review.thisMonthKey)}
                        agreementFrom={selected.from}
                        previewMonth={previewMonthKey(hoursByMonth, review.thisMonthKey, selected.from)}
                        patch={patchContract}
                      />
                    ) : null}
                    {kind === "freelancer" ? (
                      <FreelancerFields contract={contract} patch={patchContract} />
                    ) : null}
                    {kind === "unpaid" ? <UnpaidFields /> : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl text-sm font-semibold text-red-700"
                      onClick={() => removePeriod(selected.id)}
                    >
                      מחיקת התקופה הזו
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {KIND_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => addPeriod(option.id)}
                        className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <aside className="space-y-4 border-t border-black/[0.06] bg-muted/20 p-4 sm:p-5 lg:border-t-0 lg:border-s">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {kind === "unpaid" ? "שכר לעובד" : "חישוב חי מהאקסל"}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{formatIls(live.earned)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {kind === "unpaid"
                      ? "ללא שכר: הסגירות נכנסות לדוחות בלי הוצאת שכר — רווח ישיר לחברה."
                      : kind === "salaried" && isSalaryOnly(contract?.salaryKind)
                        ? "רק משכורת חודשית. אין מדרגות, אין בונוסים, אין נסיעות ואין נפרעים."
                      : kind === "salaried" && usesMonthlySalary(contract?.salaryKind)
                        ? "שכר גלובלי לחודש בלבד. אין מדרגות על מכירות ואין נפרעים."
                      : kind === "salaried"
                        ? "שכיר לא מקבל נפרעים. השכר נכנס להיקף: מדרגות + שעתי + נסיעות + הפרשות מעסיק."
                      : contract && isFreelancers4(contract)
                        ? "עצמאים 4 אביחי יוסף: ₪5,000 קבועים כל חודש + היקף מקורות ליבה. ניב לב רן גם על שמש כל התקופה. שאר שמש / דניאל כהן על שמש רק עד 31.5.2026. מיוני בלי השם שמש. נפרעים 3% רק על ליבה."
                      : contract && isFreelancers3(contract)
                        ? "עצמאים 3 בן סגל: מכפיל 7 על מכירה בחודש המכירה. בלי נפרעים."
                      : "כל לקוח נכנס לחודש המכירה: הפקה ב־1 לחודש שייכת לחודש שלפניו, גם אם ההעברה ליצרן בחודש אחר."}
                  </p>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="rounded-xl bg-background/80 px-3 py-2.5">
                    <dt className="text-xs text-muted-foreground">היקף — דוח מכירה</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{formatIls(live.volumeWage)}</dd>
                    <dd className="text-[11px] text-muted-foreground">
                      {live.volumeCount} סגירות · פרמיה {formatIls(live.volumePremium)}
                    </dd>
                  </div>
                  {kind === "salaried" || (contract && isFreelancers3(contract)) ? null : (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">
                        {contract && usesFreelancers1(contract)
                          ? `${freelancerSettledSpec(contract)?.label ?? "נפרעים"} — שוטף 60 ונגרר`
                          : "נפרעים — דוח מינוי"}
                      </dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatIls(live.settledWage)}</dd>
                      <dd className="text-[11px] text-muted-foreground">
                        {contract && usesFreelancers1(contract)
                          ? `${live.settledCount} מכירות שהופקו · פרמיה ${formatIls(live.settledPremium)} · משולם חודשיים אחרי המכירה`
                          : `${live.settledCount} סגירות · פרמיה ${formatIls(live.settledPremium)}`}
                      </dd>
                    </div>
                  )}
                  {kind === "salaried" && contract && (contract.salaryKind ?? "hourly") === "hourly" && contract.hourlyRate > 0 ? (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">שכר שעתי</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {formatIls(contract.hourlyRate)} × שעות החודש
                      </dd>
                    </div>
                  ) : null}
                  {kind === "salaried" && contract && usesMonthlySalary(contract.salaryKind) && contract.globalSalary > 0 ? (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">
                        {isSalaryOnly(contract.salaryKind) ? "רק משכורת לחודש" : "שכר גלובלי לחודש"}
                      </dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatIls(contract.globalSalary)}</dd>
                    </div>
                  ) : null}
                  {kind === "salaried" && contract && !isSalaryOnly(contract.salaryKind) && contract.travelAmount > 0 ? (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">נסיעות לחודש</dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatIls(contract.travelAmount)}</dd>
                    </div>
                  ) : null}
                  {contract &&
                  !isSalaryOnly(contract.salaryKind) &&
                  (extrasAmountForMonth(contract) > 0 ||
                    resolvedOneTimePayments(contract).some((row) => row.amount > 0)) ? (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">
                        {fixedMonthlyForMonth(contract) > 0 ? "שכר קבוע והוצאות" : "הוצאות ותוספות"}
                      </dt>
                      {fixedMonthlyForMonth(contract) > 0 ? (
                        <dd className="mt-1 text-sm">
                          שכר קבוע · {formatIls(fixedMonthlyForMonth(contract))} · כל חודש, ועליו היקף ונפרעים
                        </dd>
                      ) : null}
                      {validVariableExpenses(contract).map((row) => (
                        <dd key={row.id} className="mt-1 text-sm">
                          {row.note} · {formatIls(row.amount)} · כל חודש
                        </dd>
                      ))}
                      {resolvedOneTimePayments(contract)
                        .filter((row) => row.amount > 0)
                        .map((row) => (
                          <dd key={row.id} className="mt-1 text-sm">
                            {row.note || "תשלום חד־פעמי"} · {formatIls(row.amount)}
                            {row.month
                              ? ` · חד־פעמי · ${row.month.split("-").reverse().join("/")}`
                              : " · חד־פעמי"}
                          </dd>
                        ))}
                    </div>
                  ) : null}
                  {contract && monthlyCostsTotal(contract) > 0 ? (
                    <div className="rounded-xl bg-background/80 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">עלויות חודשיות — יורדות כל חודש</dt>
                      {monthlyCostLines(contract).map((row) => (
                        <dd key={row.key} className="mt-1 text-sm">
                          {row.label} · −{formatIls(row.amount)}
                        </dd>
                      ))}
                      <dd className="mt-1 font-semibold tabular-nums">
                        סה״כ −{formatIls(monthlyCostsTotal(contract))}
                      </dd>
                    </div>
                  ) : null}
                  {kind === "salaried" && contract ? (
                    <BenefitsPreview
                      contract={contract}
                      hours={latestMonthHours(hoursByMonth)}
                      salesWage={previewSalesWage(hoursByMonth, review.months, review.thisMonthKey)}
                      agreementFrom={selected?.from}
                      previewMonth={previewMonthKey(hoursByMonth, review.thisMonthKey, selected?.from)}
                    />
                  ) : null}
                </dl>
                {agreements.length === 0 ? (
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    בחרו שכיר או עצמאי והוסיפו תאריכים. עד אז הדוחות משתמשים במכפיל
                    הישן.
                  </p>
                ) : null}
              </aside>
            </div>
          ) : null}

          {tab === "hours" ? (
            <EmployeeHoursPanel
              employeeId={emp.id}
              hours={hours}
              onChanged={() => onHoursChanged?.()}
            />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-black/[0.06] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:space-x-0 sm:px-6 sm:py-4 sm:pb-4">
          <div className="order-2 flex w-full items-center sm:order-1 sm:w-auto">
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl px-4 font-semibold text-red-700 sm:w-auto"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                מחיקת עובד
              </Button>
            ) : (
              <span className="hidden sm:inline" />
            )}
          </div>
          <div className="order-1 flex w-full flex-col-reverse gap-2 sm:order-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl font-semibold sm:min-w-[7.5rem] sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              סגירה
            </Button>
            {primaryLabel ? (
            <Button
              type="button"
              className="h-11 w-full rounded-xl font-semibold sm:min-w-[8.5rem] sm:w-auto"
              disabled={pending}
              onClick={() => {
                if (tab === "details") saveDetails();
                else if (tab === "agreement") saveAgreement();
                else setTab("agreement");
              }}
            >
              {primaryLabel}
            </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function latestMonthHours(hoursByMonth: Record<string, number>): number {
  const months = Object.keys(hoursByMonth).sort();
  const last = months.at(-1);
  return last ? hoursByMonth[last] ?? 0 : 0;
}

function previewMonthKey(
  hoursByMonth: Record<string, number>,
  fallbackMonth: string,
  agreementFrom?: string,
): string {
  const fromHours = Object.keys(hoursByMonth).sort().at(-1);
  if (fromHours) return fromHours;
  if (fallbackMonth && /^\d{4}-\d{2}$/.test(fallbackMonth)) return fallbackMonth;
  const start = (agreementFrom ?? "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(start) ? start : "";
}

function previewSalesWage(
  hoursByMonth: Record<string, number>,
  months: { key: string; salesWage: number }[],
  fallbackMonth: string,
): number {
  const fromHours = Object.keys(hoursByMonth).sort().at(-1);
  const month = fromHours || months[0]?.key || fallbackMonth;
  return months.find((row) => row.key === month)?.salesWage ?? 0;
}

function percentText(value: number): string {
  if (!value) return "";
  return String(value);
}

function sanitizePercentDraft(raw: string): string {
  const next = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dot = next.indexOf(".");
  if (dot === -1) return next;
  return `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, "")}`;
}

function DecimalInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(percentText(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(percentText(value));
  }, [focused, value]);

  return (
    <Input
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={focused ? draft : percentText(value)}
      onFocus={() => {
        setDraft(percentText(value));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const next = sanitizePercentDraft(e.target.value);
        setDraft(next);
        onChange(n(next));
      }}
    />
  );
}

function PercentMoneyField({
  label,
  percent,
  amount,
  hint,
  onChange,
}: {
  label: string;
  percent: number;
  amount: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(percentText(percent));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(percentText(percent));
  }, [focused, percent]);

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          className="h-10 rounded-xl tabular-nums"
          placeholder="%"
          value={focused ? draft : percentText(percent)}
          onFocus={() => {
            setDraft(percentText(percent));
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const next = sanitizePercentDraft(e.target.value);
            setDraft(next);
            onChange(n(next));
          }}
        />
        <span className="min-w-[6.5rem] shrink-0 text-sm font-semibold tabular-nums">
          {formatIls(amount)}
        </span>
      </div>
    </Field>
  );
}

function BenefitsPreview({
  contract,
  hours,
  salesWage,
  agreementFrom,
  previewMonth,
}: {
  contract: EmployeePayContract;
  hours: number;
  salesWage: number;
  agreementFrom?: string;
  previewMonth?: string;
}) {
  const funds = salaryBenefitsForMonth(contract, hours, salesWage, {
    month: previewMonth,
    agreementFrom,
  });
  if (
    funds.ceiling <= 0 &&
    funds.severanceEmployerPercent <= 0 &&
    funds.pensionEmployeePercent <= 0 &&
    funds.pensionEmployerPercent <= 0 &&
    funds.studyFundEmployeePercent <= 0 &&
    funds.studyFundEmployerPercent <= 0
  ) {
    return null;
  }
  return (
    <>
      {funds.ceiling > 0 ? (
        <div className="rounded-xl bg-background/80 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">תקרת הפרשה</dt>
          <dd className="mt-1 font-semibold tabular-nums">{formatIls(funds.ceiling)}</dd>
          {funds.overCeiling ? (
            <dd className="text-[11px] text-amber-800">
              מעל התקרה {formatIls(funds.grossPensionable - funds.pensionable)} בלי הפרשות
            </dd>
          ) : null}
        </div>
      ) : null}
      {funds.severanceEmployerPercent > 0 ? (
        <div className="rounded-xl bg-background/80 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">פיצויים מעסיק</dt>
          <dd className="mt-1 text-sm">
            {funds.severanceEmployerPercent}% · {formatIls(funds.severanceEmployer)}
          </dd>
        </div>
      ) : null}
      {funds.pensionEmployeePercent > 0 || funds.pensionEmployerPercent > 0 ? (
        <div className="rounded-xl bg-background/80 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">פנסיה / גמל</dt>
          <dd className="mt-1 text-sm">
            עובד {funds.pensionEmployeePercent}% · {formatIls(funds.pensionEmployee)}
          </dd>
          <dd className="text-sm">
            מעסיק {funds.pensionEmployerPercent}% · {formatIls(funds.pensionEmployer)}
          </dd>
          {funds.pensionWaiting ? (
            <dd className="text-[11px] text-muted-foreground">אין הפרשה בחודש זה — אחרי 3 חודשים מההסכם</dd>
          ) : null}
        </div>
      ) : null}
      {funds.studyFundEmployeePercent > 0 || funds.studyFundEmployerPercent > 0 ? (
        <div className="rounded-xl bg-background/80 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">קרן השתלמות</dt>
          <dd className="mt-1 text-sm">
            עובד {funds.studyFundEmployeePercent}% · {formatIls(funds.studyFundEmployee)}
          </dd>
          <dd className="text-sm">
            מעסיק {funds.studyFundEmployerPercent}% · {formatIls(funds.studyFundEmployer)}
          </dd>
        </div>
      ) : null}
    </>
  );
}

function SalariedFields({
  contract,
  hoursByMonth,
  salesWage,
  agreementFrom,
  previewMonth,
  patch,
}: {
  contract: EmployeePayContract;
  hoursByMonth: Record<string, number>;
  salesWage: number;
  agreementFrom?: string;
  previewMonth?: string;
  patch: (partial: Partial<EmployeePayContract>) => void;
}) {
  const previewHours = latestMonthHours(hoursByMonth);
  const funds = salaryBenefitsForMonth(contract, previewHours, salesWage, {
    month: previewMonth,
    agreementFrom,
  });
  return (
    <section className="space-y-3 rounded-2xl border border-black/[0.06] bg-muted/15 p-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950">
        שכיר לא מקבל נפרעים. אין עמלת מינוי סוכן ואין שדות נפרעים. השכר נכנס רק להיקף.
      </div>
      <div>
        <h3 className="text-sm font-semibold">הסכם שכיר</h3>
        <p className="text-[11px] text-muted-foreground">
          {isSalaryOnly(contract.salaryKind)
            ? "רק המשכורת החודשית. אין מדרגות, אין בונוסים ואין נסיעות — רק הסכום שתזינו."
            : usesMonthlySalary(contract.salaryKind)
              ? "משכורת חודשית קבועה בלבד. אין עמלה על הפקות. נסיעות והפרשות לפי הסכום הגלובלי."
              : "מדרגות הפקה להיקף. שכר בסיס שעתי לפי שעות החודש, נסיעות, והפרשות על השכר ועל המדרגות לפי אחוז."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {([
          { id: "hourly" as const, label: "שכר שעתי" },
          { id: "global" as const, label: "שכר גלובלי" },
          { id: "salary_only" as const, label: "רק משכורת" },
        ]).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => patch({ salaryKind: option.id })}
            className={cn(
              "h-11 rounded-xl px-1 text-[12px] font-semibold leading-tight sm:px-2 sm:text-sm",
              (contract.salaryKind ?? "hourly") === option.id
                ? "bg-black text-white"
                : "bg-background text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(contract.salaryKind ?? "hourly") === "hourly" ? (
          <Field label="שכר שעתי (₪)" hint="כפול שעות החודש מטאב השעות">
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              value={String(contract.hourlyRate || "")}
              onChange={(e) => patch({ hourlyRate: n(e.target.value) })}
            />
          </Field>
        ) : (
          <Field
            label={isSalaryOnly(contract.salaryKind) ? "משכורת לחודש (₪)" : "שכר גלובלי לחודש (₪)"}
            hint={isSalaryOnly(contract.salaryKind) ? "רק הסכום הזה נכנס לשכר. בלי בונוסים." : undefined}
          >
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              value={String(contract.globalSalary || "")}
              onChange={(e) => patch({ globalSalary: n(e.target.value) })}
            />
          </Field>
        )}
      </div>

      <div className="space-y-2 rounded-xl bg-background/70 p-3">
        <div>
          <p className="text-sm font-medium">תקרת הפרשה</p>
          <p className="text-[11px] text-muted-foreground">
            ברירת מחדל ₪13,769 כמו אצל כולם. מעל הסכום אין הפרשות לפיצויים, פנסיה / גמל וקרן השתלמות. אפשר לשנות ידנית.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="תקרה לחודש (₪)">
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              value={String(contract.contributionCeiling || "")}
              onChange={(e) => patch({ contributionCeiling: n(e.target.value) })}
            />
          </Field>
          <PercentMoneyField
            label="פיצויים מעסיק (%)"
            percent={contract.severanceEmployerPercent}
            amount={funds.severanceEmployer}
            hint="נוסף לעלות השכר, רק עד התקרה"
            onChange={(severanceEmployerPercent) => patch({ severanceEmployerPercent })}
          />
        </div>
        {funds.overCeiling ? (
          <p className="text-[12px] text-amber-800">
            שכר {formatIls(funds.grossPensionable)} · מבוטח עד {formatIls(funds.pensionable)} ·
            מעל התקרה {formatIls(funds.grossPensionable - funds.pensionable)} בלי הפרשות.
          </p>
        ) : funds.ceiling > 0 && funds.pensionable > 0 ? (
          <p className="text-[12px] text-muted-foreground">
            השכר מתחת לתקרה — הפרשות על {formatIls(funds.pensionable)}.
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl bg-background/70 p-3">
        <div>
          <p className="text-sm font-medium">פנסיה / גמל</p>
          <p className="text-[11px] text-muted-foreground">
            אחוז {usesMonthlySalary(contract.salaryKind) ? "מהמשכורת החודשית" : "משכר + מדרגות"}
            {funds.pensionable > 0
              ? ` (${formatIls(funds.pensionable)}${
                  salesWage > 0 ? ` · כולל מדרגות ${formatIls(salesWage)}` : ""
                }${
                  (contract.salaryKind ?? "hourly") === "hourly" && previewHours > 0
                    ? ` · ${previewHours} שעות אחרונות`
                    : ""
                })`
              : " — אין עדיין שכר לחודש לחישוב הסכום"}
            . הפרשת מעסיק נוספת לעלות השכר, רק עד התקרה. ברירת מחדל 6% עובד ו־6.5% מעסיק — אפשר לשנות ידנית.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { fromFirst: true, label: "מהחודש הראשון" },
              { fromFirst: false, label: "אחרי 3 חודשים" },
            ] as const
          ).map((option) => {
            const selected = (contract.pensionFromFirstMonth !== false) === option.fromFirst;
            return (
              <button
                key={String(option.fromFirst)}
                type="button"
                onClick={() => patch({ pensionFromFirstMonth: option.fromFirst })}
                className={cn(
                  "h-10 rounded-xl px-2 text-sm font-semibold leading-tight",
                  selected ? "bg-black text-white" : "bg-background text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {contract.pensionFromFirstMonth === false ? (
          <p className="text-[11px] text-muted-foreground">
            שלושת חודשי ההסכם הראשונים בלי הפרשת פנסיה / גמל. מהחודש הרביעי משלמים לפי האחוזים.
            {funds.pensionWaiting ? " בחודש התצוגה עדיין אין הפרשה." : ""}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <PercentMoneyField
            label="עובד (%)"
            percent={contract.pensionEmployeePercent}
            amount={funds.pensionEmployee}
            hint="יורד מהברוטו"
            onChange={(pensionEmployeePercent) => patch({ pensionEmployeePercent })}
          />
          <PercentMoneyField
            label="מעסיק (%)"
            percent={contract.pensionEmployerPercent}
            amount={funds.pensionEmployer}
            hint="נוסף לעלות השכר"
            onChange={(pensionEmployerPercent) => patch({ pensionEmployerPercent })}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-background/70 p-3">
        <div>
          <p className="text-sm font-medium">קרן השתלמות</p>
          <p className="text-[11px] text-muted-foreground">
            אותו בסיס כמו פנסיה — שכר + מדרגות, רק עד התקרה. ברירת מחדל 2.5% עובד ו־7.5% מעסיק — אפשר לשנות ידנית.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PercentMoneyField
            label="עובד (%)"
            percent={contract.studyFundEmployeePercent}
            amount={funds.studyFundEmployee}
            hint="יורד מהברוטו"
            onChange={(studyFundEmployeePercent) =>
              patch({
                studyFundEmployeePercent,
                studyFund:
                  studyFundEmployeePercent > 0 || contract.studyFundEmployerPercent > 0,
              })
            }
          />
          <PercentMoneyField
            label="מעסיק (%)"
            percent={contract.studyFundEmployerPercent}
            amount={funds.studyFundEmployer}
            hint="נוסף לעלות השכר"
            onChange={(studyFundEmployerPercent) =>
              patch({
                studyFundEmployerPercent,
                studyFund:
                  contract.studyFundEmployeePercent > 0 || studyFundEmployerPercent > 0,
              })
            }
          />
        </div>
        {funds.employerExtra > 0 ? (
          <p className="text-sm font-semibold">
            הפרשות מעסיק לחודש: {formatIls(funds.employerExtra)}
          </p>
        ) : null}
      </div>

      {(contract.salaryKind ?? "hourly") === "hourly" ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">מדרגות הפקה בפועל — היקף</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg"
            onClick={() =>
              patch({
                productionTiers: [
                  ...contract.productionTiers,
                  { from: 0, to: null, multiplier: 0 },
                ],
              })
            }
          >
            <Plus className="size-3.5" />
            מדרגה
          </Button>
        </div>
        <div className="space-y-2">
          {contract.productionTiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              <Input
                inputMode="decimal"
                className="h-9 rounded-xl tabular-nums"
                placeholder="מ"
                value={String(tier.from || "")}
                onChange={(e) => {
                  const next = contract.productionTiers.map((row, i) =>
                    i === index ? { ...row, from: n(e.target.value) } : row,
                  );
                  patch({ productionTiers: next });
                }}
              />
              <Input
                inputMode="decimal"
                className="h-9 rounded-xl tabular-nums"
                placeholder="עד"
                value={tier.to == null ? "" : String(tier.to)}
                onChange={(e) => {
                  const next = contract.productionTiers.map((row, i) =>
                    i === index
                      ? { ...row, to: e.target.value.trim() === "" ? null : n(e.target.value) }
                      : row,
                  );
                  patch({ productionTiers: next });
                }}
              />
              <DecimalInput
                className="h-9 rounded-xl tabular-nums"
                placeholder="מכפיל"
                value={tier.multiplier}
                onChange={(multiplier) => {
                  const next = contract.productionTiers.map((row, i) =>
                    i === index ? { ...row, multiplier } : row,
                  );
                  patch({ productionTiers: next });
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 text-muted-foreground"
                onClick={() =>
                  patch({
                    productionTiers: contract.productionTiers.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">מ · עד · מכפיל. אפשר מכפיל עשרוני כמו 1.5. השאירו «עד» ריק למדרגה פתוחה.</p>
      </div>
      ) : (
        <p className="rounded-xl bg-background/70 px-3 py-2.5 text-[12px] text-muted-foreground">
          {isSalaryOnly(contract.salaryKind)
            ? "רק משכורת חודשית — אין מדרגות ואין בונוסים על מכירות."
            : "שכר גלובלי לחודש בלבד — אין מדרגות על מכירות."}
        </p>
      )}

      {isSalaryOnly(contract.salaryKind) ? null : (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="נסיעות לחודש (₪)"
          hint="ברירת מחדל ₪300 לכולם. נכנס להיקף בכל חודש עבודה, בנוסף לשכר השעתי או הגלובלי. אפשר לשנות ידנית."
        >
          <Input
            inputMode="decimal"
            className="h-10 rounded-xl tabular-nums"
            value={String(contract.travelAmount || "")}
            onChange={(e) => patch({ travelAmount: n(e.target.value) })}
          />
        </Field>
        {(contract.salaryKind ?? "hourly") === "hourly" ? (
        <Field label="נסיעות — % מהפרמיה" hint="רק על היקף, אם המוצר הוא נסיעות">
          <Input
            inputMode="decimal"
            className="h-10 rounded-xl tabular-nums"
            value={String(contract.travelPercent || "")}
            onChange={(e) => patch({ travelPercent: n(e.target.value) })}
          />
        </Field>
        ) : null}
      </div>
      )}

      <MonthlyCostsFields contract={contract} patch={patch} />
      {isSalaryOnly(contract.salaryKind) ? null : (
        <>
          <VariableExpensesFields contract={contract} patch={patch} />
          <OneTimePaymentsFields contract={contract} patch={patch} />
        </>
      )}
    </section>
  );
}

function MonthlyCostsFields({
  contract,
  patch,
}: {
  contract: EmployeePayContract;
  patch: (partial: Partial<EmployeePayContract>) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl bg-background/70 p-3">
      <div>
        <p className="text-sm font-medium">עלויות חודשיות</p>
        <p className="text-[11px] text-muted-foreground">
          יורדות כל חודש מהשכר, לפי הסכום שתזינו כאן. אפשר להשאיר ריק.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {MONTHLY_COST_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} hint="₪ לחודש">
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              placeholder="0"
              value={String(contract[field.key] || "")}
              onChange={(e) => patch({ [field.key]: n(e.target.value) })}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function VariableExpensesFields({
  contract,
  patch,
}: {
  contract: EmployeePayContract;
  patch: (partial: Partial<EmployeePayContract>) => void;
}) {
  const rows = contract.variableExpenses ?? [];

  function setRows(next: VariableExpense[]) {
    patch({ variableExpenses: next });
  }

  return (
    <div className="space-y-2 rounded-xl bg-background/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">הוצאות משתנות</p>
          <p className="text-[11px] text-muted-foreground">
            סכום שמוסיפים מהחברה (מענק, תוספת וכו'). חובה לכתוב מה זה. אפשר כמה שורות.
            נכנס לשכר החודש, בלי הפרשות פנסיה.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 rounded-lg"
          onClick={() =>
            setRows([
              ...rows,
              { id: crypto.randomUUID(), amount: 0, note: "" },
            ])
          }
        >
          <Plus className="size-3.5" />
          הוצאה
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">אין הוצאות משתנות.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const missingNote = row.amount > 0 && !row.note.trim();
            return (
              <div key={row.id} className="space-y-1">
                <div className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-2">
                  <Input
                    inputMode="decimal"
                    className="h-9 rounded-xl tabular-nums"
                    placeholder="₪"
                    value={String(row.amount || "")}
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === index ? { ...item, amount: n(e.target.value) } : item,
                      );
                      setRows(next);
                    }}
                  />
                  <Input
                    className={cn(
                      "h-9 rounded-xl text-start",
                      missingNote ? "border-amber-400" : "",
                    )}
                    placeholder="חובה: מה זה (למשל תוספת ממני)"
                    value={row.note}
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === index ? { ...item, note: e.target.value } : item,
                      );
                      setRows(next);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 text-muted-foreground"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {missingNote ? (
                  <p className="text-[11px] text-amber-800">חובה לכתוב הערה על הסכום לפני שמירה.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OneTimePaymentsFields({
  contract,
  patch,
}: {
  contract: EmployeePayContract;
  patch: (partial: Partial<EmployeePayContract>) => void;
}) {
  const rows = resolvedOneTimePayments(contract);

  function setRows(next: OneTimePayment[]) {
    patch({ oneTimePayments: next });
  }

  return (
    <div className="space-y-2 rounded-xl bg-background/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">תשלומים חד־פעמיים</p>
          <p className="text-[11px] text-muted-foreground">
            סכום שנכנס לשכר פעם אחת בחודש שנבחר — לא כל חודש. חובה קטגוריה וחודש.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 rounded-lg"
          onClick={() =>
            setRows([
              ...rows,
              {
                id: crypto.randomUUID(),
                amount: 0,
                note: "",
                month: "",
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          חד־פעמי
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">אין תשלומים חד־פעמיים.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const missingNote = row.amount > 0 && !row.note.trim();
            const missingMonth = row.amount > 0 && !/^\d{4}-\d{2}$/.test(row.month);
            return (
              <div key={row.id} className="space-y-1">
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem_auto] items-center gap-2">
                  <Input
                    inputMode="decimal"
                    className="h-9 rounded-xl tabular-nums"
                    placeholder="₪"
                    value={String(row.amount || "")}
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === index ? { ...item, amount: n(e.target.value) } : item,
                      );
                      setRows(next);
                    }}
                  />
                  <Input
                    className={cn(
                      "h-9 rounded-xl text-start",
                      missingNote ? "border-amber-400" : "",
                    )}
                    placeholder="קטגוריה (למשל פער קיזוזים)"
                    value={row.note}
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === index ? { ...item, note: e.target.value } : item,
                      );
                      setRows(next);
                    }}
                  />
                  <Input
                    type="month"
                    className={cn(
                      "h-9 rounded-xl tabular-nums",
                      missingMonth ? "border-amber-400" : "",
                    )}
                    value={row.month}
                    onChange={(e) => {
                      const next = rows.map((item, i) =>
                        i === index ? { ...item, month: e.target.value } : item,
                      );
                      setRows(next);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 text-muted-foreground"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {missingNote || missingMonth ? (
                  <p className="text-[11px] text-amber-800">
                    חובה קטגוריה וחודש לפני שמירה.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    נכנס לשכר רק בחודש שנבחר · חד־פעמי על התקופה
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FreelancerFields({
  contract,
  patch,
}: {
  contract: EmployeePayContract;
  patch: (partial: Partial<EmployeePayContract>) => void;
}) {
  const formula = contract.freelancerFormula || "custom";
  const [explainOpen, setExplainOpen] = useState(false);
  const spec = freelancerSettledSpec(contract);
  const effective = spec?.settledPercent ?? 0;

  return (
    <section className="space-y-3 rounded-2xl border border-black/[0.06] bg-muted/15 p-4">
      <div>
        <h3 className="text-sm font-semibold">הסכם עצמאי</h3>
        <p className="text-[11px] text-muted-foreground">
          עמלת היקף נכנסת בחודש המכירה. בוחרים נוסחה למטה — יש עצמאים בלי נפרעים בכלל.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">נוסחת עצמאי</p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setExplainOpen((open) => !open)}
          >
            <CircleHelp className="size-3.5" />
            מה זה הנוסחה
          </button>
        </div>
        <Select
          value={formula}
          onValueChange={(value) => {
            const next = (value as FreelancerFormula) || "custom";
            if (next === "freelancers_3") {
              patch({
                freelancerFormula: next,
                volumePercent: FREELANCERS_3.volumePercent,
                settledPercent: 0,
              });
              return;
            }
            if (next === "freelancers_4") {
              patch({
                freelancerFormula: next,
                volumePercent: FREELANCERS_4.highVolumePercent,
                settledPercent: FREELANCERS_4.settledPercent,
                oneTimePayments:
                  (contract.oneTimePayments ?? []).length > 0
                    ? contract.oneTimePayments
                    : [
                        {
                          id: crypto.randomUUID(),
                          amount: FREELANCERS_4.oneTimeGap.amount,
                          note: FREELANCERS_4.oneTimeGap.note,
                          month: FREELANCERS_4.oneTimeGap.month,
                        },
                      ],
              });
              return;
            }
            patch({ freelancerFormula: next });
          }}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREELANCER_FORMULA_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {explainOpen || formula === "freelancers_1" || formula === "freelancers_2" || formula === "freelancers_3" || formula === "freelancers_4" ? (
        <div className="space-y-2 rounded-xl border border-black/[0.06] bg-background/80 px-3 py-3 text-[13px] leading-relaxed">
          {formula === "freelancers_4" ? (
            <>
              <p className="font-semibold">עצמאים 4 — אביחי יוסף</p>
              <p>
                היקף לפי <span className="font-medium">מקורות ליבה</span>, תאריך הפקה של אותו חודש.
                מ־{FREELANCERS_4.hubThreshold.toLocaleString("he-IL")} ומעלה → {FREELANCERS_4.highVolumePercent}% מכל הפרמיה.
                מתחת לזה → {FREELANCERS_4.lowVolumePercent}%.
              </p>
              <p>
                ניב לב רן בשם הרגיל נכנס להיקף גם על מקור שמש, כל התקופה. בלי נפרעים על השמש.
              </p>
              <p>
                שאר שמש, כולל דניאל כהן על מקור שמש, רק {FREELANCERS_4.shemeshVolumeFromMonth.split("-").reverse().join("/")}-
                {FREELANCERS_4.shemeshVolumeToMonth.split("-").reverse().join("/")}:{" "}
                {FREELANCERS_4.shemeshWindowRegularAgents.join(" · ")} · {FREELANCERS_4.shemeshVolumeAgents.join(" · ")}.
                מיוני 2026 השם שמש לא נכנס, עד להודעה חדשה.
              </p>
              <p>
                דוגמה: מוקד ₪21,000 → {formatIls(FREELANCERS_4.fixedMonthly)} + {formatIls(21000 * (FREELANCERS_4.highVolumePercent / 100))} = {formatIls(FREELANCERS_4.fixedMonthly + 21000 * (FREELANCERS_4.highVolumePercent / 100))} (בלי נפרעים).
                מוקד ₪19,000 → {formatIls(FREELANCERS_4.fixedMonthly)} + {formatIls(19000 * (FREELANCERS_4.lowVolumePercent / 100))} = {formatIls(FREELANCERS_4.fixedMonthly + 19000 * (FREELANCERS_4.lowVolumePercent / 100))}.
              </p>
              <p>
                שכר קבוע {formatIls(FREELANCERS_4.fixedMonthly)} כל חודש, ועליו כל הנוסחה: היקף + נפרעים.
              </p>
              <p>
                תשלום חד־פעמי {formatIls(FREELANCERS_4.oneTimeGap.amount)} · {FREELANCERS_4.oneTimeGap.note} ·
                חודש {FREELANCERS_4.oneTimeGap.month.split("-").reverse().join("/")} (על כל תקופת העבודה, פעם אחת).
              </p>
              <p>
                נפרעים {FREELANCERS_4.settledPercent}% מכל מכירות ליבה שהופקו, מ־1.1.2026.
                שוטף 60 ונגרר כל עוד הפוליסה פעילה. אין נפרע על מכירות שמש של ניב לב רן, דניאל כהן והשמות עם «שמש».
                העסק מקבל {FREELANCERS_4.companyPercent}% מהפרמיה.
              </p>
            </>
          ) : formula === "freelancers_3" ? (
            <>
              <p className="font-semibold">עצמאים 3 — בן סגל</p>
              <p>
                רק היקף: מכפיל {FREELANCERS_3.volumeMultiplier} על פרמיית מכירה פעילה. אין נפרעים, אין שוטף 60 ואין נגרר.
              </p>
              <p>
                דוגמה: פרמיה ₪1,000 → {formatIls(1000 * FREELANCERS_3.volumeMultiplier)} בחודש המכירה.
              </p>
            </>
          ) : formula === "freelancers_2" ? (
            <>
              <p className="font-semibold">נפרעים 2 — עצמאים 2</p>
              <p>
                כמו עצמאים 1: רק על <span className="font-medium">מכירות שהופקו</span> (סוג תהליך מכירה, פעילה). לא על מינוי סוכן.
              </p>
              <p>
                העצמאי מקבל {FREELANCERS_2.settledPercent}% מהפרמיה (במקום 11%).
              </p>
              <p>
                דוגמה: פרמיה ₪300 → {formatIls(Math.round((300 * FREELANCERS_2.settledPercent) / 100))} לעצמאי.
              </p>
              <p>
                התשלום מתחיל <span className="font-medium">שוטף 60</span> — חודש המכירה +{" "}
                {FREELANCERS_2.payDelayMonths} חודשים. מכירה בינואר משתלמת ממרץ, לא באותו חודש.
              </p>
              <p>
                כל עוד הפוליסה פעילה, הנפרע <span className="font-medium">נגרר</span> לחודשים הבאים.
                ביטול מפסיק את הנגרר.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">נפרעים 1 — עצמאים 1</p>
              <p>
                רק על <span className="font-medium">מכירות שהופקו</span> (סוג תהליך מכירה, פעילה). לא על מינוי סוכן.
              </p>
              <p>
                העסק מקבל {FREELANCERS_1.companyPercent}% מהפרמיה כנפרע שוטף. העצמאי מקבל{" "}
                {FREELANCERS_1.sharePercent}% מזה → {FREELANCERS_1.settledPercent}% מהפרמיה.
              </p>
              <p>
                דוגמה: פרמיה ₪300 → לעסק ₪66 → {formatIls(33)} לעצמאי ו־{formatIls(33)} נשארים לעסק.
              </p>
              <p>
                התשלום מתחיל <span className="font-medium">שוטף 60</span> — חודש המכירה +{" "}
                {FREELANCERS_1.payDelayMonths} חודשים. מכירה בינואר משתלמת ממרץ, לא באותו חודש.
              </p>
              <p>
                כל עוד הפוליסה פעילה, הנפרע <span className="font-medium">נגרר</span> לחודשים הבאים.
                מרץ ₪300 ואפריל ₪500 חדש → אפריל = ₪300 נגרר + ₪500 חדש. ביטול מפסיק את הנגרר.
              </p>
            </>
          )}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {formula === "freelancers_4" ? (
          <Field label="עמלת היקף" hint="ליבה תמיד · ניב לב רן גם על שמש כל התקופה · שאר שמש עד מאי 2026">
            <div className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm font-semibold tabular-nums">
              {FREELANCERS_4.lowVolumePercent}% / {FREELANCERS_4.highVolumePercent}% מ־
              {FREELANCERS_4.hubThreshold.toLocaleString("he-IL")}+
            </div>
          </Field>
        ) : formula === "freelancers_3" ? (
          <Field label="עמלת היקף" hint="מכפיל 7 מהפרמיה, על מכירה בלבד, בחודש המכירה">
            <div className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm font-semibold tabular-nums">
              מכפיל {FREELANCERS_3.volumeMultiplier} · {FREELANCERS_3.volumePercent}%
            </div>
          </Field>
        ) : (
          <Field label="עמלת היקף (%)" hint="למשל 550 = פי 5.5 מהפרמיה, על מכירה בלבד, בחודש המכירה">
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              value={String(contract.volumePercent || "")}
              onChange={(e) => patch({ volumePercent: n(e.target.value) })}
            />
          </Field>
        )}
        {formula === "freelancers_3" ? (
          <Field label="נפרעים" hint="הנוסחה בלי נפרעים בכלל">
            <div className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm font-semibold">
              אין נפרעים
            </div>
          </Field>
        ) : formula === "custom" ? (
          <Field label="עמלת נפרעים (%)" hint="למשל 42, על מינוי סוכן בלבד, בחודש ההפקה">
            <Input
              inputMode="decimal"
              className="h-10 rounded-xl tabular-nums"
              value={String(contract.settledPercent || "")}
              onChange={(e) => patch({ settledPercent: n(e.target.value) })}
            />
          </Field>
        ) : (
          <Field label={spec?.label ?? "נפרעים"} hint={`שוטף 60 · ${effective}% · נגרר כל עוד פעיל`}>
            <div className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm font-semibold tabular-nums">
              {effective}%
            </div>
          </Field>
        )}
        {formula === "freelancers_4" ? (
          <Field label="שכר קבוע" hint="כל חודש, ועליו היקף ונפרעים">
            <div className="flex h-10 items-center rounded-xl bg-muted px-3 text-sm font-semibold tabular-nums">
              {formatIls(FREELANCERS_4.fixedMonthly)}
            </div>
          </Field>
        ) : null}
      </div>
      <MonthlyCostsFields contract={contract} patch={patch} />
      <VariableExpensesFields contract={contract} patch={patch} />
      <OneTimePaymentsFields contract={contract} patch={patch} />
    </section>
  );
}

function UnpaidFields() {
  return (
    <section className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
      <h3 className="text-sm font-semibold">ללא שכר — רווח נקי לחברה</h3>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        בתקופה הזו אין הוצאת שכר בדוח היקף ובדוח נפרעים. הפרמיה שנסגרה נשארת
        הכנסה, בלי מכפיל שכר ובלי עמלות. זה רווח ישיר לחברה.
      </p>
    </section>
  );
}

export function employmentKindLabel(kind: EmploymentKind | null): string | null {
  if (kind === "salaried") return "שכיר";
  if (kind === "freelancer") return "עצמאי";
  if (kind === "unpaid") return "ללא שכר";
  return null;
}
