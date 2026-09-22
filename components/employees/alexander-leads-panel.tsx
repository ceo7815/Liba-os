"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAlexanderUnproducedLeads } from "@/app/actions/finance-alexander-leads";
import { ALEXANDER_LEAD_RATE } from "@/lib/employees/lead-costs";
import { monthLabel } from "@/lib/employees/review";
import { jerusalemYmd, formatIls } from "@/lib/sales-dashboard/campaign-math";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AlexanderUnproducedEditor({
  employeeId,
  months,
  byMonth,
  onChanged,
}: {
  employeeId: string;
  months: string[];
  byMonth: Record<string, number>;
  onChanged?: () => void;
}) {
  const thisMonth = jerusalemYmd().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [value, setValue] = useState(String(byMonth[thisMonth] ?? ""));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(String(byMonth[month] ?? ""));
  }, [byMonth, month]);

  const rows = useMemo(() => {
    const keys = new Set([...months, ...Object.keys(byMonth), thisMonth]);
    return Array.from(keys)
      .filter((key) => /^\d{4}-\d{2}$/.test(key))
      .sort((a, b) => b.localeCompare(a));
  }, [byMonth, months, thisMonth]);

  function save(targetMonth = month, raw = value) {
    const leads = Math.max(0, Math.round(Number(raw) || 0));
    startTransition(() => {
      void saveAlexanderUnproducedLeads({
        employeeId,
        month: targetMonth,
        leads,
      }).then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          leads
            ? `נשמרו ${leads} לידים מאלכסנדר ב${monthLabel(targetMonth)} · −${formatIls(leads * ALEXANDER_LEAD_RATE)}`
            : `אופסו לידים שלא הופקו ב${monthLabel(targetMonth)}`,
        );
        onChanged?.();
      });
    });
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-[#f4f8ff] p-4">
      <p className="text-sm font-semibold">אלכסנדר — לידים שהתקבלו ולא הופקו</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        סגירות מאלכסנדר באקסל מחויבות אוטומטית ב־{formatIls(ALEXANDER_LEAD_RATE)} לכל אחת.
        כאן ממלאים בסוף החודש לידים שנמסרו ולא הופקו — גם הם {formatIls(ALEXANDER_LEAD_RATE)} לליד.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_8rem_auto]">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">חודש</span>
          <Input
            type="month"
            className="h-11 rounded-xl"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setValue(String(byMonth[e.target.value] ?? ""));
            }}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">לידים שלא הופקו</span>
          <Input
            inputMode="numeric"
            className="h-11 rounded-xl tabular-nums"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl font-semibold"
            disabled={pending}
            onClick={() => save()}
          >
            {pending ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </div>
      {rows.some((key) => (byMonth[key] ?? 0) > 0) ? (
        <ul className="mt-3 space-y-1 text-[12px]">
          {rows
            .filter((key) => (byMonth[key] ?? 0) > 0)
            .map((key) => (
              <li key={key} className="flex justify-between gap-3 text-muted-foreground">
                <span>{monthLabel(key)}</span>
                <span className="tabular-nums">
                  {byMonth[key]} לידים · −{formatIls(byMonth[key] * ALEXANDER_LEAD_RATE)}
                </span>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
