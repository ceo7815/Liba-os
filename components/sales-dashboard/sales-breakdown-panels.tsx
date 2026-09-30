"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { listAlexanderUnproducedLeads } from "@/app/actions/finance-alexander-leads";
import { listEmployeeHours } from "@/app/actions/finance-employee-hours";
import { listFinanceEmployees } from "@/app/actions/finance-people";
import { loadAdsLeadSnapshot } from "@/app/actions/marketing-campaigns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FREELANCER_FORMULA_OPTIONS,
  agreementForDate,
  parsePayAgreements,
  productionDateOf,
  shiftCalendarMonth,
  toPayProfile,
  wageMonthKeyFromIso,
  withResolvedOneTimePayments,
  type EmployeeAgreement,
  type EmployeePayProfile,
  type EmploymentKind,
  type WageExplainReason,
} from "@/lib/employees/contract";
import { excelAgentKey } from "@/lib/employees/excel-sellers";
import {
  groupHoursByEmployeeId,
  groupVacationDaysByEmployeeId,
  type EmployeeHoursRow,
} from "@/lib/employees/hours";
import {
  buildLeadCplBySourceMonth,
  EMPTY_ADS_LEAD_SNAPSHOT,
  groupAlexanderUnproducedByEmployeeId,
  type AdsLeadSnapshot,
  type LeadCostSourceMonth,
  type LeadCplMap,
} from "@/lib/employees/lead-costs";
import {
  buildEmployeeReview,
  monthLabel,
  type EmployeeBucket,
  type ReviewMonthAudit,
  type ReviewSaleLine,
} from "@/lib/employees/review";
import { normalizeExcelText, sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import { formatIls, isoDay, type DateRange } from "@/lib/sales-dashboard/campaign-math";
import { insurerIncomeForProductions, insurerIncomeNote } from "@/lib/finance/insurer-income";
import type { OperatingBrandId } from "@/lib/finance/operating-brand";
import { inSaleTransferRange, isReportSale } from "@/lib/sales-dashboard/report-slices";
import type { MarketingProduction } from "@/lib/sales-dashboard/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<EmploymentKind, string> = {
  salaried: "שכיר",
  freelancer: "עצמאי",
  partnership: "שיתוף פעולה",
  unpaid: "בלי שכר",
};

function displayIso(iso: string): string {
  const day = isoDay(iso);
  if (!day) return "";
  const [year, month, date] = day.split("-");
  return `${Number(date)}.${Number(month)}.${year.slice(2)}`;
}

function agreementCaption(agreement: EmployeeAgreement | null): string {
  if (!agreement) return "אין הסכם";
  const kind = KIND_LABEL[agreement.employmentKind];
  const formula =
    agreement.employmentKind === "freelancer"
      ? FREELANCER_FORMULA_OPTIONS.find((option) => option.id === agreement.contract.freelancerFormula)?.label
      : "";
  const from = agreement.from ? displayIso(agreement.from) : "";
  const to = agreement.to ? displayIso(agreement.to) : "";
  const span = from || to ? `${from || "…"}–${to || "פתוח"}` : "";
  return [kind, formula, span].filter(Boolean).join(" · ");
}

function rangeMonths(range: DateRange): { unbounded: boolean; from: string; to: string } {
  if (!range.from && !range.to) return { unbounded: true, from: "", to: "" };
  return {
    unbounded: false,
    from: (isoDay(range.from) || "2000-01-01").slice(0, 7),
    to: (isoDay(range.to) || "2999-12-31").slice(0, 7),
  };
}

function addBucket(into: EmployeeBucket, part: EmployeeBucket) {
  into.volumePremium += part.volumePremium;
  into.volumeCount += part.volumeCount;
  into.salesWage += part.salesWage;
  into.baseWage += part.baseWage;
  into.settledWage += part.settledWage;
  into.monthlyCosts += part.monthlyCosts;
  into.leadCosts += part.leadCosts;
  into.leadCount += part.leadCount;
  into.earned += part.earned;
}

function emptySum(): EmployeeBucket {
  return {
    key: "range",
    label: "",
    volumeCount: 0,
    volumePremium: 0,
    volumeWage: 0,
    salesWage: 0,
    baseWage: 0,
    settledCount: 0,
    settledPremium: 0,
    settledWage: 0,
    settledNewWage: 0,
    settledTrailWage: 0,
    pendingCount: 0,
    pendingPremium: 0,
    cancelledCount: 0,
    cancelledPremium: 0,
    earned: 0,
    companyIncome: 0,
    monthlyCosts: 0,
    leadCosts: 0,
    leadCount: 0,
    employmentKind: null,
  };
}

function profileFromEmployee(row: {
  full_name: string;
  employment_kind: EmploymentKind | null;
  pay_contract: EmployeePayProfile["contract"];
  agreements: EmployeeAgreement[];
  id: string;
}, hours: Map<string, Record<string, number>>, vacation: Map<string, Record<string, number>>, alexander: Map<string, Record<string, number>>): EmployeePayProfile {
  const agreements = (
    row.agreements?.length ? row.agreements : parsePayAgreements(row.pay_contract, row.employment_kind)
  ).map((agreement) => ({
    ...agreement,
    contract: withResolvedOneTimePayments(agreement.contract),
  }));
  return toPayProfile({
    fullName: row.full_name,
    employmentKind: row.employment_kind,
    contract: withResolvedOneTimePayments(agreements[0]?.contract ?? row.pay_contract),
    agreements,
    hoursByMonth: hours.get(row.id),
    vacationDaysByMonth: vacation.get(row.id),
    alexanderUnproducedByMonth: alexander.get(row.id),
  });
}

export type EmployeePayBundle = {
  ready: boolean;
  error: string | null;
  employees: Awaited<ReturnType<typeof listFinanceEmployees>>["employees"];
  hours: EmployeeHoursRow[];
  alexander: Map<string, Record<string, number>>;
  ads: AdsLeadSnapshot;
};

export function useEmployeePayBundle(): EmployeePayBundle {
  const [employees, setEmployees] = useState<EmployeePayBundle["employees"]>([]);
  const [hours, setHours] = useState<EmployeeHoursRow[]>([]);
  const [alexander, setAlexander] = useState<Map<string, Record<string, number>>>(() => new Map());
  const [ads, setAds] = useState<AdsLeadSnapshot>(EMPTY_ADS_LEAD_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listFinanceEmployees(),
      listEmployeeHours(),
      listAlexanderUnproducedLeads(),
      loadAdsLeadSnapshot().catch(() => EMPTY_ADS_LEAD_SNAPSHOT),
    ]).then(([people, hourRows, leads, snapshot]) => {
      if (cancelled) return;
      if (people.error) setError(people.error);
      else setEmployees(people.employees);
      if (!hourRows.error) setHours(hourRows.hours);
      if (!leads.error) setAlexander(groupAlexanderUnproducedByEmployeeId(leads.rows));
      setAds(snapshot);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error, employees, hours, alexander, ads };
}

function productionsForWage(rows: MarketingProduction[], range: DateRange): MarketingProduction[] {
  const window = rangeMonths(range);
  if (window.unbounded) return rows;
  const from = shiftCalendarMonth(window.from, -3);
  return rows.filter((row) => {
    const key = wageMonthKeyFromIso(productionDateOf(row));
    return Boolean(key) && key >= from && key <= window.to;
  });
}

export function EmployeeBreakdown({
  productions,
  range,
  brand,
  shemeshEmployeeNames,
  pay,
}: {
  productions: MarketingProduction[];
  range: DateRange;
  brand: OperatingBrandId;
  shemeshEmployeeNames: string[];
  pay: EmployeePayBundle;
}) {
  const { ready, error, employees, hours, alexander, ads } = pay;
  const [openName, setOpenName] = useState<string | null>(null);

  const leadCpl: LeadCplMap = useMemo(() => buildLeadCplBySourceMonth(ads), [ads]);
  const hoursByEmployee = useMemo(() => groupHoursByEmployeeId(hours), [hours]);
  const vacationByEmployee = useMemo(() => groupVacationDaysByEmployeeId(hours), [hours]);

  const rows = useMemo(() => {
    const shemesh = new Set(shemeshEmployeeNames.map((name) => excelAgentKey(name)));
    const visible = (name: string) => {
      const key = excelAgentKey(name);
      const isShemesh = shemesh.has(key);
      if (brand === "shemesh") return isShemesh;
      if (brand === "liba") return !isShemesh;
      return true;
    };
    const window = rangeMonths(range);
    const asOf = isoDay(range.to) || new Date().toISOString().slice(0, 10);
    const profiles = employees
      .filter((row) => row.is_active && visible(row.full_name))
      .map((row) => profileFromEmployee(row, hoursByEmployee, vacationByEmployee, alexander));
    const covered = new Set(profiles.map((profile) => excelAgentKey(profile.fullName)));

    const wageRows = productionsForWage(productions, range);
    const listed = profiles.map((profile) => {
      const review = buildEmployeeReview(profile.fullName, wageRows, {
        profiles: [profile],
        rates: [],
        fallback: 0,
        leadCpl,
      });
      const wage = window.unbounded
        ? review.all
        : review.months
            .filter((month) => month.key >= window.from && month.key <= window.to)
            .reduce((sum, month) => {
              addBucket(sum, month);
              return sum;
            }, emptySum());
      const sales = productions.filter(
        (row) =>
          excelAgentKey(row.agent) === excelAgentKey(profile.fullName) &&
          inSaleTransferRange(row, range) &&
          isReportSale(row),
      );
      const premium = sales.reduce((sum, row) => sum + row.premium, 0);
      const agreement = agreementForDate(profile.agreements ?? [], asOf);
      const audits = review.audits.filter(
        (audit) => window.unbounded || (audit.month >= window.from && audit.month <= window.to),
      );
      return {
        name: profile.fullName,
        agreement: agreementCaption(agreement),
        premium: Math.round(premium),
        sales: sales.length,
        wage,
        audits,
        saleRows: sales,
      };
    });

    const loose = new Map<string, { name: string; premium: number; sales: number }>();
    for (const row of productions) {
      if (!inSaleTransferRange(row, range) || !isReportSale(row)) continue;
      const key = excelAgentKey(row.agent);
      if (!key || key === "—" || covered.has(key) || !visible(row.agent)) continue;
      const current = loose.get(key) ?? { name: row.agent, premium: 0, sales: 0 };
      current.premium += row.premium;
      current.sales += 1;
      loose.set(key, current);
    }

    return [
      ...listed.map((row) => ({ ...row, card: true as const })),
      ...Array.from(loose.values()).map((row) => ({
        name: row.name,
        agreement: "אין כרטיס עובד",
        premium: Math.round(row.premium),
        sales: row.sales,
        wage: emptySum(),
        audits: [] as ReviewMonthAudit[],
        saleRows: productions.filter(
          (item) =>
            excelAgentKey(item.agent) === excelAgentKey(row.name) &&
            inSaleTransferRange(item, range) &&
            isReportSale(item),
        ),
        card: false as const,
      })),
    ]
      .filter((row) => row.premium > 0 || row.wage.earned !== 0 || row.wage.leadCount > 0 || row.sales > 0)
      .sort((a, b) => b.wage.earned - a.wage.earned || b.premium - a.premium || a.name.localeCompare(b.name, "he"));
  }, [alexander, brand, employees, hoursByEmployee, leadCpl, productions, range, shemeshEmployeeNames, vacationByEmployee]);

  const totals = rows.reduce(
    (sum, row) => {
      sum.premium += row.premium;
      if (!row.card) return sum;
      sum.leadCount += row.wage.leadCount;
      sum.leadCosts += row.wage.leadCosts;
      sum.earned += row.wage.earned;
      return sum;
    },
    { premium: 0, leadCount: 0, leadCosts: 0, earned: 0 },
  );

  if (!ready) {
    return <p className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-8 text-center text-sm text-muted-foreground">טוען שכר, הסכמים ולידים…</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</p> : null}
      <p className="text-sm text-muted-foreground">
        שכר לפי ההסכם. הפרמיה היא תהליך מכירה, כל הסטטוסים, לפי תאריך העברה ליצרן.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground">אין עובדים בטווח הזה.</p>
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-[#fafaf8] text-[11px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">עובד</th>
                <th className="px-3 py-2 text-start font-medium">הסכם</th>
                <th className="px-3 py-2 text-start font-medium">פרמיה</th>
                <th className="px-3 py-2 text-start font-medium">לידים</th>
                <th className="px-3 py-2 text-start font-medium">לתשלום</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="cursor-pointer border-t border-black/[0.04] hover:bg-[#fafaf8]"
                  onClick={() => setOpenName(row.name)}
                >
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{row.agreement}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatIls(row.premium)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.card ? `${row.wage.leadCount.toLocaleString("he-IL")} · −${formatIls(row.wage.leadCosts)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums">{row.card ? formatIls(row.wage.earned) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/[0.08] bg-[#fafaf8] font-semibold">
                <td className="px-3 py-2.5">סה״כ</td>
                <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                  {rows.length.toLocaleString("he-IL")} עובדים
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatIls(totals.premium)}</td>
                <td className="px-3 py-2.5 tabular-nums">
                  {totals.leadCount.toLocaleString("he-IL")} · −{formatIls(totals.leadCosts)}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatIls(totals.earned)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <EmployeeDetail
        row={rows.find((row) => row.name === openName) ?? null}
        onClose={() => setOpenName(null)}
      />
    </div>
  );
}

type EmployeeSplitRow = {
  name: string;
  agreement: string;
  premium: number;
  sales: number;
  wage: EmployeeBucket;
  audits: ReviewMonthAudit[];
  saleRows: MarketingProduction[];
  card: boolean;
};

function EmployeeDetail({ row, onClose }: { row: EmployeeSplitRow | null; onClose: () => void }) {
  const wage = row?.wage;
  const built = wage ? wage.salesWage + wage.baseWage + wage.settledWage - wage.monthlyCosts - wage.leadCosts : 0;
  const equationHolds = wage != null && Math.round(built) === Math.round(wage.earned);
  return (
    <Dialog open={row != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[min(92dvh,52rem)] w-[min(96vw,68rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-black/[0.06] px-5 py-4 pe-14 text-start">
          <DialogTitle>{row?.name}</DialogTitle>
          <DialogDescription>{row?.agreement}</DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {row.card && wage ? (
              <section className="rounded-2xl bg-[#fafaf8] px-4 py-3 text-sm leading-relaxed">
                <p>
                  לתשלום <span className="font-semibold tabular-nums">{formatIls(wage.earned)}</span>
                  {equationHolds ? ` = ${payEquation(wage)}` : "."}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  השכר לפי חודש הפקה. הפרמיה בטבלה ({formatIls(row.premium)}, {row.sales.toLocaleString("he-IL")} שורות) היא תהליך מכירה, כל הסטטוסים, לפי תאריך העברה ליצרן.
                </p>
              </section>
            ) : (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                אין כרטיס עובד עם הסכם, אז אין חישוב שכר. למטה המכירות על השם הזה בטווח.
              </p>
            )}
            {row.card
              ? row.audits.map((audit) => <MonthBlock key={audit.month} audit={audit} />)
              : null}
            {!row.card && row.saleRows.length > 0 ? <PlainSales rows={row.saleRows} /> : null}
            {row.card && row.audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין חודש הפקה בטווח הזה.</p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function payEquation(wage: EmployeeBucket): string {
  const plus = [
    wage.salesWage ? `היקף ${formatIls(wage.salesWage)}` : "",
    wage.baseWage ? `בסיס ${formatIls(wage.baseWage)}` : "",
    wage.settledWage ? `נפרעים ${formatIls(wage.settledWage)}` : "",
  ].filter(Boolean);
  const minus = [
    wage.monthlyCosts ? `עלויות ${formatIls(wage.monthlyCosts)}` : "",
    wage.leadCosts ? `לידים ${formatIls(wage.leadCosts)}` : "",
  ].filter(Boolean);
  return `${plus.join(" + ") || "₪0"}${minus.length ? ` − ${minus.join(" − ")}` : ""}`;
}

function MonthBlock({ audit }: { audit: ReviewMonthAudit }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.06]">
      <div className="bg-[#1a1a1a] px-3 py-2 text-sm font-semibold text-white">
        {audit.label || monthLabel(audit.month)}
        <span className="ms-2 text-[11px] font-normal text-white/70">{monthKind(audit)}</span>
      </div>
      <div className="space-y-3 px-3 py-3">
        <p className="text-[13px] leading-relaxed">{monthSentence(audit)}</p>
        {audit.sales.length > 0 ? <SaleTable rows={audit.sales} /> : <p className="text-[12px] text-muted-foreground">אין שורות שכר בחודש הזה.</p>}
        {audit.leadGroups.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold">לידים</p>
            {audit.leadGroups.map((group) => (
              <p key={group.key} className="text-[12px] leading-relaxed text-muted-foreground">
                {leadSentence(group)}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function monthKind(audit: ReviewMonthAudit): string {
  if (audit.employmentKind === "salaried" && audit.salaryKind === "hourly") return "שכיר שעתי";
  if (audit.employmentKind === "salaried" && audit.salaryKind === "global") return "שכיר גלובלי";
  if (audit.employmentKind === "salaried") return "שכיר";
  if (audit.employmentKind === "freelancer") return "עצמאי";
  if (audit.employmentKind === "partnership") return "שיתוף פעולה";
  if (audit.employmentKind === "unpaid") return "בלי שכר";
  return "";
}

function monthSentence(audit: ReviewMonthAudit): string {
  const bits: string[] = [];
  if (audit.employmentKind === "salaried" && audit.salaryKind === "hourly") {
    bits.push(`${audit.hours.toLocaleString("he-IL")} שעות × ${formatIls(audit.hourlyRate)} נכנס לבסיס ${formatIls(audit.baseWage)}`);
  } else if (audit.employmentKind === "salaried" && audit.salaryKind === "global") {
    bits.push(`שכר גלובלי ${formatIls(audit.globalSalary || audit.baseWage)}`);
  } else if (audit.employmentKind === "salaried" && audit.baseWage) {
    bits.push(`שכר חודשי ${formatIls(audit.baseWage)}`);
  } else if (audit.baseWage) {
    bits.push(`בסיס ותוספות ${formatIls(audit.baseWage)}`);
  }
  if (audit.vacationPay) {
    bits.push(`חופשה ${audit.vacationDays.toLocaleString("he-IL")} ימים × ${formatIls(audit.vacationDayValue)} = ${formatIls(audit.vacationPay)}`);
  }
  for (const expense of audit.variableExpenses) {
    if (expense.amount) bits.push(`${expense.note || "הוצאה"} ${formatIls(expense.amount)}`);
  }
  for (const cost of audit.monthlyCosts) {
    if (cost.amount) bits.push(`${cost.label} יורד ${formatIls(cost.amount)}`);
  }
  if (audit.productionWage) bits.push(`שכר היקף ${formatIls(audit.productionWage)}`);
  if (!bits.length) return "אין רכיב שכר נוסף מלבד השורות.";
  return bits.join(". ") + ".";
}

function SaleTable({ rows }: { rows: ReviewSaleLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-[12px]">
        <thead className="text-[11px] text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-start font-medium">תאריך</th>
            <th className="px-2 py-1 text-start font-medium">לקוח</th>
            <th className="px-2 py-1 text-start font-medium">מוצר</th>
            <th className="px-2 py-1 text-start font-medium">פרמיה</th>
            <th className="px-2 py-1 text-start font-medium">שיעור</th>
            <th className="px-2 py-1 text-start font-medium">שכר</th>
            <th className="px-2 py-1 text-start font-medium">למה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <tr key={sale.key} className="border-t border-black/[0.04]">
              <td className="px-2 py-1.5 tabular-nums">{sale.date || "—"}</td>
              <td className="px-2 py-1.5">{sale.client || "—"}</td>
              <td className="px-2 py-1.5">{sale.product || "—"}</td>
              <td className="px-2 py-1.5 tabular-nums">{formatIls(sale.premium)}</td>
              <td className="px-2 py-1.5 tabular-nums">{rateLabel(sale)}</td>
              <td className="px-2 py-1.5 font-medium tabular-nums">{formatIls(sale.wage)}</td>
              <td className="px-2 py-1.5">{saleWhy(sale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rateLabel(sale: ReviewSaleLine): string {
  if (!sale.paidMultiplier) return "—";
  if (sale.reason === "tier") {
    const pretty = Number.isInteger(sale.paidMultiplier)
      ? String(sale.paidMultiplier)
      : sale.paidMultiplier.toLocaleString("he-IL", { maximumFractionDigits: 2 });
    return `×${pretty}`;
  }
  const percent = sale.paidMultiplier * 100;
  const pretty = Number.isInteger(percent) ? String(percent) : percent.toLocaleString("he-IL", { maximumFractionDigits: 1 });
  return `${pretty}%`;
}

function saleWhy(sale: ReviewSaleLine): string {
  if (sale.crossedTier) return "עבר למדרגה";
  if (sale.settledKind === "trail") return "נגרר";
  if (sale.settledKind === "new") return "נפרע חדש";
  const kind = sourcePnlKindForProcess(sale.process);
  const process = kind === "volume" ? "היקף" : kind === "settled" ? "נפרעים" : "";
  return [process, reasonText(sale.reason), sale.paidTierLabel].filter(Boolean).join(" · ");
}

function reasonText(reason: WageExplainReason): string {
  if (reason === "travel") return "נסיעות";
  if (reason === "freelancer") return "עמלת עצמאי";
  if (reason === "freelancers_1") return "נפרעים 1, שוטף 60 ונגרר";
  if (reason === "freelancers_2") return "נפרעים 2, 9.3%, שוטף 60 ונגרר";
  if (reason === "freelancers_4") return "היקף ליבה, עצמאים 4";
  if (reason === "tier") return "מדרגת היקף";
  if (reason === "appointment") return "מינוי סוכן";
  if (reason === "settled_blocked") return "שכיר בלי נפרעים";
  if (reason === "personal_accident") return "תאונות אישיות בלי היקף";
  if (reason === "unpaid") return "ללא שכר";
  if (reason === "partnership") return "שותף, פרמיה × 4";
  if (reason === "partnership_source") return "לא בשכר, מקור אורשן";
  if (reason === "inactive") return "לא פעילה";
  return "";
}

function leadSentence(group: LeadCostSourceMonth): string {
  const when = monthLabel(group.month);
  if (group.formula === "premium") {
    return `${group.source} · ${when}: פרמיה שהופקה ${formatIls(group.amount)} יורדת מהשכר, ${group.count.toLocaleString("he-IL")} הפקות.`;
  }
  if (group.formula === "alexander") {
    return `${group.source} · ${when}: ${group.count.toLocaleString("he-IL")} סגירות × ${formatIls(group.unit)} = −${formatIls(group.amount)}.`;
  }
  if (group.formula === "alexander-unproduced") {
    return `${group.source} · ${when}: ${group.count.toLocaleString("he-IL")} לידים שהתקבלו ולא הופקו × ${formatIls(group.unit)} = −${formatIls(group.amount)}.`;
  }
  if (group.adsLeads > 0 && group.spend > 0) {
    return `${group.source} · ${when}: ${formatIls(group.spend)} הוצאה ÷ ${group.adsLeads.toLocaleString("he-IL")} לידים, ולהפקה 50%. ${group.count.toLocaleString("he-IL")} הפקות × ${formatIls(group.unit)} = −${formatIls(group.amount)}.`;
  }
  return `${group.source} · ${when}: −${formatIls(group.amount)}.`;
}

function PlainSales({ rows }: { rows: MarketingProduction[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/[0.06]">
      <table className="w-full text-[12px]">
        <thead className="bg-[#fafaf8] text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">לקוח</th>
            <th className="px-3 py-2 text-start font-medium">חברה</th>
            <th className="px-3 py-2 text-start font-medium">מוצר</th>
            <th className="px-3 py-2 text-start font-medium">פרמיה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <tr key={sale.key} className="border-t border-black/[0.04]">
              <td className="px-3 py-1.5">{sale.client || "—"}</td>
              <td className="px-3 py-1.5">{sale.company || "—"}</td>
              <td className="px-3 py-1.5">{sale.product || "—"}</td>
              <td className="px-3 py-1.5 tabular-nums">{formatIls(sale.premium)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CompanyBreakdown({
  productions,
  range,
}: {
  productions: MarketingProduction[];
  range: DateRange;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const inRange = productions.filter((row) => inSaleTransferRange(row, range) && isReportSale(row));
    const names = new Map<string, string>();
    for (const row of inRange) {
      const key = normalizeExcelText(row.company) || "בלי חברה";
      if (!names.has(key)) names.set(key, row.company?.trim() || "בלי חברה");
    }
    return Array.from(names.entries())
      .map(([key, name]) => {
        const companyRows = inRange.filter((row) => (normalizeExcelText(row.company) || "בלי חברה") === key);
        const premium = companyRows.reduce((sum, row) => sum + row.premium, 0);
        const context = productions.filter((row) => (normalizeExcelText(row.company) || "בלי חברה") === key);
        const income = insurerIncomeForProductions(companyRows, { yearContext: context });
        return {
          key,
          name,
          count: companyRows.length,
          premium: Math.round(premium),
          income,
        };
      })
      .sort((a, b) => b.premium - a.premium || a.name.localeCompare(b.name, "he"));
  }, [productions, range]);

  const totals = rows.reduce(
    (sum, row) => {
      sum.premium += row.premium;
      sum.income += row.income.income;
      sum.count += row.count;
      return sum;
    },
    { premium: 0, income: 0, count: 0 },
  );

  if (rows.length === 0) {
    return <p className="rounded-[1.25rem] border border-black/[0.06] bg-white px-5 py-10 text-center text-sm text-muted-foreground">אין חברות בטווח הזה.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        פרמיה לפי תאריך העברה ליצרן, והתשלום שמגיע מהחברה לפי החוזה. חברה בלי הסכם = ₪0.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="שורות" value={totals.count.toLocaleString("he-IL")} />
        <Stat label="פרמיה" value={formatIls(totals.premium)} />
        <Stat label="לתשלום מהחברות" value={formatIls(totals.income)} />
      </div>
      <div className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-[#fafaf8] text-[11px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">חברה</th>
              <th className="px-3 py-2 text-start font-medium">שורות</th>
              <th className="px-3 py-2 text-start font-medium">פרמיה</th>
              <th className="px-3 py-2 text-start font-medium">לתשלום</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = open === row.key;
              return (
                <Fragment key={row.key}>
                  <tr className="border-t border-black/[0.04]">
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setOpen(expanded ? null : row.key)} className="font-medium">
                        {row.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.count.toLocaleString("he-IL")}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatIls(row.premium)}</td>
                    <td className={cn("px-3 py-2.5 font-semibold tabular-nums", row.income.income <= 0 && "text-muted-foreground")}>
                      {formatIls(row.income.income)}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-black/[0.04] bg-[#fafaf8]">
                      <td colSpan={4} className="px-3 py-2 text-[12px]">
                        <p className="text-muted-foreground">{insurerIncomeNote(row.income)}</p>
                        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                          <Line label="היקף" value={formatIls(row.income.volume)} />
                          <Line label="נפרעים" value={formatIls(row.income.settled)} />
                          <Line label="מזומן" value={formatIls(row.income.cash)} />
                          <Line label="גמ״ח" value={formatIls(row.income.gamach)} />
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-white px-3 py-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
