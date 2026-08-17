import type { Metadata } from "next";
import { Contact } from "lucide-react";
import { listFinanceEmployees } from "@/app/actions/finance-people";
import { EmployeesPageClient } from "@/components/employees/employees-page-client";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "עובדים",
};

export default async function EmployeesPage() {
  await requireAdmin();
  const list = await listFinanceEmployees();
  const activeCount = list.employees.filter((e) => e.is_active).length;

  return (
    <section className="mx-auto max-w-[72rem] space-y-6">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">עובדים</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <Contact className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">עובדים</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              ספר העובדים של הסוכנות — שמות, מחלקות, חיוג וטלפונים. משכורות
              מוזנות בנפרד תחת פיננסים.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-black/[0.05] bg-background/80 px-4 py-3 text-center">
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {activeCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">עובדים פעילים</p>
          </div>
        </div>
        {list.error ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {list.error}
          </p>
        ) : null}
      </div>

      <EmployeesPageClient initialEmployees={list.employees} />
    </section>
  );
}
