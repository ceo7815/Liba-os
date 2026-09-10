"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createFinanceEmployee,
  createFinanceSupplier,
  deleteFinanceEmployee,
  deleteFinanceSupplier,
  updateFinanceEmployee,
  updateFinanceSupplier,
} from "@/app/actions/finance-people";
import { EmployeeCardDialog, employmentKindLabel } from "@/components/employees/employee-card-dialog";
import { ProductionLeadersPanel } from "@/components/employees/production-leaders";
import type { EmployeeHoursRow } from "@/lib/employees/hours";
import {
  agreementForDate,
  emptyPayContract,
  todayIso,
  type ContractWageTotal,
  wageTotalForEmployeeContract,
} from "@/lib/employees/contract";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_OTHER_CATEGORY,
  customSupplierCategories,
  isFinanceOk,
  resolveSupplierCategory,
  type FinanceEmployee,
  type FinanceSupplier,
} from "@/lib/finance/categories";
import {
  DEFAULT_AGENT_MULTIPLIER,
  formatIls,
  insurerIncome,
  type AgentRate,
} from "@/lib/sales-dashboard/campaign-math";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import {
  displayWaitCircle,
  employeeOperatingBrand,
  matchesOperatingBrand,
} from "@/lib/finance/operating-brand";
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

export function EmployeesSection({
  employees,
  onChanged,
  rates = [],
  defaultMultiplier = DEFAULT_AGENT_MULTIPLIER,
  wageTotals = [],
  wageLoading = false,
  productions = [],
  hours = [],
  onHoursChanged,
  onRatesChanged,
}: {
  employees: FinanceEmployee[];
  onChanged: (next: FinanceEmployee[]) => void;
  rates?: AgentRate[];
  defaultMultiplier?: number;
  wageTotals?: ContractWageTotal[];
  wageLoading?: boolean;
  productions?: MarketingProduction[];
  hours?: EmployeeHoursRow[];
  onHoursChanged?: () => void;
  onRatesChanged?: () => void;
}) {
  const router = useRouter();
  const { brand } = useOperatingBrand();
  const [query, setQuery] = useState("");
  const [listTab, setListTab] = useState<"premium" | "hidden">("premium");
  const [pending, startTransition] = useTransition();
  const [spotlightEmp, setSpotlightEmp] = useState<FinanceEmployee | null>(null);

  const branded = useMemo(
    () =>
      employees.filter((e) =>
        matchesOperatingBrand(
          employeeOperatingBrand({
            fullName: e.full_name,
            waitCircle: e.wait_circle,
            notes: e.notes,
          }),
          brand,
        ),
      ),
    [employees, brand],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branded;
    return branded.filter((e) =>
      [
        e.full_name,
        e.department ?? "",
        e.short_dial ?? "",
        e.direct_phone ?? "",
        e.outbound_number ?? "",
        e.email ?? "",
        e.wait_circle ?? "",
        e.sim_provider ?? "",
        e.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [branded, query]);

  const withPremium = useMemo(() => {
    if (wageLoading) return filtered;
    return filtered.filter(
      (emp) => wageTotalForEmployeeContract(emp.full_name, wageTotals).premium > 0,
    );
  }, [filtered, wageLoading, wageTotals]);

  const hidden = useMemo(() => {
    if (wageLoading) return [];
    return filtered.filter(
      (emp) => wageTotalForEmployeeContract(emp.full_name, wageTotals).premium <= 0,
    );
  }, [filtered, wageLoading, wageTotals]);

  const visible = listTab === "hidden" ? hidden : withPremium;

  const byCircle = useMemo(() => {
    const map = new Map<string, FinanceEmployee[]>();
    for (const e of visible) {
      const key = displayWaitCircle(e.wait_circle);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const emptyMessage =
    filtered.length === 0
      ? "אין עובדים להצגה."
      : listTab === "hidden"
        ? "אין עובדים מוסתרים."
        : wageLoading
          ? "טוען פרמיה מהסנכרון…"
          : "אין עובדים שהנפיקו פרמיה. מי שלא הנפיק נמצא בטאב «מוסתרים».";

  return (
    <div className="space-y-3 sm:space-y-4">
      <ProductionLeadersPanel
        employees={branded}
        productions={productions}
        loading={wageLoading}
        onOpenEmployee={setSpotlightEmp}
      />

      <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:p-5">
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="תצוגת עובדים">
          {(
            [
              { id: "premium" as const, label: "עם פרמיה", count: withPremium.length },
              { id: "hidden" as const, label: "מוסתרים", count: hidden.length },
            ] as const
          ).map((tab) => {
            const selected = listTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setListTab(tab.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
                  selected && tab.id === "premium" && "bg-black text-white",
                  selected && tab.id === "hidden" && "bg-zinc-600 text-white",
                  !selected && "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {tab.label}
                <span className="ms-1.5 tabular-nums opacity-80">{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש עובד לפי שם, מחלקה, חיוג או טלפון…"
              className="h-11 rounded-2xl border-black/[0.06] bg-background ps-10 text-start focus-visible:ring-highlight/40 sm:h-10 sm:rounded-xl"
            />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-12 text-center shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)]">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        byCircle.map(([circle, rows]) => (
          <div key={circle} className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h3 className="text-sm font-semibold tracking-tight">{circle}</h3>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {rows.length} עובדים
              </p>
            </div>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((emp) => (
                <EmployeeCube
                  key={emp.id}
                  emp={emp}
                  employees={employees}
                  pending={pending}
                  startTransition={startTransition}
                  wage={wageTotalForEmployeeContract(emp.full_name, wageTotals)}
                  wageLoading={wageLoading}
                  productions={productions}
                  hours={hours}
                  onHoursChanged={onHoursChanged}
                  rates={rates}
                  defaultMultiplier={defaultMultiplier}
                  onChanged={onChanged}
                  onRatesChanged={onRatesChanged}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {spotlightEmp ? (
        <EmployeeCardDialog
          emp={spotlightEmp}
          open
          onOpenChange={(open) => {
            if (!open) setSpotlightEmp(null);
          }}
          productions={productions}
          hours={hours}
          onHoursChanged={onHoursChanged}
          rates={rates}
          defaultMultiplier={defaultMultiplier}
          onSaved={(saved) => {
            onChanged(employees.map((row) => (row.id === saved.id ? saved : row)));
            setSpotlightEmp(saved);
            onRatesChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function employeeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ע";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

function CubeMeta({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-end font-medium tabular-nums">{value}</span>
    </div>
  );
}

function agreementStatusLine(emp: FinanceEmployee): { text: string; active: boolean } {
  const live = agreementForDate(emp.agreements ?? [], todayIso());
  if (!live) {
    return {
      text: emp.agreements?.length ? "אין הסכם בתוקף" : "אין הסכם",
      active: false,
    };
  }
  if (live.to) {
    const end = live.to.split("-").reverse().join(".");
    return { text: `בתוקף עד ${end}`, active: true };
  }
  return { text: "בתוקף", active: true };
}

function EmployeeCube({
  emp,
  employees,
  pending,
  startTransition,
  wage,
  wageLoading,
  productions,
  hours,
  onHoursChanged,
  rates,
  defaultMultiplier,
  onChanged,
  onRatesChanged,
}: {
  emp: FinanceEmployee;
  employees: FinanceEmployee[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  wage: ContractWageTotal;
  wageLoading: boolean;
  productions: MarketingProduction[];
  hours: EmployeeHoursRow[];
  onHoursChanged?: () => void;
  rates: AgentRate[];
  defaultMultiplier: number;
  onChanged: (next: FinanceEmployee[]) => void;
  onRatesChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const kindLabel = employmentKindLabel(emp.employment_kind);
  const agreement = agreementStatusLine(emp);
  const circle = displayWaitCircle(emp.wait_circle);
  const roleLine = [emp.department, circle !== "ללא מעגל" ? circle : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex flex-col items-stretch gap-4 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-5 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-[transform,background-color,border-color] active:scale-[0.985] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)]"
      >
        <span className="absolute inset-y-0 start-0 w-1 origin-top scale-y-100 bg-highlight transition-transform duration-300 group-hover:scale-y-110" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-highlight/35 text-sm font-bold">
              {employeeInitials(emp.full_name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold leading-snug tracking-tight">
                {emp.full_name}
              </h2>
              {roleLine ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{roleLine}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {kindLabel ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  emp.employment_kind === "unpaid"
                    ? "bg-emerald-700 text-white"
                    : "bg-black text-white",
                )}
              >
                {kindLabel}
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                למלא הסכם
              </span>
            )}
            <ChevronLeft className="size-4 text-black/25 transition-transform group-hover:-translate-x-0.5" />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            {emp.employment_kind === "unpaid" ? "רווח לחברה · מהסנכרון" : "שכר מצטבר · מהסנכרון"}
          </p>
          <p className="mt-1 text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-2xl">
            {wageLoading
              ? "…"
              : emp.employment_kind === "unpaid"
                ? formatIls(insurerIncome(wage.premium))
                : formatIls(wage.earned)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {wageLoading
              ? "טוען סגירות…"
              : emp.employment_kind === "unpaid"
                ? `שכר ₪0 · ${wage.volumeCount + wage.settledCount} סגירות · פרמיה ${formatIls(wage.premium)}`
                : `${wage.volumeCount + wage.settledCount} סגירות · פרמיה ${formatIls(wage.premium)}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06]">
          <div className="bg-white px-3 py-2.5 text-start">
            <p className="text-[11px] text-muted-foreground">היקף</p>
            <p className="mt-1 text-sm font-semibold tabular-nums tracking-tight">
              {wageLoading ? "…" : formatIls(wage.volumeWage)}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {wage.volumeCount} סגירות
              {wage.volumeWage > 0 && emp.employment_kind === "freelancer"
                ? " · קבוע/חד־פעמי"
                : ""}
            </p>
          </div>
          <div className="bg-white px-3 py-2.5 text-start">
            <p className="text-[11px] text-muted-foreground">נפרעים</p>
            <p className="mt-1 text-sm font-semibold tabular-nums tracking-tight">
              {wageLoading
                ? "…"
                : emp.employment_kind === "salaried"
                  ? formatIls(0)
                  : formatIls(wage.settledWage)}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              {emp.employment_kind === "salaried"
                ? "שכיר בלי נפרעים"
                : `${wage.settledCount} סגירות`}
            </p>
          </div>
        </div>

        <div className="mt-auto space-y-1.5 border-t border-black/[0.06] pt-3">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="shrink-0 text-muted-foreground">הסכם</span>
            <span
              className={cn(
                "min-w-0 truncate text-end font-medium",
                agreement.active ? "text-foreground" : "text-amber-800",
              )}
            >
              {agreement.text}
            </span>
          </div>
          <CubeMeta label="חיוג מקוצר" value={emp.short_dial} />
        </div>
      </button>

      <EmployeeCardDialog
        emp={emp}
        open={open}
        onOpenChange={setOpen}
        productions={productions}
        hours={hours}
        onHoursChanged={onHoursChanged}
        rates={rates}
        defaultMultiplier={defaultMultiplier}
        onSaved={(row) => {
          onChanged(employees.map((e) => (e.id === row.id ? row : e)));
          onRatesChanged?.();
        }}
        contactEditor={
          <EmployeeDialog
            mode="edit"
            employee={emp}
            disabled={pending}
            onSaved={(row) => {
              onChanged(employees.map((e) => (e.id === row.id ? row : e)));
            }}
          />
        }
        onDelete={() => {
          if (!window.confirm(`למחוק את ${emp.full_name}?`)) return;
          startTransition(async () => {
            const result = await deleteFinanceEmployee(emp.id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            onChanged(employees.filter((e) => e.id !== emp.id));
            toast.success("נמחק");
            setOpen(false);
          });
        }}
      />
    </>
  );
}

export function QuickAddEmployee({
  onCreated,
  disabled,
}: {
  onCreated: (row: FinanceEmployee) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim()) {
      toast.error("חובה למלא שם");
      return;
    }
    startTransition(async () => {
      const result = await createFinanceEmployee({
        full_name: name,
        department,
      });
      if (!isFinanceOk(result)) {
        toast.error(result.error);
        return;
      }
      toast.success("העובד נוסף");
      onCreated({
        id: result.id,
        full_name: name.trim(),
        department: department.trim() || null,
        short_dial: null,
        email: null,
        direct_phone: null,
        outbound_number: null,
        sim_provider: null,
        wait_circle: null,
        dialer_type: null,
        notes: null,
        is_active: true,
        created_at: new Date().toISOString(),
        employment_kind: null,
        pay_contract: emptyPayContract(),
        agreements: [],
      });
      setName("");
      setDepartment("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0 rounded-xl"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        עובד חדש
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-black/15 bg-background/80 p-3">
      <p className="text-xs text-muted-foreground">הוספת עובד ידנית</p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        placeholder="שם מלא"
        className="h-10 rounded-xl text-start"
        autoFocus
      />
      <Input
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        placeholder="מחלקה (לא חובה)"
        className="h-10 rounded-xl text-start"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          className="h-9 rounded-xl"
          disabled={pending || !name.trim()}
          onClick={save}
        >
          {pending ? "שומר…" : "הוספה"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-xl"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}

function EmployeeDialog({
  mode,
  employee,
  disabled,
  onSaved,
}: {
  mode: "create" | "edit";
  employee?: FinanceEmployee;
  disabled?: boolean;
  onSaved: (row: FinanceEmployee) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: employee?.full_name ?? "",
    department: employee?.department ?? "",
    short_dial: employee?.short_dial ?? "",
    email: employee?.email ?? "",
    direct_phone: employee?.direct_phone ?? "",
    outbound_number: employee?.outbound_number ?? "",
    sim_provider: employee?.sim_provider ?? "",
    wait_circle: employee?.wait_circle ?? "",
    dialer_type: employee?.dialer_type ?? "חייגן מהמחשב",
    notes: employee?.notes ?? "",
  });

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setForm({
        full_name: employee?.full_name ?? "",
        department: employee?.department ?? "",
        short_dial: employee?.short_dial ?? "",
        email: employee?.email ?? "",
        direct_phone: employee?.direct_phone ?? "",
        outbound_number: employee?.outbound_number ?? "",
        sim_provider: employee?.sim_provider ?? "",
        wait_circle: employee?.wait_circle ?? "",
        dialer_type: employee?.dialer_type ?? "חייגן מהמחשב",
        notes: employee?.notes ?? "",
      });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (mode === "create") {
        const result = await createFinanceEmployee(form);
        if (!isFinanceOk(result)) {
          toast.error(result.error);
          return;
        }
        toast.success("העובד נוסף");
        onSaved({
          id: result.id,
          ...form,
          department: form.department || null,
          short_dial: form.short_dial || null,
          email: form.email || null,
          direct_phone: form.direct_phone || null,
          outbound_number: form.outbound_number || null,
          sim_provider: form.sim_provider || null,
          wait_circle: form.wait_circle || null,
          dialer_type: form.dialer_type || null,
          notes: form.notes || null,
          is_active: true,
          created_at: new Date().toISOString(),
          employment_kind: null,
          pay_contract: emptyPayContract(),
          agreements: [],
        });
        setOpen(false);
        return;
      }
      const result = await updateFinanceEmployee({ id: employee!.id, ...form });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("עודכן");
      onSaved({
        ...employee!,
        ...form,
        department: form.department || null,
        short_dial: form.short_dial || null,
        email: form.email || null,
        direct_phone: form.direct_phone || null,
        outbound_number: form.outbound_number || null,
        sim_provider: form.sim_provider || null,
        wait_circle: form.wait_circle || null,
        dialer_type: form.dialer_type || null,
        notes: form.notes || null,
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="h-11 shrink-0 gap-2 rounded-2xl active:scale-95 sm:h-10 sm:rounded-xl" disabled={disabled}>
            <Plus className="size-4" />
            הוספת עובד
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 rounded-lg" disabled={disabled}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl text-start sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>{mode === "create" ? "עובד חדש" : "עריכת עובד"}</DialogTitle>
          <DialogDescription>פרטי עובד לשיבוץ משכורות והוצאות.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" dir="rtl">
          <Field label="שם מלא">
            <Input
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="מחלקה">
              <Input
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="rounded-xl text-start"
                placeholder="מכירות / תפעול"
              />
            </Field>
            <Field label="חיוג מקוצר">
              <Input
                value={form.short_dial}
                onChange={(e) => setForm((f) => ({ ...f, short_dial: e.target.value }))}
                className="rounded-xl text-start"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="מספר ישיר">
              <Input
                value={form.direct_phone}
                onChange={(e) => setForm((f) => ({ ...f, direct_phone: e.target.value }))}
                className="rounded-xl text-start"
              />
            </Field>
            <Field label="מספר יוצאות">
              <Input
                value={form.outbound_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outbound_number: e.target.value }))
                }
                className="rounded-xl text-start"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="מעגל המתנה">
              <Input
                value={form.wait_circle}
                onChange={(e) => setForm((f) => ({ ...f, wait_circle: e.target.value }))}
                className="rounded-xl text-start"
                placeholder="ליבה / שמש"
              />
            </Field>
            <Field label="ספק סים">
              <Input
                value={form.sim_provider}
                onChange={(e) => setForm((f) => ({ ...f, sim_provider: e.target.value }))}
                className="rounded-xl text-start"
              />
            </Field>
          </div>
          <Field label="אימייל">
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <Field label="הערות">
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-[7rem] rounded-xl font-semibold"
              onClick={() => reset(false)}
            >
              סגירה
            </Button>
            <Button type="submit" className="h-11 min-w-[7.5rem] rounded-xl font-semibold" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SuppliersSection({
  suppliers,
  onChanged,
}: {
  suppliers: FinanceSupplier[];
  onChanged: (next: FinanceSupplier[]) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const extraCategories = useMemo(
    () => customSupplierCategories(suppliers),
    [suppliers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.category ?? "", s.phone ?? "", s.contact_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [suppliers, query]);

  const byCategory = useMemo(() => {
    const map = new Map<string, FinanceSupplier[]>();
    for (const supplier of filtered) {
      const key = supplier.category?.trim() || "ללא קטגוריה";
      const list = map.get(key) ?? [];
      list.push(supplier);
      map.set(key, list);
    }
    const presetOrder = SUPPLIER_CATEGORIES.filter(
      (c) => c !== SUPPLIER_OTHER_CATEGORY,
    );
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "ללא קטגוריה") return 1;
      if (b === "ללא קטגוריה") return -1;
      const ai = presetOrder.indexOf(a as (typeof presetOrder)[number]);
      const bi = presetOrder.indexOf(b as (typeof presetOrder)[number]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b, "he");
    });
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="app-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש ספק לפי שם, קטגוריה או טלפון…"
            className="h-10 rounded-xl ps-10 text-start"
          />
        </div>
        <SupplierDialog
          mode="create"
          extraCategories={extraCategories}
          disabled={pending}
          onSaved={(row) => {
            onChanged([row, ...suppliers.filter((s) => s.id !== row.id)]);
            router.refresh();
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="app-surface px-5 py-14 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-highlight/30">
            <Users className="size-5" />
          </span>
          <p className="mt-4 text-sm font-semibold">אין ספקים עדיין</p>
          <p className="mt-1 text-xs text-muted-foreground">
            הוסיפו ספקי אינטרנט, טלפוניה, שכירות, תוכנה ועוד.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {byCategory.map(([category, rows]) => (
            <div key={category} className="space-y-2">
              <h3 className="px-1 text-sm font-semibold">
                {category} · {rows.length}
              </h3>
              <div className="grid gap-2">
                {rows.map((s) => (
            <article
              key={s.id}
              className="app-surface flex flex-wrap items-start justify-between gap-3 border-2 border-black px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">{s.name}</h4>
                  {s.category ? (
                    <span className="rounded-md bg-highlight/35 px-2 py-0.5 text-[11px]">
                      {s.category}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") ||
                    "אין פרטי קשר"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <SupplierDialog
                  mode="edit"
                  supplier={s}
                  extraCategories={extraCategories}
                  disabled={pending}
                  onSaved={(row) => {
                    onChanged(suppliers.map((x) => (x.id === row.id ? row : x)));
                    router.refresh();
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-700"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`למחוק את הספק ${s.name}?`)) return;
                    startTransition(async () => {
                      const result = await deleteFinanceSupplier(s.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      onChanged(suppliers.filter((x) => x.id !== s.id));
                      toast.success("נמחק");
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function supplierFormState(
  supplier?: FinanceSupplier,
  extraCategories: string[] = [],
) {
  const stored = supplier?.category?.trim() || "";
  const known = new Set<string>([...SUPPLIER_CATEGORIES, ...extraCategories]);
  const isCustomOther =
    stored === SUPPLIER_OTHER_CATEGORY || (stored.length > 0 && !known.has(stored));
  return {
    name: supplier?.name ?? "",
    category: isCustomOther ? SUPPLIER_OTHER_CATEGORY : stored,
    customCategory: isCustomOther && stored !== SUPPLIER_OTHER_CATEGORY ? stored : "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    contact_name: supplier?.contact_name ?? "",
    notes: supplier?.notes ?? "",
  };
}

function SupplierDialog({
  mode,
  supplier,
  extraCategories = [],
  disabled,
  onSaved,
}: {
  mode: "create" | "edit";
  supplier?: FinanceSupplier;
  extraCategories?: string[];
  disabled?: boolean;
  onSaved: (row: FinanceSupplier) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() =>
    supplierFormState(supplier, extraCategories),
  );

  function reset(next: boolean) {
    setOpen(next);
    if (next) setForm(supplierFormState(supplier, extraCategories));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const resolved = resolveSupplierCategory({
      category: form.category,
      customCategory: form.customCategory,
    });
    if (resolved.error !== null) {
      toast.error(resolved.error);
      return;
    }
    const supplierCategory = resolved.category;
    const payload = {
      name: form.name,
      category: form.category,
      customCategory: form.customCategory,
      phone: form.phone,
      email: form.email,
      contact_name: form.contact_name,
      notes: form.notes,
    };
    startTransition(async () => {
      if (mode === "create") {
        const result = await createFinanceSupplier(payload);
        if (!isFinanceOk(result)) {
          toast.error(result.error);
          return;
        }
        toast.success("הספק נוסף");
        onSaved({
          id: result.id,
          name: form.name.trim(),
          category: supplierCategory,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          contact_name: form.contact_name.trim() || null,
          notes: form.notes.trim() || null,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        setOpen(false);
        return;
      }
      const result = await updateFinanceSupplier({
        id: supplier!.id,
        ...payload,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("עודכן");
      onSaved({
        ...supplier!,
        name: form.name.trim(),
        category: supplierCategory,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        contact_name: form.contact_name.trim() || null,
        notes: form.notes.trim() || null,
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="h-10 shrink-0 gap-2 rounded-xl" disabled={disabled}>
            <Plus className="size-4" />
            הוספת ספק
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 rounded-lg" disabled={disabled}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl text-start sm:max-w-md" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>{mode === "create" ? "ספק חדש" : "עריכת ספק"}</DialogTitle>
          <DialogDescription>ספקים להוצאות: אינטרנט, טלפון, שכירות, תוכנה ועוד.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" dir="rtl">
          <Field label="שם הספק">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <Field label="קטגוריה">
            <Select
              value={form.category || "none"}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  category: v === "none" ? "" : v,
                  customCategory:
                    v === SUPPLIER_OTHER_CATEGORY ? f.customCategory : "",
                }))
              }
            >
              <SelectTrigger className="rounded-xl text-start" dir="rtl">
                <SelectValue placeholder="בחירה" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="none">ללא</SelectItem>
                {SUPPLIER_CATEGORIES.filter(
                  (c) => c !== SUPPLIER_OTHER_CATEGORY,
                ).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                {extraCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value={SUPPLIER_OTHER_CATEGORY}>אחר</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.category === SUPPLIER_OTHER_CATEGORY ? (
            <Field label="שם הקטגוריה">
              <Input
                required
                value={form.customCategory}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customCategory: e.target.value }))
                }
                className="rounded-xl text-start"
                placeholder="למשל: ניקיון / ביטוח רכב / קפה"
              />
            </Field>
          ) : null}
          <Field label="איש קשר">
            <Input
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="טלפון">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="rounded-xl text-start"
              />
            </Field>
            <Field label="אימייל">
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl text-start"
              />
            </Field>
          </div>
          <Field label="הערות">
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="rounded-xl text-start"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" className="rounded-xl" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="block text-start">{label}</Label>
      {children}
    </div>
  );
}
