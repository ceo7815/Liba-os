"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { LineChart, RefreshCw } from "lucide-react";
import type { GeneralPlSnapshot } from "@/app/actions/finance-general-pl";
import { getGeneralPlSnapshot } from "@/app/actions/finance-general-pl";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import {
  EXPENSES_PATH,
  INSURANCE_AGREEMENTS_PATH,
  SOURCE_PNL_PATH,
} from "@/lib/finance/access";
import {
  COMMISSION_SPLIT_FIELDS,
  formatIls,
} from "@/lib/finance/categories";
import {
  DATE_PRESET_LABEL,
  DATE_PRESET_ORDER,
  type DatePreset,
  type DateRange,
} from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useOperatingBrand } from "@/components/finance/operating-brand-bar";
import { OPERATING_BRAND_LABEL } from "@/lib/finance/operating-brand";

const CACHE_KEY = "liba-general-pl-v2";

type CachedEntry = {
  savedAt: string;
  snapshot: GeneralPlSnapshot;
};

type CacheStore = {
  version: 1;
  entries: Record<string, CachedEntry>;
};

type LoadStepStatus = "pending" | "active" | "done";

function rangeCacheKey(
  brand: string,
  preset: DatePreset,
  range: DateRange,
): string {
  const rangePart =
    preset === "custom" ? `custom:${range.from ?? ""}:${range.to ?? ""}` : preset;
  return `${brand}:${rangePart}`;
}

function readCacheStore(): CacheStore {
  if (typeof window === "undefined") return { version: 1, entries: {} };
  try {
    const raw =
      localStorage.getItem(CACHE_KEY) ?? sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { version: 1, entries: {} };
    const parsed = JSON.parse(raw) as CacheStore;
    if (parsed?.version !== 1 || !parsed.entries) {
      return { version: 1, entries: {} };
    }
    return parsed;
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeCacheEntry(key: string, snapshot: GeneralPlSnapshot) {
  try {
    const store = readCacheStore();
    store.entries[key] = {
      savedAt: new Date().toISOString(),
      snapshot,
    };
    const raw = JSON.stringify(store);
    localStorage.setItem(CACHE_KEY, raw);
    sessionStorage.setItem(CACHE_KEY, raw);
  } catch {
    /* quota / private mode */
  }
}

function readCacheEntry(key: string): CachedEntry | null {
  return readCacheStore().entries[key] ?? null;
}

function cell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatIls(n);
}

type Row =
  | { kind: "section"; label: string }
  | {
      kind: "line";
      label: string;
      excel: number | null;
      contractPending?: boolean;
      indent?: boolean;
      strong?: boolean;
      note?: string;
      negative?: boolean;
    };

export function GeneralPlScreen({
  initialPreset = "ytd",
  initialFrom = null,
  initialTo = null,
}: {
  initialPreset?: DatePreset;
  initialFrom?: string | null;
  initialTo?: string | null;
}) {
  const seedCustom: DateRange = {
    from: initialPreset === "custom" ? initialFrom : null,
    to: initialPreset === "custom" ? initialTo : null,
  };
  const { brand } = useOperatingBrand();

  const [snapshot, setSnapshot] = useState<GeneralPlSnapshot | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>(initialPreset);
  const [custom, setCustom] = useState<DateRange>(seedCustom);
  const [refreshing, setRefreshing] = useState(false);
  const [showingSaved, setShowingSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [excelStep, setExcelStep] = useState<LoadStepStatus>("pending");
  const [fixedStep, setFixedStep] = useState<LoadStepStatus>("pending");

  const applyCached = useCallback((entry: CachedEntry) => {
    setSnapshot(entry.snapshot);
    setCachedAt(entry.savedAt);
    setPreset(entry.snapshot.preset);
    if (entry.snapshot.preset === "custom") {
      setCustom({ from: entry.snapshot.from, to: entry.snapshot.to });
    }
    setShowingSaved(true);
  }, []);

  useLayoutEffect(() => {
    const key = rangeCacheKey(brand, initialPreset, seedCustom);
    const entry = readCacheEntry(key);
    if (entry) applyCached(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const fetchSnapshot = useCallback(
    async (nextPreset: DatePreset, nextCustom: DateRange) => {
      setRefreshing(true);
      setExcelStep("active");
      setFixedStep("pending");
      setLoadError(null);

      try {
        const result = await getGeneralPlSnapshot({
          preset: nextPreset,
          from: nextPreset === "custom" ? nextCustom.from : null,
          to: nextPreset === "custom" ? nextCustom.to : null,
          brand,
        });

        setExcelStep("done");
        setFixedStep("active");

        if (result.error || !result.snapshot) {
          setLoadError(result.error ?? "טעינה נכשלה");
          setFixedStep("done");
          return;
        }

        const key = rangeCacheKey(brand, nextPreset, nextCustom);
        writeCacheEntry(key, result.snapshot);
        setSnapshot(result.snapshot);
        setCachedAt(new Date().toISOString());
        setShowingSaved(false);
        setFixedStep("done");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "טעינה נכשלה");
        setExcelStep("done");
        setFixedStep("done");
      } finally {
        setRefreshing(false);
      }
    },
    [brand],
  );

  useEffect(() => {
    const key = rangeCacheKey(brand, initialPreset, seedCustom);
    if (readCacheEntry(key)) return;
    void fetchSnapshot(initialPreset, seedCustom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, fetchSnapshot]);

  useEffect(() => {
    const onGlobalSync = () => {
      void fetchSnapshot(preset, custom);
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
    return () => window.removeEventListener(GLOBAL_SYNC_EVENT, onGlobalSync);
  }, [custom, fetchSnapshot, preset]);

  function applyPreset(nextPreset: DatePreset, nextCustom: DateRange = custom) {
    setPreset(nextPreset);
    setCustom(nextCustom);
    const key = rangeCacheKey(brand, nextPreset, nextCustom);
    const entry = readCacheEntry(key);
    if (entry) {
      applyCached(entry);
      return;
    }
    setSnapshot(null);
    setCachedAt(null);
    setShowingSaved(false);
    void fetchSnapshot(nextPreset, nextCustom);
  }

  const x = snapshot?.excel;
  const f = snapshot?.fixed;
  const showBanner = refreshing;
  const lastUpdatedLabel =
    formatLastUpdatedAt(x?.excelAsOf) ??
    formatLastUpdatedAt(cachedAt) ??
    (showBanner && !snapshot ? "טוען…" : null);

  const rows: Row[] = useMemo(() => {
    if (!x || !f) return [];
    return [
      { kind: "section", label: "הכנסות מעמלות" },
      {
        kind: "line",
        label: "פרמיה (סגירות פעילות באקסל)",
        excel: x.premium,
        note: `${x.closures} סגירות לפי תאריך הפקה`,
      },
      {
        kind: "line",
        label: "הכנסה מחברות ביטוח",
        excel: x.income,
        strong: true,
        note: `פרמיה × ${x.insurerMultiplier}`,
      },
      ...COMMISSION_SPLIT_FIELDS.map((field) => ({
        kind: "line" as const,
        label: field.label,
        excel: null,
        contractPending: true,
        indent: true,
        note:
          field.id === "settled"
            ? "פיצול מהסכם חברות הביטוח — לא מהסכם העובד"
            : "פיצול מהסכם חברות הביטוח",
      })),
      {
        kind: "line",
        label: "ביטולים / קיזוזים",
        excel: null,
        contractPending: true,
        note: "מהסכם חברות הביטוח",
      },

      { kind: "section", label: "עלות מכירה" },
      {
        kind: "line",
        label: "שכר / עמלות עובדים",
        excel: x.wageTotal,
        note: "לפי הסכם העובד באקסל",
      },
      {
        kind: "line",
        label: "שיווק ופרסום",
        excel: x.adsTotal,
        note: "מדשבורד המקורות",
      },

      { kind: "section", label: "תפעול" },
      {
        kind: "line",
        label: `תקורות קבועות (צפי × ${f.monthsCovered} ח׳)`,
        excel: x.fixedExpected,
        note: "מהקטלוג",
      },

      { kind: "section", label: "שורה תחתונה" },
      {
        kind: "line",
        label: "רווח / הפסד (לפני תקורות)",
        excel: x.net,
        strong: true,
        negative: x.net < 0,
      },
      {
        kind: "line",
        label: "רווח / הפסד כולל תקורות צפויות",
        excel: x.netAfterFixed,
        strong: true,
        negative: x.netAfterFixed < 0,
      },
    ];
  }, [x, f]);

  const fixedExpectedTotal = useMemo(
    () =>
      f?.rows.reduce((sum, row) => sum + (row.expected ?? 0), 0) ?? 0,
    [f],
  );
  const fixedPaidTotal = useMemo(
    () => f?.rows.reduce((sum, row) => sum + row.paid, 0) ?? 0,
    [f],
  );

  return (
    <section className="mx-auto w-full max-w-[72rem] space-y-6" dir="rtl">
      {showBanner ? (
        <LoadProgressBanner excel={excelStep} fixed={fixedStep} />
      ) : null}
      {showBanner && showingSaved && snapshot ? (
        <p className="text-center text-xs text-muted-foreground">
          מוצגים נתונים מהביקור האחרון · מתעדכן ברקע…
        </p>
      ) : null}

      <header className="dash-enter">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground sm:text-xs">
          חשבונות ליבה · {OPERATING_BRAND_LABEL[brand]}
        </p>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-highlight/35">
                <LineChart className="size-5" />
              </span>
              <h1 className="text-3xl font-semibold leading-none tracking-tight">
                דוח רווח והפסד
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              מקור האמת: אקסל המנהלים
              {snapshot ? (
                <>
                  <span className="mx-1.5 text-black/20">·</span>
                  <span dir="ltr" className="font-medium tabular-nums text-foreground">
                    {snapshot.rangeDisplay}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <LastUpdatedPanel
            excelLabel={lastUpdatedLabel}
            fetchedLabel={
              cachedAt
                ? formatLastUpdatedAt(cachedAt)
                : null
            }
            loading={showBanner}
            fromCache={showingSaved}
          />
        </div>
      </header>

      <div
        className="dash-enter relative overflow-hidden rounded-[var(--radius)] border border-black/[0.06] bg-white p-5 shadow-[0_1px_0_rgba(17,17,17,0.03)]"
        style={{ animationDelay: "40ms" }}
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-highlight" />
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESET_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95",
                preset === key
                  ? "bg-black text-white"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {DATE_PRESET_LABEL[key]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-semibold tracking-tight">
            {DATE_PRESET_LABEL[preset]}
          </span>
          {snapshot ? (
            <span dir="ltr" className="text-sm font-medium tabular-nums text-muted-foreground">
              {snapshot.rangeDisplay}
            </span>
          ) : null}
        </div>
        {preset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="date"
              className="h-10 w-40 rounded-xl border-black/[0.06]"
              value={custom.from ?? ""}
              onChange={(e) => {
                const next = {
                  ...custom,
                  from: e.target.value || null,
                };
                setCustom(next);
                if (next.from && next.to) applyPreset("custom", next);
              }}
            />
            <span className="text-xs text-muted-foreground">עד</span>
            <Input
              type="date"
              className="h-10 w-40 rounded-xl border-black/[0.06]"
              value={custom.to ?? ""}
              onChange={(e) => {
                const next = { ...custom, to: e.target.value || null };
                setCustom(next);
                if (next.from && next.to) applyPreset("custom", next);
              }}
            />
          </div>
        ) : null}
      </div>

      {!snapshot && showBanner ? (
        <p className="text-center text-sm text-muted-foreground">
          טוען נתונים — אין עדיין דוח שמור להצגה…
        </p>
      ) : null}

      {snapshot && x ? (
        <div
          className="dash-enter grid grid-cols-2 gap-3 xl:grid-cols-4"
          style={{ animationDelay: "80ms" }}
        >
          <SummaryCube
            label="הכנסה מחברות"
            value={formatIls(x.income)}
            hint={`פרמיה × ${x.insurerMultiplier}`}
            accent="highlight"
          />
          <SummaryCube
            label="שכר עובדים"
            value={formatIls(x.wageTotal)}
            hint={`${x.closures.toLocaleString("he-IL")} סגירות`}
            accent="neutral"
          />
          <SummaryCube
            label="שיווק"
            value={formatIls(x.adsTotal)}
            hint="הוצאות מקורות"
            accent="neutral"
          />
          <SummaryCube
            label="רווח / הפסד"
            value={formatIls(x.net)}
            hint="לפני תקורות"
            accent={x.net >= 0 ? "profit" : "loss"}
            tone={x.net >= 0 ? "ok" : "loss"}
          />
        </div>
      ) : null}

      {(loadError || x?.error) && (
        <p className="rounded-[var(--radius)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {loadError ?? x?.error}
        </p>
      )}

      {snapshot && x && f ? (
        <div
          className="dash-enter flex flex-col gap-5"
          style={{ animationDelay: "100ms" }}
        >
          <div className="overflow-hidden rounded-[var(--radius)] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5">
              <div>
                <p className="text-sm font-semibold tracking-tight">פירוט הדוח</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  אקסל מול חוזה · {DATE_PRESET_LABEL[preset]}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-[#f7f7f7] text-muted-foreground">
                    <th className="px-5 py-3 text-start text-[11px] font-semibold tracking-tight">
                      סעיף
                    </th>
                    <th className="w-[12rem] px-4 py-3 text-end text-[11px] font-semibold tracking-tight sm:w-[14rem]">
                      אקסל
                      <span className="mt-0.5 block font-normal opacity-70">
                        מקור האמת
                      </span>
                    </th>
                    <th className="w-[11rem] whitespace-nowrap px-5 py-3 text-end text-[11px] font-semibold tracking-tight sm:w-[12rem]">
                      לפי חוזה ביטוח
                      <span className="mt-0.5 block font-normal opacity-70">
                        נפרעים ופיצולים
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) =>
                    row.kind === "section" ? (
                      <tr key={`s-${idx}`} className="bg-[#fafafa]">
                        <td
                          colSpan={3}
                          className="px-5 py-2.5 text-[11px] font-bold tracking-wide text-muted-foreground"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-highlight" />
                            {row.label}
                          </span>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={`l-${idx}`}
                        className={cn(
                          "border-b border-black/[0.04] last:border-0",
                          row.strong && "bg-highlight/20",
                        )}
                      >
                        <td
                          className={cn(
                            "py-3.5 text-start align-top",
                            row.indent ? "ps-10 pe-5" : "px-5",
                          )}
                        >
                          <span
                            className={cn(
                              "leading-snug",
                              row.strong ? "font-semibold" : "font-medium",
                            )}
                          >
                            {row.label}
                          </span>
                          {row.note ? (
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                              {row.note}
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3.5 text-end align-top tabular-nums tracking-tight",
                            row.strong ? "text-base font-semibold" : "text-[15px]",
                            row.negative && "text-red-700",
                            row.strong && !row.negative && row.excel != null && row.excel > 0 && "text-emerald-800",
                          )}
                        >
                          {cell(row.excel)}
                        </td>
                        <td className="px-5 py-3.5 text-end align-top">
                          {row.contractPending ? (
                            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                              ממתין להסכם ביטוח
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[var(--radius)] border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)]">
            <span className="absolute inset-y-0 start-0 w-1 bg-highlight" />
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06] px-5 py-3.5 ps-6">
              <div>
                <p className="text-sm font-semibold tracking-tight">
                  תקורות קבועות
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  צפי לטווח · {f.rows.length} סעיפים
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  סה״כ צפוי{" "}
                  <span className="ms-1.5 font-semibold tabular-nums text-foreground">
                    {formatIls(fixedExpectedTotal)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  סה״כ נרשם{" "}
                  <span className="ms-1.5 font-semibold tabular-nums text-foreground">
                    {formatIls(fixedPaidTotal)}
                  </span>
                </span>
                <Link
                  href={EXPENSES_PATH}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  ניהול תקורות
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-[#f7f7f7] text-[11px] text-muted-foreground">
                    <th className="px-5 py-2.5 text-start font-semibold">הוצאה</th>
                    <th className="w-[12rem] px-4 py-2.5 text-end font-semibold">
                      צפוי
                    </th>
                    <th className="w-[12rem] px-5 py-2.5 text-end font-semibold">
                      נרשם
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {f.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-8 text-center text-xs text-muted-foreground"
                      >
                        אין תקורות בקטלוג
                      </td>
                    </tr>
                  ) : (
                    f.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-black/[0.04] last:border-0"
                      >
                        <td className="px-5 py-3 font-medium">{row.title}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums">
                          {row.expected == null
                            ? "—"
                            : formatIls(row.expected)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums text-muted-foreground">
                          {formatIls(row.paid)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { href: SOURCE_PNL_PATH, label: "פירוט לפי מקור" },
          { href: INSURANCE_AGREEMENTS_PATH, label: "הסכמי ביטוח" },
          { href: "/employees", label: "עובדים" },
          { href: EXPENSES_PATH, label: "הוצאות" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-[0_1px_0_rgba(17,17,17,0.03)] ring-1 ring-black/[0.06] transition-colors hover:bg-[#fffcf0] hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function LoadProgressBanner({
  excel,
  fixed,
}: {
  excel: LoadStepStatus;
  fixed: LoadStepStatus;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:px-5">
      <p className="text-xs font-semibold text-foreground">טוען נתונים…</p>
      <div className="mt-2 space-y-2">
        <LoadProgressStep label="מושך נתונים מהאקסל" status={excel} />
        <LoadProgressStep label="מחשב תקורות וסיכום" status={fixed} />
      </div>
    </div>
  );
}

function LoadProgressStep({
  label,
  status,
}: {
  label: string;
  status: LoadStepStatus;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors",
        status === "active" && "bg-highlight/25 text-foreground",
        status === "done" && "text-muted-foreground",
        status === "pending" && "text-muted-foreground/50",
      )}
    >
      {status === "done" ? (
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
          ✓
        </span>
      ) : status === "active" ? (
        <RefreshCw className="size-4 shrink-0 animate-spin text-foreground" />
      ) : (
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-black/10" />
      )}
      <span className={cn(status === "active" && "animate-pulse font-medium")}>
        {label}
      </span>
    </div>
  );
}

function LastUpdatedPanel({
  excelLabel,
  fetchedLabel,
  loading,
  fromCache,
}: {
  excelLabel: string | null;
  fetchedLabel: string | null;
  loading: boolean;
  fromCache: boolean;
}) {
  return (
    <div className="w-full min-w-[16rem] rounded-[var(--radius)] border border-black/[0.06] bg-white px-3.5 py-3 text-xs shadow-[0_1px_0_rgba(17,17,17,0.03)] lg:w-[18rem]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-foreground">
          עדכון אחרון
        </p>
        {loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <RefreshCw className="size-3 animate-spin" />
            מסנכרן…
          </span>
        ) : fromCache ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            שמירה אחרונה
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            מעודכן
          </span>
        )}
      </div>
      <dl className="mt-2 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 font-medium text-muted-foreground">אקסל</dt>
          <dd
            dir="ltr"
            className={cn(
              "text-end tabular-nums leading-snug",
              excelLabel ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {excelLabel ?? (loading ? "טוען…" : "—")}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 font-medium text-muted-foreground">דוח זה</dt>
          <dd
            dir="ltr"
            className={cn(
              "text-end tabular-nums leading-snug",
              fromCache && "text-amber-800",
              fetchedLabel ? "font-medium" : "text-muted-foreground",
            )}
          >
            {fetchedLabel
              ? fromCache
                ? `שמור · ${fetchedLabel}`
                : fetchedLabel
              : loading
                ? "טוען…"
                : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function SummaryCube({
  label,
  value,
  hint,
  tone,
  accent = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "loss";
  accent?: "highlight" | "neutral" | "profit" | "loss";
}) {
  const accentClass =
    accent === "profit"
      ? "bg-emerald-500"
      : accent === "loss"
        ? "bg-red-500"
        : accent === "highlight"
          ? "bg-highlight"
          : "bg-zinc-300";

  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-black/[0.06] bg-white px-4 py-4 text-start shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:px-5">
      <span className={cn("absolute inset-y-0 start-0 w-1", accentClass)} />
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
          tone === "ok" && "text-emerald-700",
          tone === "loss" && "text-red-700",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
