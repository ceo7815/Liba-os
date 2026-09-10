import type { Metadata } from "next";
import { listFinanceEmployees } from "@/app/actions/finance-people";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import {
  OperatingBrandBar,
  OperatingBrandProvider,
} from "@/components/finance/operating-brand-bar";
import { requireEmployeesAccess } from "@/lib/auth";

export const metadata: Metadata = {
  title: "עובדים",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmployeesPage() {
  await requireEmployeesAccess();
  const list = await listFinanceEmployees();
  const activeCount = list.employees.filter((e) => e.is_active).length;

  return (
    <OperatingBrandProvider>
      <section className="mx-auto w-full max-w-[72rem] space-y-4 sm:space-y-6">
        <header className="dash-enter px-0.5 sm:px-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
            עובדים · הסכמים ונוכחות
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h1 className="text-[1.65rem] font-semibold leading-none tracking-tight sm:text-3xl">
              עובדים
            </h1>
            <div className="shrink-0 rounded-2xl border border-black/[0.06] bg-white px-3.5 py-2 text-center shadow-[0_1px_0_rgba(17,17,17,0.03)]">
              <p className="text-lg font-semibold tabular-nums leading-none sm:text-xl">
                {activeCount}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                פעילים
              </p>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            לחצו על כרטיס להסכם ולנוכחות. שכר לפי תאריך הפקה — היקף בנפרד מנפרעים.
          </p>
          {list.error ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {list.error}
            </p>
          ) : null}
        </header>

        <div className="dash-enter" style={{ animationDelay: "40ms" }}>
          <OperatingBrandBar />
        </div>

        <div className="dash-enter" style={{ animationDelay: "80ms" }}>
          <EmployeesPageClient initialEmployees={list.employees} />
        </div>
      </section>
    </OperatingBrandProvider>
  );
}
