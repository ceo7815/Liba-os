"use client";

import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  agentBelongsToEmployee,
  productionMonthKey,
} from "@/lib/employees/contract";
import { monthsInRange } from "@/lib/employees/payroll";
import { monthLabel } from "@/lib/employees/review";
import type { FinanceEmployee } from "@/lib/finance/categories";
import { formatIls, jerusalemYmd } from "@/lib/sales-dashboard/campaign-math";
import { HEBREW_MONTHS } from "@/lib/sales-dashboard/columns";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";

type PeriodPreset = "this_month" | "ytd" | "month";

type RankRow = {
  emp: FinanceEmployee;
  count: number;
  premium: number;
};

const PERIODS: { id: PeriodPreset; label: string }[] = [
  { id: "this_month", label: "החודש" },
  { id: "month", label: "חודש מהרשימה" },
  { id: "ytd", label: "מתחילת השנה" },
];

function shortMonthLabel(monthKey: string): string {
  const [, month] = monthKey.split("-");
  return HEBREW_MONTHS[month ?? ""] ?? monthKey;
}

function resolvePeriodMonths(
  preset: PeriodPreset,
  pickedMonth: string,
): { months: Set<string>; label: string } {
  const today = jerusalemYmd().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const year = today.slice(0, 4);

  if (preset === "this_month") {
    return { months: new Set([thisMonth]), label: monthLabel(thisMonth) };
  }
  if (preset === "ytd") {
    const list = monthsInRange(`${year}-01`, thisMonth);
    return {
      months: new Set(list),
      label: `מתחילת ${year} · עד ${monthLabel(thisMonth)}`,
    };
  }
  const month =
    pickedMonth && /^\d{4}-\d{2}$/.test(pickedMonth) ? pickedMonth : thisMonth;
  return { months: new Set([month]), label: monthLabel(month) };
}

function rankByProductions(
  employees: FinanceEmployee[],
  productions: MarketingProduction[],
  months: Set<string>,
): RankRow[] {
  const rows: RankRow[] = [];
  for (const emp of employees) {
    if (!emp.is_active) continue;
    if (emp.employment_kind === "unpaid") continue;
    let count = 0;
    let premium = 0;
    for (const row of productions) {
      if (row.status !== "active") continue;
      if (!agentBelongsToEmployee(row.agent, emp.full_name)) continue;
      const key = productionMonthKey(row);
      if (!key || !months.has(key)) continue;
      count += 1;
      premium += row.premium;
    }
    rows.push({ emp, count, premium: Math.round(premium) });
  }
  return rows.sort(
    (a, b) => b.count - a.count || b.premium - a.premium || a.emp.full_name.localeCompare(b.emp.full_name, "he"),
  );
}

export function ProductionLeadersPanel({
  employees,
  productions,
  loading,
  onOpenEmployee,
}: {
  employees: FinanceEmployee[];
  productions: MarketingProduction[];
  loading?: boolean;
  onOpenEmployee: (emp: FinanceEmployee) => void;
}) {
  const todayMonth = jerusalemYmd().slice(0, 7);
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [pickedMonth, setPickedMonth] = useState(todayMonth);
  const [pickedYear, setPickedYear] = useState(todayMonth.slice(0, 4));

  const yearOptions = useMemo(() => {
    const years = new Set<string>([jerusalemYmd().slice(0, 4)]);
    for (const row of productions) {
      const key = productionMonthKey(row);
      if (key) years.add(key.slice(0, 4));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [productions]);

  const yearMonthOptions = useMemo(() => {
    const today = jerusalemYmd().slice(0, 7);
    const currentYear = today.slice(0, 4);
    const end = pickedYear === currentYear ? today : `${pickedYear}-12`;
    return monthsInRange(`${pickedYear}-01`, end);
  }, [pickedYear]);

  const period = useMemo(
    () => resolvePeriodMonths(preset, pickedMonth),
    [pickedMonth, preset],
  );

  const ranked = useMemo(
    () => rankByProductions(employees, productions, period.months),
    [employees, period.months, productions],
  );

  const withClosures = useMemo(
    () => ranked.filter((row) => row.count > 0),
    [ranked],
  );

  const leader = withClosures[0] ?? null;
  const trailer =
    withClosures.length >= 2
      ? withClosures.reduce((worst, row) =>
          row.count < worst.count ||
          (row.count === worst.count && row.premium < worst.premium)
            ? row
            : worst,
        )
      : null;

  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white p-3.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:rounded-[var(--radius)] sm:p-5">
      <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight">הפקות לפי עובד</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            מוביל וחלש לפי מספר סגירות פעילות · {period.label}
          </p>
        </div>
      </div>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPreset(item.id);
              if (item.id === "month") setPickedYear(pickedMonth.slice(0, 4));
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
                      candidate =
                        year === today.slice(0, 4) ? today : `${year}-01`;
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
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {yearMonthOptions.map((monthKey) => (
              <button
                key={monthKey}
                type="button"
                onClick={() => {
                  setPickedMonth(monthKey);
                  setPickedYear(monthKey.slice(0, 4));
                }}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 sm:py-1.5",
                  pickedMonth === monthKey
                    ? "bg-black text-white"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted",
                )}
              >
                {shortMonthLabel(monthKey)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">טוען הפקות מהסנכרון…</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {leader ? (
            <LeaderCard
              kind="leader"
              name={leader.emp.full_name}
              count={leader.count}
              premium={leader.premium}
              periodLabel={period.label}
              onOpen={() => onOpenEmployee(leader.emp)}
            />
          ) : (
            <div className="relative overflow-hidden rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fafafa] px-4 py-4 sm:rounded-[var(--radius)] sm:px-5">
              <p className="text-[11px] font-medium text-muted-foreground">
                עובד מוביל בהפקות
              </p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                אין סגירות פעילות בטווח
              </p>
            </div>
          )}
          {trailer && leader && trailer.emp.id !== leader.emp.id ? (
            <LeaderCard
              kind="trailer"
              name={trailer.emp.full_name}
              count={trailer.count}
              premium={trailer.premium}
              periodLabel={period.label}
              onOpen={() => onOpenEmployee(trailer.emp)}
            />
          ) : (
            <div className="relative overflow-hidden rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fafafa] px-4 py-4 sm:rounded-[var(--radius)] sm:px-5">
              <p className="text-[11px] font-medium text-muted-foreground">
                הכי פחות הפקות
              </p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {withClosures.length < 2
                  ? "צריך לפחות שני עובדים עם סגירות בטווח"
                  : "אין מידע"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderCard({
  kind,
  name,
  count,
  premium,
  periodLabel,
  onOpen,
}: {
  kind: "leader" | "trailer";
  name: string;
  count: number;
  premium: number;
  periodLabel: string;
  onOpen: () => void;
}) {
  const isLeader = kind === "leader";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white px-4 py-4 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] transition-[transform,background-color,border-color] active:scale-[0.985] hover:border-black/10 hover:bg-[#fffcf0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 sm:rounded-[var(--radius)] sm:px-5"
    >
      <span
        className={cn(
          "absolute inset-y-0 start-0 w-1",
          isLeader ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            {isLeader ? "עובד מוביל בהפקות" : "הכי פחות הפקות"}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight sm:text-lg">
            {name}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isLeader ? "bg-emerald-600 text-white" : "bg-amber-700 text-white",
          )}
        >
          {isLeader ? "מוביל" : "חלש"}
        </span>
      </div>
      <p className="mt-3 text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums sm:text-2xl">
        {count.toLocaleString("he-IL")}{" "}
        <span className="text-sm font-semibold text-muted-foreground">סגירות</span>
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
        פרמיה {formatIls(premium)} · {periodLabel}
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-black/35">
        פתיחת כרטיס
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
      </p>
    </button>
  );
}
