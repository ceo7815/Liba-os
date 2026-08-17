import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import {
  getFinanceMonthSummary,
  listFinanceEntries,
} from "@/app/actions/finance";
import {
  listFinanceEmployees,
  listFinanceSuppliers,
} from "@/app/actions/finance-people";
import { requireAdmin } from "@/lib/auth";
import { formatIls, monthRange } from "@/lib/finance/categories";
import { FinancePanel } from "@/components/finance/finance-panel";

export const metadata: Metadata = {
  title: "פיננסים",
};

export default async function FinancePage() {
  await requireAdmin();
  const range = monthRange();

  const [summary, list, people, vendors] = await Promise.all([
    getFinanceMonthSummary(),
    listFinanceEntries({ from: range.from, to: range.to }),
    listFinanceEmployees(),
    listFinanceSuppliers(),
  ]);

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">עבודה</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <Wallet className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">פיננסים</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              רישום ידני של הכנסות מעמלות, הוצאות משרד, משכורות עובדים ודוח
              רווח והפסד. רשימת העובדים נמצאת בקטגוריה נפרדת.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="הכנסות" value={formatIls(summary.incomeTotal)} />
            <Stat
              label="ביטולים"
              value={formatIls(summary.adjustmentTotal)}
            />
            <Stat label="הוצאות" value={formatIls(summary.expenseTotal)} />
            <Stat
              label="רווח חודשי"
              value={formatIls(summary.operatingProfit)}
              emphasize
            />
          </div>
        </div>
        {summary.error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {summary.error}
          </p>
        ) : null}
      </div>

      <FinancePanel
        initialEntries={list.entries}
        initialEmployees={people.employees}
        initialSuppliers={vendors.suppliers}
        initialFrom={range.from}
        initialTo={range.to}
        listError={list.error}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/[0.05] bg-background/80 px-3 py-2.5 text-center ${
        emphasize ? "border-black/20" : ""
      }`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
