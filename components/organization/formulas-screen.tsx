"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Search } from "lucide-react";
import { CALCULATION_FORMULAS, FORMULA_CATEGORIES } from "@/lib/formulas/catalog";
import type { FormulaCategoryId, FormulaDoc } from "@/lib/formulas/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterId = "all" | FormulaCategoryId;

function matchesQuery(row: FormulaDoc, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.title,
    row.summary,
    row.equation,
    ...(row.terms ?? []).flatMap((term) => [term.label, term.value]),
    ...(row.notes ?? []),
    row.example?.given ?? "",
    row.example?.result ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function FormulasScreen() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    return CALCULATION_FORMULAS.filter((row) => {
      if (filter !== "all" && row.category !== filter) return false;
      return matchesQuery(row, needle);
    });
  }, [filter, needle]);

  const grouped = useMemo(() => {
    return FORMULA_CATEGORIES.map((category) => ({
      category,
      rows: visible.filter((row) => row.category === category.id),
    })).filter((group) => group.rows.length > 0);
  }, [visible]);

  return (
    <section className="mx-auto max-w-[72rem] space-y-6" dir="rtl">
      <div className="app-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">ארגון</p>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-highlight/35">
                <Calculator className="size-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">נוסחאות חישוב</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              כל נוסחת החישוב שרצה במערכת — לידים, שכר עצמאים, שותפים, שכירים ורווח והפסד.
              המספרים מגיעים מהקוד החי, וכל נוסחה חדשה חייבת להירשם כאן.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-black/[0.05] bg-background/80 px-4 py-3 text-center">
            <p className="text-2xl font-semibold tabular-nums leading-none">
              {CALCULATION_FORMULAS.length}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">נוסחאות</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש נוסחה, מקור או אחוז…"
              className="h-11 rounded-xl ps-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="הכל"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {FORMULA_CATEGORIES.map((category) => (
              <FilterChip
                key={category.id}
                label={category.label}
                active={filter === category.id}
                onClick={() => setFilter(category.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="app-surface px-5 py-8 text-center text-sm text-muted-foreground">
          אין נוסחה שמתאימה לחיפוש.
        </p>
      ) : (
        grouped.map(({ category, rows }) => (
          <section key={category.id} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{category.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{category.description}</p>
            </div>
            <div className="grid gap-3">
              {rows.map((row) => (
                <FormulaCard key={row.id} row={row} />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-black bg-black text-white"
          : "border-black/[0.08] bg-white text-foreground hover:border-black/20",
      )}
    >
      {label}
    </button>
  );
}

function FormulaCard({ row }: { row: FormulaDoc }) {
  return (
    <article className="app-surface space-y-4 px-5 py-5 sm:px-6">
      <div>
        <h3 className="text-base font-semibold">{row.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.summary}</p>
      </div>
      <p className="overflow-x-auto rounded-xl bg-[#f4f8ff] px-3 py-2.5 text-sm font-medium tabular-nums leading-relaxed">
        {row.equation}
      </p>
      {row.terms?.length ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {row.terms.map((term) => (
            <div key={term.label} className="rounded-xl bg-muted/20 px-3 py-2">
              <dt className="text-[11px] text-muted-foreground">{term.label}</dt>
              <dd className="mt-0.5 text-sm font-medium leading-snug">{term.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {row.example ? (
        <p className="text-sm leading-relaxed">
          <span className="font-medium">דוגמה: </span>
          {row.example.given}
          {" → "}
          <span className="font-semibold">{row.example.result}</span>
        </p>
      ) : null}
      {row.notes?.length ? (
        <ul className="list-disc space-y-1 ps-5 text-[13px] leading-relaxed text-muted-foreground">
          {row.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {row.usedIn?.length ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span>בשימוש:</span>
          {row.usedIn.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-black"
            >
              {link.label}
            </Link>
          ))}
        </p>
      ) : null}
    </article>
  );
}
