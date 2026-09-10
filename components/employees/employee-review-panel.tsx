"use client";

import { Fragment, useState, type ReactNode } from "react";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import { sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import { productionDateOf, isSalaryOnly, usesMonthlySalary } from "@/lib/employees/contract";
import {
  monthLabel,
  type EmployeeBucket,
  type EmployeeNamedRollup,
  type EmployeeReview,
  type ReviewMonthAudit,
  type ReviewSaleLine,
} from "@/lib/employees/review";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";
import type { WageExplainReason } from "@/lib/employees/contract";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-muted/20 px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Split({
  bucket,
  salaried,
  extrasLines,
}: {
  bucket: EmployeeBucket;
  salaried?: boolean;
  extrasLines?: { amount: number; note: string }[];
}) {
  if (salaried) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">משכורת — שעות / גלובלי / נסיעות</p>
          <p className="mt-1 font-semibold tabular-nums">{formatIls(bucket.baseWage)}</p>
          <p className="text-[11px] text-muted-foreground">בלי מכירות, רק הסכם השכר</p>
        </div>
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">שכר ממכירות — מדרגות היקף</p>
          <p className="mt-1 font-semibold tabular-nums">{formatIls(bucket.salesWage)}</p>
          <p className="text-[11px] text-muted-foreground">
            {bucket.volumeCount} סגירות · פרמיה {formatIls(bucket.volumePremium)}
          </p>
        </div>
      </div>
    );
  }
  const oneTime = (extrasLines ?? []).filter((row) => row.note.includes("חד־פעמי"));
  const recurring = (extrasLines ?? []).filter((row) => !row.note.includes("חד־פעמי"));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl bg-background px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground">היקף — דוח מכירה</p>
        <p className="mt-1 font-semibold tabular-nums">{formatIls(bucket.volumeWage)}</p>
        <p className="text-[11px] text-muted-foreground">
          {bucket.volumeCount} סגירות · פרמיה {formatIls(bucket.volumePremium)}
        </p>
      </div>
      <div className="rounded-xl bg-background px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground">נפרעים — חדש + נגרר</p>
        <p className="mt-1 font-semibold tabular-nums">{formatIls(bucket.settledWage)}</p>
        <p className="text-[11px] text-muted-foreground">
          {bucket.settledTrailWage > 0
            ? `חדש ${formatIls(bucket.settledNewWage)} · נגרר ${formatIls(bucket.settledTrailWage)}`
            : `${bucket.settledCount} סגירות · פרמיה ${formatIls(bucket.settledPremium)}`}
        </p>
      </div>
      {bucket.baseWage > 0 ? (
        <div className="rounded-xl bg-background px-3 py-2.5 sm:col-span-2">
          <p className="text-[11px] text-muted-foreground">שכר קבוע / הוצאות / חד־פעמי</p>
          <p className="mt-1 font-semibold tabular-nums">{formatIls(bucket.baseWage)}</p>
          {extrasLines && extrasLines.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
              {recurring.map((row) => (
                <li key={`r-${row.note}-${row.amount}`} className="flex justify-between gap-3">
                  <span>{row.note}</span>
                  <span className="tabular-nums">{formatIls(row.amount)}</span>
                </li>
              ))}
              {oneTime.map((row) => (
                <li
                  key={`o-${row.note}-${row.amount}`}
                  className="flex justify-between gap-3 font-medium text-foreground"
                >
                  <span>{row.note}</span>
                  <span className="tabular-nums">{formatIls(row.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">כל חודש, ועליו היקף ונפרעים</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: EmployeeNamedRollup[] }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">אין נתונים</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.count} · {formatIls(row.premium)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatPercentFromMultiplier(value: number): string {
  const percent = value * 100;
  const pretty =
    Number.isInteger(percent) || Math.abs(percent - Math.round(percent)) < 0.05
      ? String(Math.round(percent))
      : percent.toLocaleString("he-IL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `${pretty}%`;
}

function formatMultiplier(value: number, reason?: WageExplainReason): string {
  if (!value) return "—";
  if (reason === "travel" || reason === "freelancer" || reason === "appointment" || reason === "freelancers_1" || reason === "freelancers_2" || reason === "freelancers_4") {
    return formatPercentFromMultiplier(value);
  }
  const pretty = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("he-IL", { maximumFractionDigits: 2 });
  return `×${pretty}`;
}

function reasonLabel(reason: WageExplainReason): string {
  if (reason === "travel") return "נסיעות %";
  if (reason === "freelancer") return "עמלת עצמאי";
  if (reason === "freelancers_1") return "נפרעים 1 · שוטף 60 ונגרר";
  if (reason === "freelancers_2") return "נפרעים 2 · 9.3% · שוטף 60 ונגרר";
  if (reason === "freelancers_4") return "היקף ליבה · עצמאים 4";
  if (reason === "tier") return "מדרגת היקף";
  if (reason === "appointment") return "מינוי סוכן";
  if (reason === "settled_blocked") return "שכיר בלי נפרעים";
  if (reason === "personal_accident") return "תאונות אישיות · בלי היקף";
  if (reason === "unpaid") return "ללא שכר";
  if (reason === "inactive") return "לא פעילה";
  return "—";
}

function processLabel(process: string): string {
  const kind = sourcePnlKindForProcess(process);
  if (kind === "volume") return "היקף";
  if (kind === "settled") return "נפרעים";
  return process || "—";
}

function statusLabel(row: MarketingProduction): string {
  if (row.status === "active") return "פעילה";
  if (row.status === "pending") return "ממתינה";
  if (row.status === "cancelled") return "בוטלה";
  return row.statusRaw || row.status;
}

function SaleRow({ row, salaried }: { row: ReviewSaleLine; salaried?: boolean }) {
  return (
    <tr
      className={cn(
        "border-t border-black/[0.04]",
        row.crossedTier && "bg-amber-50",
        row.status !== "active" && "text-muted-foreground",
      )}
    >
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{row.date || "—"}</td>
      <td className="px-3 py-1.5">{row.agent || "—"}</td>
      <td className="px-3 py-1.5">{row.client || "—"}</td>
      <td className="px-3 py-1.5">{row.product || "—"}</td>
      {salaried ? null : <td className="px-3 py-1.5">{processLabel(row.process)}</td>}
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatIls(row.premium)}</td>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatIls(row.runningPremium)}</td>
      <td className="whitespace-nowrap px-3 py-1.5">
        {row.report === "volume" && row.status === "active" && row.paidMultiplier
          ? row.paidTierLabel || "—"
          : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 font-medium tabular-nums">
        {formatMultiplier(row.paidMultiplier, row.reason)}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatIls(row.wage)}</td>
      <td className="whitespace-nowrap px-3 py-1.5 text-[12px]">
        {row.crossedTier
          ? "עבר למדרגה"
          : row.settledKind === "trail"
            ? "נגרר"
            : row.settledKind === "new"
              ? "נפרע חדש"
              : reasonLabel(row.reason)}
      </td>
    </tr>
  );
}

type DrillKind = "volume" | "sales" | "salary" | "settled" | "costs" | "total";

function ClickNum({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mx-1 rounded-lg px-1 py-0.5 text-start tabular-nums underline decoration-dotted decoration-black/25 underline-offset-4 hover:bg-black/[0.06]",
        active && "bg-black text-white decoration-transparent",
      )}
    >
      {children}
    </button>
  );
}

function productionsForDrill(audit: ReviewMonthAudit, kind: DrillKind, salaried?: boolean): ReviewSaleLine[] {
  const volume = audit.sales.filter((row) => row.report === "volume");
  const settled =
    audit.deferredSettledSales && audit.deferredSettledSales.length > 0
      ? audit.deferredSettledSales
      : audit.sales.filter((row) => row.report === "settled");
  if (kind === "settled") return settled;
  if (kind === "salary") return [];
  if (kind === "costs") return [];
  if (salaried || kind === "volume" || kind === "sales") return volume;
  return [...volume, ...settled];
}

function monthKindLabel(kind: EmployeeBucket["employmentKind"]): string | null {
  if (kind === "salaried") return "שכיר";
  if (kind === "freelancer") return "עצמאי";
  if (kind === "unpaid") return "ללא שכר";
  return null;
}

function extrasTotal(audit: ReviewMonthAudit): number {
  return (audit.variableExpenses ?? []).reduce((sum, row) => sum + row.amount, 0);
}

function drillTitle(kind: DrillKind, audit: ReviewMonthAudit, earned?: number): string {
  if (kind === "salary") {
    if (audit.employmentKind === "freelancer") {
      return `שכר קבוע ${audit.label} · ${formatIls(extrasTotal(audit))}`;
    }
    return `פירוט שכר ${audit.label} · ${formatIls(audit.productionWage + audit.baseWage)}`;
  }
  if (kind === "sales") return `שכר מדרגות ${audit.label} · ${formatIls(audit.productionWage)}`;
  if (kind === "volume") return `היקף ${audit.label} · ${formatIls(audit.volumePremium)}`;
  if (kind === "settled") {
    if (audit.settledSourceMonth) {
      return `נפרעים ${audit.label} — לפי חודש מכירה`;
    }
    return `נפרעים ${audit.label}`;
  }
  if (kind === "costs") return `עלויות חודשיות ${audit.label}`;
  return `סה״כ ${audit.label} · ${formatIls(earned ?? audit.productionWage + audit.baseWage + extrasTotal(audit))}`;
}

function formatHours(hours: number): string {
  if (!hours) return "—";
  return hours.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

function SlipRow({
  label,
  hint,
  amount,
  strong,
  muted,
  negative,
}: {
  label: string;
  hint?: string;
  amount: number;
  strong?: boolean;
  muted?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-6",
        strong ? "text-sm font-semibold" : "text-sm",
        muted && "text-[12px] text-muted-foreground",
      )}
    >
      <span className="min-w-0">
        {label}
        {hint ? <span className="font-normal text-muted-foreground"> · {hint}</span> : null}
      </span>
      <span className={cn("shrink-0 tabular-nums", negative && "text-muted-foreground")}>
        {negative ? `−${formatIls(amount)}` : formatIls(amount)}
      </span>
    </div>
  );
}

function SalaryBreakdown({ audit }: { audit: ReviewMonthAudit }) {
  const funds = audit.benefits;
  const hourlyWage =
    usesMonthlySalary(audit.salaryKind)
      ? 0
      : audit.hourlyRate > 0 && audit.hours > 0
        ? Math.round(audit.hourlyRate * audit.hours)
        : 0;
  const baseSalary =
    usesMonthlySalary(audit.salaryKind) ? Math.round(Math.max(0, audit.globalSalary)) : hourlyWage;
  const paidTravel = isSalaryOnly(audit.salaryKind)
    ? 0
    : audit.salaryKind === "global"
      ? audit.travelAmount
      : audit.hours > 0
        ? audit.travelAmount
        : 0;
  const extras = isSalaryOnly(audit.salaryKind) ? [] : (audit.variableExpenses ?? []);
  const extrasTotal = extras.reduce((sum, row) => sum + row.amount, 0);
  const tiers = isSalaryOnly(audit.salaryKind) || usesMonthlySalary(audit.salaryKind) ? 0 : audit.productionWage;
  const vacationPay = audit.vacationPay ?? 0;
  const gross = baseSalary + paidTravel + extrasTotal + tiers + vacationPay;
  const employeeDeduction = funds.pensionEmployee + funds.studyFundEmployee;
  const companyCost = gross + funds.employerExtra;
  const showFunds =
    funds.severanceEmployerPercent > 0 ||
    funds.pensionEmployeePercent > 0 ||
    funds.pensionEmployerPercent > 0 ||
    funds.studyFundEmployeePercent > 0 ||
    funds.studyFundEmployerPercent > 0;

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">שכר</p>
        {usesMonthlySalary(audit.salaryKind) ? (
          <SlipRow label={isSalaryOnly(audit.salaryKind) ? "משכורת" : "שכר גלובלי"} amount={baseSalary} />
        ) : (
          <SlipRow
            label="שכר שעות"
            hint={`${formatIls(audit.hourlyRate)} × ${formatHours(audit.hours)} שעות`}
            amount={hourlyWage}
          />
        )}
        {usesMonthlySalary(audit.salaryKind) ? null : (
          <SlipRow
            label="שכר מדרגות"
            hint={
              audit.monthMultiplier
                ? `מכפיל ${formatMultiplier(audit.monthMultiplier)} · ${audit.monthTierLabel}`
                : undefined
            }
            amount={tiers}
          />
        )}
        {!isSalaryOnly(audit.salaryKind) && (paidTravel > 0 || audit.travelAmount > 0) ? (
          <SlipRow label="נסיעות" amount={paidTravel} />
        ) : null}
        {extras.map((row, index) => (
          <SlipRow
            key={`${row.note}-${index}`}
            label={row.note}
            hint={row.note.includes("חד־פעמי") ? "פעם אחת בחודש שנבחר" : row.note === "שכר קבוע" ? "כל חודש, ועליו היקף ונפרעים" : "הוצאה משתנה"}
            amount={row.amount}
          />
        ))}
        {(audit.monthlyCosts ?? []).map((row) => (
          <SlipRow key={row.key} label={row.label} hint="יורד כל חודש" amount={row.amount} negative />
        ))}
        {audit.vacationDays > 0 ? (
          <SlipRow
            label="ימי חופשה"
            hint={`${audit.vacationDays} × ${formatIls(audit.vacationDayValue)} · ממוצע ברוטו 3 חודשים ${formatIls(audit.vacationAverageGross)} ÷ 22`}
            amount={vacationPay}
          />
        ) : null}
        <div className="border-t border-black/[0.08] pt-1.5">
          <SlipRow label="ברוטו לעובד" amount={gross} strong />
        </div>
      </div>

      {showFunds ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            הפרשות על שכר שעות + מדרגות
          </p>
          <p className="text-[12px] text-muted-foreground">
            בסיס מבוטח {formatIls(funds.pensionable)}
            {tiers > 0 ? ` · שעות ${formatIls(baseSalary)} + מדרגות ${formatIls(tiers)}` : ""}
            {paidTravel > 0 ? " · בלי נסיעות" : ""}
            {extrasTotal > 0 ? " · בלי הוצאות משתנות" : ""}
            {funds.ceiling > 0 ? ` · תקרה ${formatIls(funds.ceiling)}` : ""}
          </p>
          {funds.pensionWaiting ? (
            <p className="text-[12px] text-muted-foreground">
              אין הפרשת פנסיה / גמל בחודש זה — שלושת חודשי ההסכם הראשונים בלי הפרשה.
            </p>
          ) : null}
          {funds.overCeiling ? (
            <p className="text-[12px] text-amber-800">
              מעל התקרה {formatIls(funds.grossPensionable - funds.pensionable)} — בלי פיצויים, פנסיה /
              גמל וקרן השתלמות.
            </p>
          ) : null}
          {funds.severanceEmployerPercent > 0 ? (
            <SlipRow
              label="פיצויים מעסיק"
              hint={`${funds.severanceEmployerPercent}%`}
              amount={funds.severanceEmployer}
            />
          ) : null}
          {funds.pensionEmployerPercent > 0 ? (
            <SlipRow
              label="פנסיה / גמל מעסיק"
              hint={
                funds.pensionWaiting
                  ? `${funds.pensionEmployerPercent}% · אחרי 3 חודשים`
                  : `${funds.pensionEmployerPercent}%`
              }
              amount={funds.pensionEmployer}
            />
          ) : null}
          {funds.studyFundEmployerPercent > 0 ? (
            <SlipRow
              label="קרן השתלמות מעסיק"
              hint={`${funds.studyFundEmployerPercent}%`}
              amount={funds.studyFundEmployer}
            />
          ) : null}
          {funds.employerExtra > 0 ? (
            <SlipRow label="סה״כ הפרשות מעסיק" amount={funds.employerExtra} strong />
          ) : null}
          {funds.pensionEmployeePercent > 0 ? (
            <SlipRow
              label="פנסיה / גמל עובד"
              hint={
                funds.pensionWaiting
                  ? `${funds.pensionEmployeePercent}% · אחרי 3 חודשים`
                  : `${funds.pensionEmployeePercent}% · יורד מהברוטו`
              }
              amount={funds.pensionEmployee}
              negative
            />
          ) : null}
          {funds.studyFundEmployeePercent > 0 ? (
            <SlipRow
              label="קרן השתלמות עובד"
              hint={`${funds.studyFundEmployeePercent}% · יורד מהברוטו`}
              amount={funds.studyFundEmployee}
              negative
            />
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5 border-t border-black/[0.08] pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground">אחרי הכל</p>
        {employeeDeduction > 0 ? (
          <SlipRow label="נטו לעובד" hint="ברוטו פחות ניכויי עובד" amount={gross - employeeDeduction} />
        ) : null}
        <SlipRow label="סה״כ כולל הפרשות מעסיק" amount={companyCost} strong />
      </div>
    </div>
  );
}

function CostsBreakdown({ audit }: { audit: ReviewMonthAudit }) {
  const rows = audit.monthlyCosts ?? [];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">אין עלויות חודשיות בהסכם.</p>;
  }
  return (
    <div className="space-y-1.5 px-4 py-3">
      {rows.map((row) => (
        <SlipRow key={row.key} label={row.label} hint="יורד כל חודש" amount={row.amount} negative />
      ))}
      <SlipRow label="סה״כ עלויות החודש" amount={total} strong negative />
    </div>
  );
}

function FixedMonthlyBreakdown({ audit }: { audit: ReviewMonthAudit }) {
  const rows = audit.variableExpenses ?? [];
  const total = extrasTotal(audit);
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">אין שכר קבוע בחודש הזה.</p>;
  }
  return (
    <div className="space-y-1.5 px-4 py-3">
      {rows.map((row, index) => (
        <SlipRow
          key={`${row.note}-${index}`}
          label={row.note}
          hint={row.note.includes("חד־פעמי") ? "פעם אחת בחודש שנבחר" : row.note === "שכר קבוע" ? "כל חודש, ועליו היקף ונפרעים" : "הוצאה משתנה"}
          amount={row.amount}
        />
      ))}
      <SlipRow label="סה״כ שכר קבוע" amount={total} strong />
    </div>
  );
}

function settledGroups(rows: ReviewSaleLine[]) {
  const map = new Map<string, ReviewSaleLine[]>();
  for (const row of rows) {
    const key = row.saleMonth || "—";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([saleMonth, list]) => {
      const kind = list.some((row) => row.settledKind === "new") ? "new" : "trail";
      return {
        saleMonth,
        kind,
        label: saleMonth === "—" ? "ללא חודש" : monthLabel(saleMonth),
        count: list.length,
        premium: list.reduce((sum, row) => sum + row.premium, 0),
        wage: list.reduce((sum, row) => sum + row.wage, 0),
        rows: [...list].sort((a, b) => b.premium - a.premium || a.client.localeCompare(b.client, "he")),
      };
    })
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "new" ? -1 : 1;
      return b.saleMonth.localeCompare(a.saleMonth);
    });
}

function SettledBookTable({
  rows,
  payLabel,
}: {
  rows: ReviewSaleLine[];
  payLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">אין נפרעים לחודש הזה.</p>;
  }
  const groups = settledGroups(rows);
  const fresh = groups.filter((group) => group.kind === "new");
  const trail = groups.filter((group) => group.kind === "trail");
  const newWage = fresh.reduce((sum, group) => sum + group.wage, 0);
  const trailWage = trail.reduce((sum, group) => sum + group.wage, 0);
  const newCount = fresh.reduce((sum, group) => sum + group.count, 0);
  const trailCount = trail.reduce((sum, group) => sum + group.count, 0);
  const rate = rows[0]?.paidMultiplier ? formatPercentFromMultiplier(rows[0].paidMultiplier) : "";
  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">נפרע חדש · שוטף 60</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIls(newWage)}</p>
          <p className="text-[11px] text-muted-foreground">
            {newCount === 0 ? "אין מכירות חדשות שנכנסו החודש" : `${newCount} מכירות שנכנסו עכשיו ל${payLabel}`}
          </p>
        </div>
        <div className="rounded-xl bg-background px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">נגרר מחודשים קודמים</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIls(trailWage)}</p>
          <p className="text-[11px] text-muted-foreground">
            {trailCount === 0 ? "אין פוליסות פתוחות מלפני כן" : `${trailCount} פוליסות פעילות שעדיין רצות`}
          </p>
        </div>
        <div className="rounded-xl bg-highlight/40 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">סה״כ נפרע ב{payLabel}</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIls(newWage + trailWage)}</p>
          <p className="text-[11px] text-muted-foreground">חדש + נגרר, רק פוליסות פעילות</p>
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.saleMonth} className="overflow-hidden rounded-xl border border-black/[0.06] bg-background">
          <div
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm",
              group.kind === "new" ? "bg-highlight/30" : "bg-muted/40",
            )}
          >
            <p className="font-semibold">
              {group.kind === "new" ? "נפרע חדש" : "נגרר"}
              <span className="font-normal text-muted-foreground"> · מכירות {group.label}</span>
            </p>
            <p className="text-[12px] text-muted-foreground">
              {group.count} פוליסות · פרמיה {formatIls(group.premium)} · נפרע {formatIls(group.wage)}
            </p>
          </div>
          <table className="w-full text-start text-sm">
            <thead className="bg-muted/20 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">תאריך הפקה</th>
                <th className="px-3 py-1.5 font-medium">מוכר</th>
                <th className="px-3 py-1.5 font-medium">לקוח</th>
                <th className="px-3 py-1.5 font-medium">מוצר</th>
                <th className="px-3 py-1.5 font-medium">פרמיה</th>
                <th className="px-3 py-1.5 font-medium">{rate ? `נפרע ${rate}` : "נפרע"}</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.key} className="border-t border-black/[0.04]">
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{row.date || "—"}</td>
                  <td className="px-3 py-1.5">{row.agent || "—"}</td>
                  <td className="px-3 py-1.5">{row.client || "—"}</td>
                  <td className="px-3 py-1.5">{row.product || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatIls(row.premium)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium tabular-nums">{formatIls(row.wage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ProductionTable({
  rows,
  salaried,
}: {
  rows: ReviewSaleLine[];
  salaried?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">אין הפקות בסכום הזה.</p>;
  }
  const premium = rows.reduce((sum, row) => sum + (row.status === "active" ? row.premium : 0), 0);
  const wage = rows.reduce((sum, row) => sum + row.wage, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-start text-sm">
        <thead className="bg-muted/40 text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">תאריך הפקה</th>
            <th className="px-3 py-2 font-medium">מוכר</th>
            <th className="px-3 py-2 font-medium">לקוח</th>
            <th className="px-3 py-2 font-medium">מוצר</th>
            {salaried ? null : <th className="px-3 py-2 font-medium">דוח</th>}
            <th className="px-3 py-2 font-medium">פרמיה</th>
            <th className="px-3 py-2 font-medium">מצטבר בחודש</th>
            <th className="px-3 py-2 font-medium">מדרגה</th>
            <th className="px-3 py-2 font-medium">מכפיל</th>
            <th className="px-3 py-2 font-medium">שכר מההפקה</th>
            <th className="px-3 py-2 font-medium">הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SaleRow key={row.key} row={row} salaried={salaried} />
          ))}
          <tr className="border-t border-black/[0.08] bg-muted/30 font-semibold">
            <td className="px-3 py-2" colSpan={salaried ? 3 : 4}>
              {rows.length} הפקות
            </td>
            <td className="px-3 py-2 tabular-nums">{formatIls(premium)}</td>
            <td className="px-3 py-2" colSpan={3} />
            <td className="px-3 py-2 tabular-nums">{formatIls(wage)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function EmployeeReviewPanel({ review }: { review: EmployeeReview }) {
  const [drill, setDrill] = useState<{ month: string; kind: DrillKind } | null>(null);
  const mixedKinds = review.hasSalariedMonths && review.hasFreelancerMonths;
  const showSalaryCol = review.hasSalariedMonths;
  const showFixedCol = !showSalaryCol && review.months.some((row) => row.baseWage > 0);
  const showBaseCol = showSalaryCol || showFixedCol;
  const showSettledCols = review.hasFreelancerMonths;
  const hideSettledProcess = review.hasSalariedMonths && !review.hasFreelancerMonths;
  const colSpan = 6 + (showBaseCol ? 1 : 0) + (showSettledCols ? 3 : 0);
  const monthTotals = review.months.reduce(
    (sum, row) => ({
      volumeCount: sum.volumeCount + row.volumeCount,
      volumePremium: sum.volumePremium + row.volumePremium,
      salesWage: sum.salesWage + row.salesWage,
      baseWage: sum.baseWage + row.baseWage,
      settledCount: sum.settledCount + row.settledCount,
      settledPremium: sum.settledPremium + row.settledPremium,
      settledWage: sum.settledWage + row.settledWage,
      settledNewWage: sum.settledNewWage + row.settledNewWage,
      settledTrailWage: sum.settledTrailWage + row.settledTrailWage,
      monthlyCosts: sum.monthlyCosts + row.monthlyCosts,
      earned: sum.earned + row.earned,
    }),
    {
      volumeCount: 0,
      volumePremium: 0,
      salesWage: 0,
      baseWage: 0,
      settledCount: 0,
      settledPremium: 0,
      settledWage: 0,
      settledNewWage: 0,
      settledTrailWage: 0,
      monthlyCosts: 0,
      earned: 0,
    },
  );
  const toggle = (month: string, kind: DrillKind) => {
    setDrill((current) =>
      current?.month === month && current.kind === kind ? null : { month, kind },
    );
  };

  const monthAudit = review.audits.find((row) => row.month === review.thisMonthKey);
  const monthExtras = monthAudit?.variableExpenses ?? [];
  const monthOneTime = monthExtras
    .filter((row) => row.note.includes("חד־פעמי"))
    .reduce((sum, row) => sum + row.amount, 0);
  const monthFixed = monthExtras
    .filter((row) => !row.note.includes("חד־פעמי"))
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">סיכום עובד — לפי חודש מכירה</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {review.unpaid
            ? "עובד ללא שכר: אין הוצאת שכר. הפרמיה שנסגרה היא רווח ישיר לחברה."
            : mixedKinds
              ? "כל חודש לפי ההסכם שחל בו: שכיר — משכורת ומדרגות בלי נפרעים; עצמאי — היקף, שוטף 60 ונגרר. עלויות רק לפי הסכם אותו חודש. הפקה ב־1 לחודש נספרת לחודש שלפניו."
              : review.salaried
                ? "משכורת (שעות / גלובלי / נסיעות) נפרדת משכר המדרגות על המכירות. לשכיר אין נפרעים בטבלה. הפקה ב־1 לחודש נספרת לחודש המכירה שלפניו; השעות כמו שהועלו."
                : "אותם נתונים כמו דוח היקף ודוח נפרעים. הפקה ב־1 לחודש (תחילת ביטוח) נספרת לחודש המכירה שלפניו; השעות כמו שהועלו."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={
            review.unpaid
              ? `רווח נקי לחברה · ${review.thisMonthLabel}`
              : `קיבל החודש · ${review.thisMonthLabel}`
          }
          value={formatIls(review.unpaid ? review.month.companyIncome : review.month.earned)}
          hint={
            review.unpaid
              ? `שכר ₪0 · ${review.month.volumeCount + review.month.settledCount} סגירות`
              : review.salaried
                ? `משכורת ${formatIls(review.month.baseWage)} · מדרגות ${formatIls(review.month.salesWage)}`
                : monthOneTime > 0
                  ? `קבוע ${formatIls(monthFixed)} · חד־פעמי ${formatIls(monthOneTime)} · היקף ${formatIls(review.month.salesWage)} · נפרעים ${formatIls(review.month.settledWage)}`
                  : `קבוע ${formatIls(review.month.baseWage)} · היקף ${formatIls(review.month.salesWage)} · נפרעים ${formatIls(review.month.settledWage)}`
          }
        />
        <Kpi
          label="פרמיה החודש"
          value={formatIls(review.salaried ? review.month.volumePremium : review.month.volumePremium + review.month.settledPremium)}
          hint={
            review.salaried
              ? `${review.month.volumeCount} סגירות היקף`
              : `היקף ${formatIls(review.month.volumePremium)} · נפרעים ${formatIls(review.month.settledPremium)}`
          }
        />
        <Kpi
          label={review.unpaid ? `${review.ytd.label} · לחברה` : review.ytd.label}
          value={formatIls(review.unpaid ? review.ytd.companyIncome : review.ytd.earned)}
          hint={`${review.ytd.volumeCount + review.ytd.settledCount} סגירות`}
        />
        <Kpi
          label={review.unpaid ? "כל התקופה · רווח לחברה" : "כל התקופה באקסל"}
          value={formatIls(review.unpaid ? review.all.companyIncome : review.all.earned)}
          hint={`${review.rows.length} הפקות · פרמיה ${formatIls(review.all.volumePremium + review.all.settledPremium)}`}
        />
      </div>

      <section className="space-y-2 rounded-2xl border border-black/[0.06] bg-muted/15 p-4">
        <h3 className="text-sm font-semibold">
          {review.salaried ? "החודש — משכורת מול מדרגות" : "החודש — היקף מול נפרעים"}
        </h3>
        <Split
          bucket={review.month}
          salaried={review.salaried}
          extrasLines={monthExtras}
        />
        {review.month.pendingCount > 0 || review.month.cancelledCount > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            ממתינות {review.month.pendingCount} · בוטלו {review.month.cancelledCount}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">שכר לפי חודשים</h3>
        <p className="text-[12px] text-muted-foreground">
          {mixedKinds
            ? "לחצו על מספר כדי לראות ממה הוא מורכב. בחודש שכיר אין נפרעים; בחודש עצמאי חדש = מכירות מלפני חודשיים, נגרר = פוליסות פתוחות מחודשים קודמים."
            : review.salaried
              ? "לחצו על מספר כדי לראות את ההפקות שמרכיבות אותו. תאריך ההפקה נשאר כמו באקסל — רק החודש לשכר זז אחורה כשההפקה ב־1 לחודש."
              : "לחצו על שכר קבוע / נפרע חדש / נגרר / סה״כ כדי לראות ממה זה מורכב. חדש = מכירות מלפני חודשיים, נגרר = פוליסות פתוחות מחודשים קודמים. הפקה ב־1 לחודש נספרת לחודש שלפניו."}
        </p>
        {review.months.length === 0 ? (
          <p className="rounded-xl bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            אין נתונים לעובד הזה.
          </p>
        ) : (
          <>
          <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
            <table className="w-full min-w-[40rem] text-start text-sm">
              <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">חודש מכירה</th>
                  <th className="px-3 py-2 font-medium">סגירות היקף</th>
                  <th className="px-3 py-2 font-medium">פרמיית היקף</th>
                  <th className="px-3 py-2 font-medium">שכר מדרגות / מכירות</th>
                  {showSalaryCol ? (
                    <th className="px-3 py-2 font-medium">משכורת (שעות / גלובלי / נסיעות / מעסיק)</th>
                  ) : null}
                  {showFixedCol ? (
                    <th className="px-3 py-2 font-medium">שכר קבוע</th>
                  ) : null}
                  {showSettledCols ? (
                    <>
                      <th className="px-3 py-2 font-medium">נפרע חדש</th>
                      <th className="px-3 py-2 font-medium">נגרר</th>
                      <th className="px-3 py-2 font-medium">סה״כ נפרע</th>
                    </>
                  ) : null}
                  <th className="px-3 py-2 font-medium">עלויות</th>
                  <th className="px-3 py-2 font-medium">סה״כ קיבל</th>
                </tr>
              </thead>
              <tbody>
                {review.months.map((row) => {
                  const audit = review.audits.find((item) => item.month === row.key);
                  const open = drill?.month === row.key;
                  const kind = open ? drill.kind : null;
                  const rowSalaried = row.employmentKind === "salaried";
                  const kindLabel = monthKindLabel(row.employmentKind);
                  return (
                    <Fragment key={row.key}>
                      <tr
                        className={
                          row.key === review.thisMonthKey
                            ? "bg-highlight/25"
                            : "border-t border-black/[0.04]"
                        }
                      >
                        <td className="px-3 py-2 font-medium">
                          {row.label}
                          {mixedKinds && kindLabel ? (
                            <span className="ms-1.5 text-[10px] font-normal text-muted-foreground">
                              {kindLabel}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <ClickNum active={kind === "volume"} onClick={() => toggle(row.key, "volume")}>
                            {row.volumeCount}
                          </ClickNum>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <ClickNum active={kind === "volume"} onClick={() => toggle(row.key, "volume")}>
                            {formatIls(row.volumePremium)}
                          </ClickNum>
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          <ClickNum active={kind === "sales"} onClick={() => toggle(row.key, "sales")}>
                            {formatIls(row.salesWage)}
                          </ClickNum>
                        </td>
                        {showSalaryCol ? (
                          <td className="px-3 py-2 tabular-nums">
                            <ClickNum active={kind === "salary"} onClick={() => toggle(row.key, "salary")}>
                              {formatIls(row.baseWage)}
                            </ClickNum>
                          </td>
                        ) : null}
                        {showFixedCol ? (
                          <td className="px-3 py-2 tabular-nums">
                            <ClickNum active={kind === "salary"} onClick={() => toggle(row.key, "salary")}>
                              {formatIls(row.baseWage)}
                            </ClickNum>
                          </td>
                        ) : null}
                        {showSettledCols ? (
                          <>
                            <td className="px-3 py-2 tabular-nums">
                              <ClickNum active={kind === "settled"} onClick={() => toggle(row.key, "settled")}>
                                {formatIls(row.settledNewWage)}
                              </ClickNum>
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              <ClickNum active={kind === "settled"} onClick={() => toggle(row.key, "settled")}>
                                {formatIls(row.settledTrailWage)}
                              </ClickNum>
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              <ClickNum active={kind === "settled"} onClick={() => toggle(row.key, "settled")}>
                                {formatIls(row.settledWage)}
                              </ClickNum>
                            </td>
                          </>
                        ) : null}
                        <td className="px-3 py-2 tabular-nums">
                          <ClickNum active={kind === "costs"} onClick={() => toggle(row.key, "costs")}>
                            {row.monthlyCosts ? `−${formatIls(row.monthlyCosts)}` : formatIls(0)}
                          </ClickNum>
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          <ClickNum active={kind === "total"} onClick={() => toggle(row.key, "total")}>
                            {formatIls(row.earned)}
                          </ClickNum>
                        </td>
                      </tr>
                      {open && kind ? (
                        <tr className="border-t border-black/[0.04] bg-muted/20">
                          <td colSpan={colSpan} className="p-0">
                            <div className="border-t border-black/[0.06]">
                              {audit ? (
                                <>
                                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                                    <p className="text-sm font-semibold">{drillTitle(kind, audit, row.earned)}</p>
                                    {kind === "settled" && audit.settledSourceMonth ? (
                                      <p className="text-[12px] text-muted-foreground">
                                        חדש = מכירות {monthLabel(audit.settledSourceMonth)} · נגרר = פוליסות פתוחות מלפני כן
                                      </p>
                                    ) : kind === "costs" ? (
                                      <p className="text-[12px] text-muted-foreground">
                                        הסכומים מההסכם, יורדים כל חודש
                                      </p>
                                    ) : kind === "salary" && !rowSalaried ? (
                                      <p className="text-[12px] text-muted-foreground">
                                        כל חודש, ועליו היקף ונפרעים
                                      </p>
                                    ) : (
                                      <p className="text-[12px] text-muted-foreground">
                                        מכפיל החודש {formatMultiplier(audit.monthMultiplier)} · מדרגה{" "}
                                        {audit.monthTierLabel}
                                      </p>
                                    )}
                                  </div>
                                  {kind === "salary" ? (
                                    rowSalaried ? <SalaryBreakdown audit={audit} /> : <FixedMonthlyBreakdown audit={audit} />
                                  ) : null}
                                  {kind === "costs" ? <CostsBreakdown audit={audit} /> : null}
                                  {kind === "total" && rowSalaried ? (
                                    <SalaryBreakdown audit={audit} />
                                  ) : null}
                                  {kind === "total" && !rowSalaried && extrasTotal(audit) > 0 ? (
                                    <>
                                      <p className="px-4 pt-1 text-[11px] font-semibold text-muted-foreground">
                                        שכר קבוע
                                      </p>
                                      <FixedMonthlyBreakdown audit={audit} />
                                    </>
                                  ) : null}
                                  {kind !== "salary" && kind !== "costs" ? (
                                    <>
                                      {kind === "total" && rowSalaried ? (
                                        <p className="px-4 pt-1 text-[11px] font-semibold text-muted-foreground">
                                          הפקות החודש
                                        </p>
                                      ) : null}
                                      {kind === "settled" && audit.deferredSettledSales?.length ? (
                                        <SettledBookTable
                                          rows={audit.deferredSettledSales}
                                          payLabel={audit.label}
                                        />
                                      ) : kind === "total" && !rowSalaried && audit.deferredSettledSales?.length ? (
                                        <>
                                          <ProductionTable
                                            rows={productionsForDrill(audit, "volume", rowSalaried)}
                                            salaried={rowSalaried}
                                          />
                                          <p className="px-4 pt-2 text-[11px] font-semibold text-muted-foreground">
                                            נפרעים לפי חודש מכירה
                                          </p>
                                          <SettledBookTable
                                            rows={audit.deferredSettledSales}
                                            payLabel={audit.label}
                                          />
                                        </>
                                      ) : (
                                        <ProductionTable
                                          rows={productionsForDrill(audit, kind, rowSalaried)}
                                          salaried={rowSalaried}
                                        />
                                      )}
                                      {kind === "total" && (audit.monthlyCosts?.length ?? 0) > 0 ? (
                                        <>
                                          <p className="px-4 pt-2 text-[11px] font-semibold text-muted-foreground">
                                            עלויות חודשיות
                                          </p>
                                          <CostsBreakdown audit={audit} />
                                        </>
                                      ) : null}
                                    </>
                                  ) : null}
                                </>
                              ) : (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                  אין פירוט הפקות לחודש הזה.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/[0.12] bg-muted/50 font-semibold">
                  <td className="px-3 py-2.5">סה״כ</td>
                  <td className="px-3 py-2.5 tabular-nums">{monthTotals.volumeCount}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.volumePremium)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.salesWage)}</td>
                  {showSalaryCol ? (
                    <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.baseWage)}</td>
                  ) : null}
                  {showFixedCol ? (
                    <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.baseWage)}</td>
                  ) : null}
                  {showSettledCols ? (
                    <>
                      <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.settledNewWage)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.settledTrailWage)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.settledWage)}</td>
                    </>
                  ) : null}
                  <td className="px-3 py-2.5 tabular-nums">
                    {monthTotals.monthlyCosts ? `−${formatIls(monthTotals.monthlyCosts)}` : formatIls(0)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatIls(monthTotals.earned)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {mixedKinds ? (
            <p className="text-[11px] text-muted-foreground">
              בחודש שכיר המשכורת נפרדת מהמדרגות ואין נפרעים. בחודש עצמאי — נפרע חדש / נגרר לפי חודש המכירה.
            </p>
          ) : review.salaried ? (
            <p className="text-[11px] text-muted-foreground">
              מלמעלה למטה: שכר שעות, שכר מדרגות, נסיעות, הפרשות על השעות והמדרגות,
              וסה״כ כולל הכל. ניכויי עובד יורדים מהברוטו ולא מהעלות לחברה.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              שכר קבוע כל חודש, ועליו היקף ונפרעים. לחצו על העמודה או על סה״כ כדי לראות את הפירוט.
            </p>
          )}
          </>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <RankList title="מוצרים" rows={review.products} />
        <RankList title="מקורות פנייה" rows={review.sources} />
        <RankList title="חברות" rows={review.companies} />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">הפקות אחרונות מהאקסל</h3>
        {review.recent.filter((row) => !hideSettledProcess || sourcePnlKindForProcess(row.process) !== "settled").length === 0 ? (
          <p className="text-sm text-muted-foreground">אין הפקות היקף.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
            <table className="w-full min-w-[48rem] text-start text-sm">
              <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">תאריך הפקה</th>
                  <th className="px-3 py-2 font-medium">העברה ליצרן</th>
                  <th className="px-3 py-2 font-medium">לקוח</th>
                  <th className="px-3 py-2 font-medium">מוצר</th>
                  <th className="px-3 py-2 font-medium">מקור</th>
                  {hideSettledProcess ? null : <th className="px-3 py-2 font-medium">דוח</th>}
                  <th className="px-3 py-2 font-medium">סטטוס</th>
                  <th className="px-3 py-2 font-medium">פרמיה</th>
                  <th className="px-3 py-2 font-medium">מכפיל</th>
                  <th className="px-3 py-2 font-medium">שכר ממכירות</th>
                </tr>
              </thead>
              <tbody>
                {review.recent
                  .filter((row) => !hideSettledProcess || sourcePnlKindForProcess(row.process) !== "settled")
                  .map((row) => (
                  <tr key={row.key} className="border-t border-black/[0.04]">
                    <td className="px-3 py-2 tabular-nums">{productionDateOf(row) || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.transferDate}</td>
                    <td className="px-3 py-2">{row.client}</td>
                    <td className="px-3 py-2">{row.product}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    {hideSettledProcess ? null : <td className="px-3 py-2">{processLabel(row.process)}</td>}
                    <td className="px-3 py-2">{statusLabel(row)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatIls(row.premium)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatMultiplier(row.paidMultiplier, row.reason)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatIls(row.wage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
