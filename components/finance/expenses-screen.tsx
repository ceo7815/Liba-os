"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import {
  fixedCostLooksLikeShemesh,
  matchesOperatingBrand,
} from "@/lib/finance/operating-brand";
import { FixedExpensesScreen } from "@/components/finance/fixed-expenses-screen";
import {
  expensePeriodBounds,
  type ExpenseDatePreset,
  type FinanceFixedCostWithMeta,
} from "@/lib/finance/categories";
import { listFinanceFixedCosts } from "@/app/actions/finance-fixed-costs";
import { Input } from "@/components/ui/input";

export type ExpensesTab = "all" | "fixed" | "variable";

const TABS: { id: ExpensesTab; label: string }[] = [
  { id: "all", label: "כל ההוצאות" },
  { id: "fixed", label: "הוצאות קבועות" },
  { id: "variable", label: "הוצאות משתנות" },
];

const DATE_PRESETS: { id: ExpenseDatePreset; label: string }[] = [
  { id: "this_month", label: "החודש" },
  { id: "last_month", label: "חודש שעבר" },
  { id: "ytd", label: "מתחילת השנה" },
  { id: "range", label: "טווח תאריכים" },
];

function parseTab(value: string | null): ExpensesTab {
  if (value === "variable" || value === "fixed" || value === "all") return value;
  return "all";
}

function parsePreset(value: string | null): ExpenseDatePreset {
  if (
    value === "last_month" ||
    value === "range" ||
    value === "this_month" ||
    value === "ytd"
  ) {
    return value;
  }
  return "this_month";
}

function ils(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0₪";
  return `${n.toLocaleString("he-IL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}₪`;
}

function summarizeFixed(
  costs: FinanceFixedCostWithMeta[],
  kind?: "fixed" | "variable",
) {
  const scoped = kind
    ? costs.filter((c) => c.expense_kind === kind)
    : costs;
  const paidAmount = scoped.reduce(
    (s, c) => s + (c.this_month_amount ?? c.default_amount ?? 0),
    0,
  );
  const withInvoice = scoped.filter((c) => Boolean(c.invoice_storage_path))
    .length;
  const office = scoped.filter((c) => c.allocation_type === "office").length;
  const sources = scoped.filter((c) => c.allocation_type === "sources").length;
  return {
    count: scoped.length,
    paidAmount,
    withInvoice,
    office,
    sources,
  };
}

type ExpensesScreenProps = {
  initialFixedCosts: FinanceFixedCostWithMeta[];
};

export function ExpensesScreen({ initialFixedCosts }: ExpensesScreenProps) {
  const { brand } = useOperatingBrand();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabFromUrl = useMemo(
    () => parseTab(searchParams.get("tab")),
    [searchParams],
  );
  const presetFromUrl = useMemo(
    () => parsePreset(searchParams.get("period")),
    [searchParams],
  );
  const rangeFromUrl = searchParams.get("from");
  const rangeToUrl = searchParams.get("to");

  const [tab, setTab] = useState<ExpensesTab>(tabFromUrl);
  const [preset, setPreset] = useState<ExpenseDatePreset>(presetFromUrl);
  const [rangeFrom, setRangeFrom] = useState(rangeFromUrl ?? "");
  const [rangeTo, setRangeTo] = useState(rangeToUrl ?? "");
  const [fixedCosts, setFixedCosts] =
    useState<FinanceFixedCostWithMeta[]>(initialFixedCosts);
  const [loading, setLoading] = useState(initialFixedCosts.length === 0);

  const period = useMemo(
    () =>
      expensePeriodBounds({
        preset,
        from: rangeFrom,
        to: rangeTo,
      }),
    [preset, rangeFrom, rangeTo],
  );

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    setPreset(presetFromUrl);
  }, [presetFromUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await listFinanceFixedCosts({
        from: period.from,
        to: period.to,
      });
      if (cancelled) return;
      if (!res.error) setFixedCosts(res.costs);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [period.from, period.to]);

  function writeUrl(next: {
    tab?: ExpensesTab;
    period?: ExpenseDatePreset;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextTab = next.tab ?? tab;
    const nextPreset = next.period ?? preset;
    const nextFrom = next.from ?? rangeFrom;
    const nextTo = next.to ?? rangeTo;

    if (nextTab === "all") params.delete("tab");
    else params.set("tab", nextTab);

    if (nextPreset === "this_month") params.delete("period");
    else params.set("period", nextPreset);

    if (nextPreset === "range") {
      if (nextFrom) params.set("from", nextFrom);
      else params.delete("from");
      if (nextTo) params.set("to", nextTo);
      else params.delete("to");
    } else {
      params.delete("from");
      params.delete("to");
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function selectTab(next: ExpensesTab) {
    setTab(next);
    writeUrl({ tab: next });
  }

  function selectPreset(next: ExpenseDatePreset) {
    setPreset(next);
    if (next === "range" && !rangeFrom && !rangeTo) {
      const fallback = expensePeriodBounds({ preset: "this_month" });
      setRangeFrom(fallback.from);
      setRangeTo(fallback.to);
      writeUrl({ period: next, from: fallback.from, to: fallback.to });
      return;
    }
    writeUrl({ period: next });
  }

  const visibleCosts = useMemo(
    () =>
      fixedCosts.filter((cost) =>
        matchesOperatingBrand(
          fixedCostLooksLikeShemesh(cost) ? "shemesh" : "liba",
          brand,
        ),
      ),
    [fixedCosts, brand],
  );

  const fixedSummary = useMemo(
    () => summarizeFixed(visibleCosts, "fixed"),
    [visibleCosts],
  );
  const variableSummary = useMemo(
    () => summarizeFixed(visibleCosts, "variable"),
    [visibleCosts],
  );
  const allSummary = useMemo(() => summarizeFixed(visibleCosts), [visibleCosts]);
  const summary =
    tab === "variable"
      ? variableSummary
      : tab === "fixed"
        ? fixedSummary
        : allSummary;

  const tabLabel =
    TABS.find((t) => t.id === tab)?.label ?? "הוצאות";

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6"
      dir="rtl"
    >
      <header className="space-y-1 text-start">
        <p className="text-xs font-semibold text-muted-foreground">
          חשבונות ליבה
        </p>
        <h1 className="text-2xl font-bold tracking-tight">הוצאות</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          כל הוצאה כאן היא הוצאה ששולמה · בחרו בפופאפ קבועה או משתנה · שיוך
          משרד/מקורות וחשבוניות · סיכום לפי טאב ותקופה. תקורות משרד נשארות בליבה
          אלא אם סומנו שמש.
        </p>
      </header>

      <div
        className="flex gap-1 rounded-2xl border border-black/[0.06] bg-white p-1"
        role="tablist"
        aria-label="סוג הוצאה"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => selectTab(item.id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4",
              tab === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="app-surface space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            סיכום · {tabLabel}
            <span className="ms-2 text-xs font-medium text-muted-foreground">
              {period.label}
            </span>
          </p>
          {loading ? (
            <span className="text-xs text-muted-foreground">מעדכן…</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectPreset(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                preset === item.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === "range" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">מתאריך</label>
              <Input
                type="date"
                value={rangeFrom}
                onChange={(e) => {
                  setRangeFrom(e.target.value);
                  writeUrl({ from: e.target.value });
                }}
                className="h-9 w-[11rem] rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">עד תאריך</label>
              <Input
                type="date"
                value={rangeTo}
                onChange={(e) => {
                  setRangeTo(e.target.value);
                  writeUrl({ to: e.target.value });
                }}
                className="h-9 w-[11rem] rounded-xl"
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 border-t border-black/[0.05] pt-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/[0.06] bg-background/70 px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-medium text-muted-foreground">הוצאות</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
              {summary.count}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-medium text-emerald-800/80">
              סה״כ שולם
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-emerald-950">
              {ils(summary.paidAmount)}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/40 px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-medium text-sky-900/80">עם חשבונית</p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-sky-950">
              {summary.withInvoice}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/40 px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-medium text-violet-900/80">שיוך</p>
            <p className="mt-1 flex items-center justify-center gap-2 text-sm font-semibold tabular-nums tracking-tight text-violet-950">
              <span>
                משרד{" "}
                <span className="text-xl">{summary.office}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                מקורות{" "}
                <span className="text-xl">{summary.sources}</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      {tab === "all" ? (
        <FixedExpensesScreen
          initialCosts={fixedCosts}
          brandFilter={brand}
          embedded
          hideSummary
          showKindBadge
          periodFrom={period.from}
          periodTo={period.to}
          onCostsChange={setFixedCosts}
        />
      ) : null}

      {tab === "fixed" ? (
        <FixedExpensesScreen
          initialCosts={fixedCosts}
          brandFilter={brand}
          embedded
          hideSummary
          kindFilter="fixed"
          defaultExpenseKind="fixed"
          periodFrom={period.from}
          periodTo={period.to}
          onCostsChange={setFixedCosts}
        />
      ) : null}

      {tab === "variable" ? (
        <FixedExpensesScreen
          initialCosts={fixedCosts}
          brandFilter={brand}
          embedded
          hideSummary
          kindFilter="variable"
          defaultExpenseKind="variable"
          periodFrom={period.from}
          periodTo={period.to}
          onCostsChange={setFixedCosts}
        />
      ) : null}
    </div>
  );
}
