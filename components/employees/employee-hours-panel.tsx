"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  importEmployeeHoursFromExcel,
  listEmployeeHours,
  saveEmployeeMonthHours,
} from "@/app/actions/finance-employee-hours";
import {
  attendanceDaysWorked,
  countVacationDays,
  formatHoursClock,
  formatIsoDay,
  hoursTemplateWorkbook,
  isVacationEvent,
  type AttendanceDay,
  type EmployeeHoursRow,
} from "@/lib/employees/hours";
import { monthLabel } from "@/lib/employees/review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function downloadTemplate() {
  const bytes = hoursTemplateWorkbook();
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "תבנית-שעות-עובדים.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export function HoursTemplateButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11 rounded-xl font-semibold"}
      onClick={downloadTemplate}
    >
      הורדת תבנית
    </Button>
  );
}

export function HoursExcelButton({
  employeeId,
  onImported,
  label = "העלאת דוח נוכחות",
  className,
}: {
  employeeId?: string;
  onImported: () => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    if (employeeId) data.set("employeeId", employeeId);
    startTransition(() => {
      void importEmployeeHoursFromExcel(data).then((result) => {
        if (result.error) {
          toast.error(result.error);
          if (result.unmatched.length > 0) {
            toast.message(`לא זוהו: ${result.unmatched.slice(0, 6).join(", ")}`);
          }
          return;
        }
        toast.success(
          `עודכנו ${result.updated} חודשי שעות${result.months.length ? ` · ${result.months.join(", ")}` : ""}`,
        );
        if (result.assignedName) {
          toast.message(`הדוח של «${result.assignedName}» שויך לכרטיס הזה`);
        }
        onImported();
      });
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        className={className ?? "h-11 rounded-xl font-semibold"}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? "מייבא נוכחות…" : label}
      </Button>
    </>
  );
}

function DayRow({ day }: { day: AttendanceDay }) {
  const vacation = isVacationEvent(day.event);
  const worked = day.paidHours > 0 || Boolean(day.clockIn);
  return (
    <tr className={cn("border-t border-black/[0.04]", vacation ? "bg-amber-50" : !worked && "text-muted-foreground")}>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatIsoDay(day.date)}</td>
      <td className="whitespace-nowrap px-3 py-1.5">{day.label}</td>
      <td className="whitespace-nowrap px-3 py-1.5">{day.kind || "—"}</td>
      <td className="whitespace-nowrap px-3 py-1.5">{day.event || "—"}</td>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{day.clockIn || "—"}</td>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{day.clockOut || "—"}</td>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
        {day.totalHours > 0 ? formatHoursClock(day.totalHours) : "—"}
      </td>
      <td className={cn("whitespace-nowrap px-3 py-1.5 tabular-nums", worked && "font-medium")}>
        {day.paidHours > 0 ? formatHoursClock(day.paidHours) : "—"}
      </td>
    </tr>
  );
}

export function EmployeeHoursPanel({
  employeeId,
  hours,
  onChanged,
}: {
  employeeId: string;
  hours: EmployeeHoursRow[];
  onChanged: () => void;
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [fresh, setFresh] = useState<EmployeeHoursRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  function reloadMine() {
    setLoading(true);
    return listEmployeeHours(employeeId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        setFresh([]);
      } else {
        setFresh(result.hours);
      }
      setLoading(false);
    });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listEmployeeHours(employeeId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
        setFresh([]);
      } else {
        setFresh(result.hours);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const mine = useMemo(
    () => (fresh ?? hours).filter((row) => row.employeeId === employeeId),
    [employeeId, fresh, hours],
  );
  const totalHours = mine.reduce((sum, row) => sum + row.hours, 0);
  const workDays = mine.reduce((sum, row) => sum + attendanceDaysWorked(row.days), 0);
  const vacationDays = mine.reduce((sum, row) => sum + countVacationDays(row.days), 0);

  function save() {
    const hoursNumber = Number(String(value).replace(",", "."));
    if (!month || !Number.isFinite(hoursNumber)) {
      toast.error("מלאו חודש ושעות");
      return;
    }
    startTransition(() => {
      void saveEmployeeMonthHours({
        employeeId,
        month,
        hours: hoursNumber,
      }).then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("השעות נשמרו");
        setValue("");
        void reloadMine();
        onChanged();
      });
    });
  }

  return (
    <div className="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
      <div>
        <h3 className="text-base font-semibold">נוכחות ושעות</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          מעלים כאן את דוח הנוכחות של העובד הזה בלבד. נקראות עמודות כניסה, יציאה,
          «שעות משולמות» ו«אירוע». ימי חופשה מהדוח נכנסים לשכר לפי ממוצע ברוטו
          של 3 החודשים הקודמים חלקי 22.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <HoursExcelButton
          employeeId={employeeId}
          onImported={() => {
            void reloadMine();
            onChanged();
          }}
        />
        <HoursTemplateButton />
      </div>
      {loading && mine.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          טוען נוכחות…
        </p>
      ) : mine.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/[0.06] bg-muted/20 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">שעות משולמות</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {totalHours.toLocaleString("he-IL", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-muted/20 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">ימי נוכחות</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{workDays || "—"}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-muted/20 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">ימי חופשה</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{vacationDays || "—"}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-muted/20 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">חודשים</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{mine.length}</p>
          </div>
        </section>
      ) : (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          אין דוח נוכחות לעובד הזה. העלו את קובץ TimeWatch שלו, או מלאו חודש ידנית
          למטה.
        </p>
      )}
      {mine.map((row) => (
        <section key={`${row.employeeId}-${row.month}`} className="overflow-hidden rounded-2xl border border-black/[0.06]">
          <header className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/40 px-4 py-3">
            <div>
              <p className="font-semibold">{monthLabel(row.month)}</p>
              <p className="text-[11px] text-muted-foreground">
                {row.source === "excel" ? row.fileName || "אקסל" : "מילוי ידני"}
              </p>
            </div>
            <p className="text-sm tabular-nums">
              {formatHoursClock(row.hours)}
              <span className="text-muted-foreground">
                {" "}
                · {attendanceDaysWorked(row.days) || "—"} ימי נוכחות
                {countVacationDays(row.days)
                  ? ` · ${countVacationDays(row.days)} ימי חופשה`
                  : ""}
              </span>
            </p>
          </header>
          {row.days.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-start text-sm">
                <thead className="text-[11px] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">תאריך</th>
                    <th className="px-3 py-2 font-medium">יום</th>
                    <th className="px-3 py-2 font-medium">סוג</th>
                    <th className="px-3 py-2 font-medium">אירוע</th>
                    <th className="px-3 py-2 font-medium">כניסה</th>
                    <th className="px-3 py-2 font-medium">יציאה</th>
                    <th className="px-3 py-2 font-medium">סה״כ שעות</th>
                    <th className="px-3 py-2 font-medium">שעות משולמות</th>
                  </tr>
                </thead>
                <tbody>
                  {row.days.map((day, index) => (
                    <DayRow key={`${day.date}-${day.clockIn}-${index}`} day={day} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              נשמרו {row.hours} שעות לחודש, בלי פירוט יומי. העלו דוח נוכחות כדי
              לראות כניסות ויציאות.
            </p>
          )}
        </section>
      ))}
      <section className="rounded-2xl border border-black/[0.06] p-4">
        <p className="text-sm font-medium">תיקון ידני לחודש</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_8rem_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">חודש</span>
            <Input
              type="month"
              className="h-11 rounded-xl"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">שעות משולמות</span>
            <Input
              inputMode="decimal"
              className="h-11 rounded-xl tabular-nums"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="160"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl font-semibold"
              disabled={pending}
              onClick={save}
            >
              {pending ? "שומר…" : "שמירת חודש"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
