"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_OTHER_CATEGORY,
  customSupplierCategories,
  isFinanceOk,
  resolveSupplierCategory,
  type FinanceEmployee,
  type FinanceSupplier,
} from "@/lib/finance/categories";
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

export function EmployeesSection({
  employees,
  onChanged,
}: {
  employees: FinanceEmployee[];
  onChanged: (next: FinanceEmployee[]) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [
        e.full_name,
        e.department ?? "",
        e.short_dial ?? "",
        e.direct_phone ?? "",
        e.wait_circle ?? "",
        e.sim_provider ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [employees, query]);

  const byCircle = useMemo(() => {
    const map = new Map<string, FinanceEmployee[]>();
    for (const e of filtered) {
      const key = e.wait_circle?.trim() || "ללא מעגל";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="app-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עובד לפי שם, מחלקה, חיוג או טלפון…"
            className="h-10 rounded-xl ps-10 text-start"
          />
        </div>
        <EmployeeDialog
          mode="create"
          disabled={pending}
          onSaved={(row) => {
            onChanged([row, ...employees.filter((e) => e.id !== row.id)]);
            router.refresh();
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="app-surface px-5 py-10 text-center text-sm text-muted-foreground">
          אין עובדים להצגה.
        </p>
      ) : (
        byCircle.map(([circle, rows]) => (
          <div key={circle} className="space-y-2">
            <h3 className="px-1 text-sm font-semibold">
              {circle} · {rows.length}
            </h3>
            <div className="grid gap-2">
              {rows.map((emp) => (
                <article
                  key={emp.id}
                  className="app-surface flex flex-wrap items-start justify-between gap-3 border-2 border-black px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">{emp.full_name}</h4>
                      {emp.department ? (
                        <span className="rounded-md bg-highlight/35 px-2 py-0.5 text-[11px]">
                          {emp.department}
                        </span>
                      ) : null}
                      {emp.short_dial ? (
                        <span className="rounded-md bg-background px-2 py-0.5 text-[11px] tabular-nums">
                          חיוג {emp.short_dial}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[
                        emp.direct_phone,
                        emp.outbound_number
                          ? `יוצאות ${emp.outbound_number}`
                          : null,
                        emp.sim_provider,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "אין פרטי טלפון"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <EmployeeDialog
                      mode="edit"
                      employee={emp}
                      disabled={pending}
                      onSaved={(row) => {
                        onChanged(
                          employees.map((e) => (e.id === row.id ? row : e)),
                        );
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
                        if (!window.confirm(`למחוק את ${emp.full_name}?`)) return;
                        startTransition(async () => {
                          const result = await deleteFinanceEmployee(emp.id);
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          onChanged(employees.filter((e) => e.id !== emp.id));
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
        ))
      )}
    </div>
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
          <Button className="h-10 shrink-0 gap-2 rounded-xl" disabled={disabled}>
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
    if (resolved.error) {
      toast.error(resolved.error);
      return;
    }
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
          category: resolved.category,
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
        category: resolved.category,
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
