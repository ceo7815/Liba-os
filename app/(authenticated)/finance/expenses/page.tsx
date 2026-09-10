import type { Metadata } from "next";
import { Suspense } from "react";
import { listFinanceFixedCosts } from "@/app/actions/finance-fixed-costs";
import { ExpensesScreen } from "@/components/finance/expenses-screen";
import { requireFinanceAccess } from "@/lib/auth";
import { expensePeriodBounds } from "@/lib/finance/categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הוצאות",
};

export default async function ExpensesPage() {
  await requireFinanceAccess();
  const period = expensePeriodBounds({ preset: "this_month" });
  const { costs } = await listFinanceFixedCosts({
    from: period.from,
    to: period.to,
  });

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          טוען הוצאות…
        </div>
      }
    >
      <ExpensesScreen initialFixedCosts={costs} />
    </Suspense>
  );
}
