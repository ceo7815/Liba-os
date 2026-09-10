import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { listFinanceEmployees } from "@/app/actions/finance-people";
import { PayrollScreen } from "@/components/employees/payroll-screen";
import {
  OperatingBrandBar,
  OperatingBrandProvider,
} from "@/components/finance/operating-brand-bar";
import { requireEmployeesAccess } from "@/lib/auth";

export const metadata: Metadata = {
  title: "משכורות",
};

export default async function EmployeePayrollPage() {
  await requireEmployeesAccess();
  const list = await listFinanceEmployees();
  const activeCount = list.employees.filter((e) => e.is_active).length;

  return (
    <OperatingBrandProvider>
      <section className="mx-auto max-w-[90rem] space-y-3.5 sm:space-y-5">
        <header className="dash-enter">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
            עובדים · משכורות לפי הסכם
          </p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-highlight/35 sm:size-10">
                  <Wallet className="size-4 sm:size-5" />
                </span>
                <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight sm:text-3xl sm:leading-none">
                  משכורות
                </h1>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground sm:hidden">
                שכר קבוע · פרמיית היקף · נפרעים (עצמאי)
              </p>
              <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
                שלושה רכיבים לפי המערכת:{" "}
                <span className="font-medium text-foreground">שכר קבוע</span>
                {" · "}
                <span className="font-medium text-foreground">פרמיית היקף</span>
                {" · "}
                <span className="font-medium text-foreground">נפרעים</span>
                {" "}
                (רק עצמאי). שכיר לא מקבל נפרעים.
              </p>
            </div>
            <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white px-3.5 py-2.5 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:w-auto sm:flex-col sm:rounded-[var(--radius)] sm:px-4 sm:py-3 sm:text-center">
              <p className="text-[11px] text-muted-foreground sm:order-2 sm:mt-1">
                עובדים פעילים
              </p>
              <p className="text-xl font-semibold tabular-nums leading-none sm:order-1 sm:text-2xl">
                {activeCount}
              </p>
            </div>
          </div>
          {list.error ? (
            <p className="mt-3 rounded-[1.25rem] border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 sm:mt-4 sm:rounded-[var(--radius)] sm:px-4">
              {list.error}
            </p>
          ) : null}
        </header>
        <OperatingBrandBar />
        <PayrollScreen initialEmployees={list.employees} />
      </section>
    </OperatingBrandProvider>
  );
}
