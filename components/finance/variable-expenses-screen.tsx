"use client";

import { CircleDashed, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/** תבנית — הוצאות משתנות (לא קבועות חודשיות). */
export function VariableExpensesScreen({
  embedded = false,
  hideSummary = false,
}: {
  embedded?: boolean;
  hideSummary?: boolean;
}) {
  return (
    <div className={cn("space-y-5", !embedded && "px-1")}>
      {!hideSummary ? (
        <div className="app-surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">0 רשומות</span>
          <span>·</span>
          <span>
            בתקופה{" "}
            <span className="font-semibold tabular-nums text-foreground">0₪</span>
          </span>
        </div>
      ) : null}

      <section className="app-surface px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-950">
            <Wallet className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">הוצאות משתנות</h2>
            <p className="text-sm text-muted-foreground">
              הוצאות חד-פעמיות / לא קבועות — ממתין להגדרת קטגוריות ורישום.
            </p>
          </div>
          <span className="ms-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950">
            בקרוב
          </span>
        </div>
      </section>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.12] bg-black/[0.02] px-6 py-16 text-center">
        <CircleDashed className="size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">אין הוצאות משתנות עדיין</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          כאן יירשמו הוצאות שאינן תקורות קבועות. הסיכום בראש הדף כבר מוכן לטאב
          הזה ולתקופה שנבחרה.
        </p>
      </div>
    </div>
  );
}
