"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSignature, ScrollText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { FinanceEmployee } from "@/lib/finance/categories";

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesEmployee(emp: FinanceEmployee, query: string) {
  const q = normalizeName(query);
  if (!q) return true;

  const haystack = normalizeName([emp.full_name, emp.department ?? ""].join(" "));
  if (haystack.includes(q)) return true;

  const parts = haystack.split(" ").filter(Boolean);
  const tokens = q.split(" ").filter(Boolean);
  return tokens.every((token) =>
    parts.some((part) => part.startsWith(token) || part.includes(token)),
  );
}

export function EmployeeAgreementsScreen({
  employees,
}: {
  employees: FinanceEmployee[];
}) {
  const [activeId, setActiveId] = useState(employees[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => employees.filter((emp) => matchesEmployee(emp, query)),
    [employees, query],
  );

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((emp) => emp.id === activeId)) {
      setActiveId(filtered[0].id);
    }
  }, [activeId, filtered]);

  const active = employees.find((row) => row.id === activeId) ?? employees[0];

  return (
    <section className="mx-auto max-w-[80rem] space-y-5" dir="rtl">
      <header className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-medium text-muted-foreground">עובדים</p>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
            <ScrollText className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">הסכמי עובדים</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          לכל עובד הסכם נפרד, ואז שכר לפי מה שכתוב בחוזה. עד שמעדכנים הסכם
          אין הוצאות שכר בדוחות היקף ונפרעים — אחרי השמירה זה מתעדכן
          אוטומטית. רשימת העובדים מגיעה מהאקסל, שם מול שם.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          רשימת העובדים מ
          <Link
            href="/employees"
            className="mx-1 font-medium text-foreground underline-offset-2 hover:underline"
          >
            רשימת עובדים
          </Link>
          .
        </p>
      </header>

      {employees.length === 0 ? (
        <div className="app-surface px-5 py-12 text-center sm:px-7">
          <p className="text-lg font-semibold">אין עובדים ברשימה</p>
          <p className="mt-2 text-sm text-muted-foreground">
            הוסיפו עובדים ב«רשימת עובדים» — השמות יופיעו כאן אוטומטית.
          </p>
        </div>
      ) : (
        <>
          <div className="app-surface p-3 sm:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי שם — גם שם פרטי, משפחה, או חלק מהשם"
                className="h-11 rounded-xl ps-10 pe-10 text-start"
                aria-label="חיפוש עובד לפי שם"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-2.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="ניקוי חיפוש"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {filtered.length} מתוך {employees.length}
            </p>

            {filtered.length === 0 ? (
              <p className="mt-3 rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                אין עובד בשם «{query.trim()}»
              </p>
            ) : (
              <div
                className="mt-3 flex max-h-[11.5rem] flex-wrap content-start gap-1.5 overflow-y-auto hide-scrollbar"
                role="tablist"
                aria-label="עובדים"
              >
                {filtered.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    role="tab"
                    aria-selected={activeId === emp.id}
                    onClick={() => setActiveId(emp.id)}
                    className={cn(
                      "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      activeId === emp.id
                        ? "bg-foreground text-background"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {emp.full_name}
                    <span
                      className={cn(
                        "mr-1.5 text-[10px] font-normal",
                        activeId === emp.id ? "opacity-80" : "opacity-70",
                      )}
                    >
                      · ממתין
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {active ? <WaitingForAgreementPanel employee={active} /> : null}
        </>
      )}
    </section>
  );
}

function WaitingForAgreementPanel({ employee }: { employee: FinanceEmployee }) {
  return (
    <section className="app-surface px-5 py-8 sm:px-7 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSignature className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{employee.full_name}</h2>
          </div>
          {employee.department ? (
            <p className="mt-1 text-sm text-muted-foreground">{employee.department}</p>
          ) : null}
        </div>
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
          ממתין להסכם
        </span>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        עדיין אין הסכם. בדוחות היקף ונפרעים אין הוצאות שכר לעובד הזה עד
        שמעדכנים הסכם — ואז החישוב מתעדכן אוטומטית לפי מה שנשמר.
      </p>

      <div className="mt-5 rounded-xl border border-black/[0.06] bg-muted/15 px-4 py-4">
        <p className="text-xs font-medium text-muted-foreground">היום בדוח</p>
        <p className="mt-1 text-sm font-semibold">
          שכר = 0 עד שיש הסכם שמור
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          יעד: שכר לפי סעיפי ההסכם של {employee.full_name}
        </p>
      </div>
    </section>
  );
}
