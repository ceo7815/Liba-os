"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Database, Rows3, Search, X } from "lucide-react";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { SalesEntryAudit } from "@/components/sales-dashboard/sales-entry-audit";
import { SalesExcelGrid, type SortState } from "@/components/sales-dashboard/sales-excel-grid";
import { SalesExcelInspector } from "@/components/sales-dashboard/sales-excel-inspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  assignOperatingBrand,
  matchesOperatingBrand,
  OPERATING_BRAND_LABEL,
  type OperatingBrandId,
} from "@/lib/finance/operating-brand";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import {
  findHeaderIndex,
  formatWorkbookDateDisplay,
  isDateHeader,
  isPolicyHeader,
  parsePremiumCell,
  parseWorkbookDate,
  premiumColumnIndex,
  workbookFromDashboard,
  type SalesWorkbookPayload,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

function compareCells(a: string, b: string, header: string): number {
  if (isDateHeader(header)) {
    const da = parseWorkbookDate(a);
    const db = parseWorkbookDate(b);
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
  }
  const na = Number(String(a).replace(/,/g, ""));
  const nb = Number(String(b).replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && a.trim() !== "" && b.trim() !== "") {
    return na - nb;
  }
  return a.localeCompare(b, "he", { numeric: true, sensitivity: "base" });
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayInJerusalem(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
}

function presetDates(preset: "month" | "prev" | "year"): { from: string; to: string } {
  const { year, month, day } = todayInJerusalem();
  if (preset === "year") return { from: isoDay(year, 1, 1), to: isoDay(year, month, day) };
  if (preset === "month") return { from: isoDay(year, month, 1), to: isoDay(year, month, day) };
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  return { from: isoDay(prevYear, prevMonth, 1), to: isoDay(prevYear, prevMonth, lastDay) };
}

function utcStart(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function uniqueSorted(rows: WorkbookRow[], col: number): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = row.cells[col] ?? "";
    if (value) values.add(value);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "he", { numeric: true, sensitivity: "base" }));
}

async function fetchWorkbook(): Promise<SalesWorkbookPayload> {
  const res = await fetch("/api/sales-dashboard/workbook", { cache: "no-store" });
  if (!res.ok) throw new Error("workbook");
  return (await res.json()) as SalesWorkbookPayload;
}

export function SalesExcelReportScreen({ initial }: { initial?: SalesWorkbookPayload | null }) {
  const { dashboard } = useLiveDashboard();
  const [remote, setRemote] = useState<SalesWorkbookPayload | null>(initial ?? null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">(
    initial?.sheets.length ? "ok" : "loading",
  );
  const [sheetIndex, setSheetIndex] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<number, string[]>>({});
  const [quick, setQuick] = useState({ status: "", process: "", agent: "" });
  const [brand, setBrand] = useState<OperatingBrandId>("all");
  const [policyQuery, setPolicyQuery] = useState("");
  const deferredPolicy = useDeferredValue(policyQuery);
  const [dateCol, setDateCol] = useState(-1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (initial?.sheets.length) {
      setLoadState("ok");
    }
    fetchWorkbook()
      .then((data) => {
        if (cancelled) return;
        setRemote(data);
        setLoadState("ok");
      })
      .catch(() => {
        if (!cancelled && !initial?.sheets.length) setLoadState("error");
      });
    const onSync = () => {
      void fetchWorkbook()
        .then((data) => {
          if (!cancelled) {
            setRemote(data);
            setLoadState("ok");
          }
        })
        .catch(() => undefined);
    };
    window.addEventListener(GLOBAL_SYNC_EVENT, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(GLOBAL_SYNC_EVENT, onSync);
    };
  }, [initial]);

  const workbook = useMemo(() => {
    if (remote?.sheets?.length) return remote;
    const fromDash = workbookFromDashboard(dashboard);
    return {
      ...fromDash,
      syncedAt: dashboard?.syncedAt ?? remote?.syncedAt ?? null,
      stored: Boolean(remote?.stored),
    } satisfies SalesWorkbookPayload;
  }, [remote, dashboard]);

  const sheet: WorkbookSheet | null = workbook.sheets[sheetIndex] ?? workbook.sheets[0] ?? null;

  useEffect(() => {
    setSort(null);
    setFilters({});
    setQuery("");
    setQuick({ status: "", process: "", agent: "" });
    setPolicyQuery("");
    setDateFrom("");
    setDateTo("");
    setSelectedId(null);
    setPage(0);
  }, [sheetIndex, sheet?.name]);

  const statusCol = sheet ? findHeaderIndex(sheet.headers, "סטאטוס", "סטטוס") : -1;
  const processCol = sheet ? findHeaderIndex(sheet.headers, "סוג תהליך", "תהליך") : -1;
  const agentCol = sheet ? findHeaderIndex(sheet.headers, "משווק") : -1;
  const sourceCol = sheet ? findHeaderIndex(sheet.headers, "מקור") : -1;
  const premiumCol = sheet ? premiumColumnIndex(sheet.headers) : -1;
  const policyCol = sheet ? sheet.headers.findIndex((header) => isPolicyHeader(header)) : -1;

  const dateColumns = useMemo(() => {
    if (!sheet) return [] as { header: string; index: number }[];
    return sheet.headers
      .map((header, index) => ({ header, index }))
      .filter((item) => item.header && isDateHeader(item.header));
  }, [sheet]);

  const preferredDateCol = dateColumns.find((item) => item.header.includes("העברה"))?.index
    ?? dateColumns.find((item) => item.header.includes("תחילת"))?.index
    ?? dateColumns[0]?.index
    ?? -1;

  useEffect(() => {
    setDateCol(preferredDateCol);
  }, [preferredDateCol, sheet?.name]);

  const dateIndex = useMemo(() => {
    if (!sheet || dateCol < 0) return [] as Array<number | null>;
    return sheet.rows.map((row) => parseWorkbookDate(row.cells[dateCol] ?? ""));
  }, [sheet, dateCol]);

  const hasQuery = deferredQuery.trim().length > 0;
  const searchBlobs = useMemo(() => {
    if (!sheet || !hasQuery) return null;
    return sheet.rows.map((row) =>
      row.cells
        .map((cell, index) => {
          const header = sheet.headers[index] ?? "";
          return isDateHeader(header) ? formatWorkbookDateDisplay(cell) : cell;
        })
        .join("\u0001")
        .toLowerCase(),
    );
  }, [sheet, hasQuery]);

  const agents = useMemo(
    () => (sheet && agentCol >= 0 ? uniqueSorted(sheet.rows, agentCol) : []),
    [sheet, agentCol],
  );
  const statuses = useMemo(
    () => (sheet && statusCol >= 0 ? uniqueSorted(sheet.rows, statusCol) : []),
    [sheet, statusCol],
  );
  const processes = useMemo(
    () => (sheet && processCol >= 0 ? uniqueSorted(sheet.rows, processCol) : []),
    [sheet, processCol],
  );
  const brandCounts = useMemo(() => {
    const counts = { liba: 0, shemesh: 0 };
    if (!sheet || (agentCol < 0 && sourceCol < 0)) return counts;
    for (const row of sheet.rows) {
      const assigned = assignOperatingBrand({
        agent: agentCol >= 0 ? row.cells[agentCol] : "",
        source: sourceCol >= 0 ? row.cells[sourceCol] : "",
      });
      counts[assigned] += 1;
    }
    return counts;
  }, [sheet, agentCol, sourceCol]);

  const visible = useMemo(() => {
    if (!sheet) return [];
    const needle = deferredQuery.trim().toLowerCase();
    const policyNeedle = deferredPolicy.replace(/\s/g, "").toLowerCase();
    const fromTs = dateFrom ? utcStart(dateFrom) : null;
    const toTs = dateTo ? utcStart(dateTo) : null;
    let rows = sheet.rows.filter((row, index) => {
      if (quick.status && statusCol >= 0 && (row.cells[statusCol] ?? "") !== quick.status) return false;
      if (quick.process && processCol >= 0 && (row.cells[processCol] ?? "") !== quick.process) return false;
      if (quick.agent && agentCol >= 0 && (row.cells[agentCol] ?? "") !== quick.agent) return false;
      if (brand !== "all") {
        const assigned = assignOperatingBrand({
          agent: agentCol >= 0 ? row.cells[agentCol] : "",
          source: sourceCol >= 0 ? row.cells[sourceCol] : "",
        });
        if (!matchesOperatingBrand(assigned, brand)) return false;
      }
      if (policyNeedle && policyCol >= 0) {
        const policy = (row.cells[policyCol] ?? "").replace(/\s/g, "").toLowerCase();
        if (!policy.includes(policyNeedle)) return false;
      }
      if ((fromTs != null || toTs != null) && dateCol >= 0) {
        const stamp = dateIndex[index];
        if (stamp == null) return false;
        if (fromTs != null && stamp < fromTs) return false;
        if (toTs != null && stamp > toTs + 86399999) return false;
      }
      for (const [col, allowed] of Object.entries(filters)) {
        if (!allowed?.length) continue;
        if (!allowed.includes(row.cells[Number(col)] ?? "")) return false;
      }
      if (!needle) return true;
      return (searchBlobs?.[index] ?? "").includes(needle);
    });
    if (sort) {
      const { col, dir } = sort;
      const header = sheet.headers[col] ?? "";
      rows = [...rows].sort((a, b) => {
        const cmp = compareCells(a.cells[col] ?? "", b.cells[col] ?? "", header);
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [
    sheet,
    filters,
    deferredQuery,
    deferredPolicy,
    sort,
    quick,
    statusCol,
    processCol,
    agentCol,
    sourceCol,
    brand,
    policyCol,
    dateCol,
    dateFrom,
    dateTo,
    dateIndex,
    searchBlobs,
  ]);

  const PAGE_SIZE = 100;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageRows = useMemo(
    () => visible.slice(pageStart, pageStart + PAGE_SIZE),
    [visible, pageStart],
  );

  useEffect(() => {
    setPage(0);
  }, [deferredQuery, deferredPolicy, sort, filters, quick, brand, dateFrom, dateTo, dateCol]);

  const premiumSum = useMemo(() => {
    if (premiumCol < 0) return 0;
    return visible.reduce((sum, row) => sum + parsePremiumCell(row.cells[premiumCol] ?? ""), 0);
  }, [visible, premiumCol]);

  const selected = visible.find((row) => row.id === selectedId) ?? null;

  const toggleSort = useCallback((col: number) => {
    setSort((current) => {
      if (!current || current.col !== col) return { col, dir: "asc" };
      if (current.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }, []);

  const setColumnFilter = useCallback((col: number, values: string[]) => {
    setFilters((current) => {
      const next = { ...current };
      if (!values.length) delete next[col];
      else next[col] = values;
      return next;
    });
  }, []);

  const selectRow = useCallback((row: WorkbookRow) => {
    setSelectedId((current) => (current === row.id ? null : row.id));
  }, []);

  const moveRow = useCallback((row: WorkbookRow) => {
    setSelectedId(row.id);
  }, []);

  const dateActive = Boolean(dateFrom || dateTo);
  const activeFilterCount =
    Object.keys(filters).length +
    (quick.status ? 1 : 0) +
    (quick.process ? 1 : 0) +
    (quick.agent ? 1 : 0) +
    (brand !== "all" ? 1 : 0) +
    (policyQuery ? 1 : 0) +
    (dateActive ? 1 : 0);

  function applyPreset(preset: "all" | "month" | "prev" | "year") {
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const next = presetDates(preset);
    setDateFrom(next.from);
    setDateTo(next.to);
  }

  function clearControls() {
    setFilters({});
    setQuery("");
    setSort(null);
    setQuick({ status: "", process: "", agent: "" });
    setBrand("all");
    setPolicyQuery("");
    setDateFrom("");
    setDateTo("");
  }
  const syncedLabel = formatLastUpdatedAt(workbook.syncedAt);
  const selectClass =
    "h-8 max-w-[12rem] rounded-full border border-black/[0.08] bg-white px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring";
  const monthPreset = presetDates("month");
  const prevPreset = presetDates("prev");
  const yearPreset = presetDates("year");
  const activePreset =
    !dateFrom && !dateTo
      ? "all"
      : dateFrom === monthPreset.from && dateTo === monthPreset.to
        ? "month"
        : dateFrom === prevPreset.from && dateTo === prevPreset.to
          ? "prev"
          : dateFrom === yearPreset.from && dateTo === yearPreset.to
            ? "year"
            : "custom";
  const columnCount = sheet?.headers.filter(Boolean).length ?? 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-highlight/40">
          <Rows3 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">שורות מכירה</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {workbook.stored ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                <Database className="size-3" />
                נשמר במסד
              </span>
            ) : null}
            <span>{syncedLabel ? `עודכן · ${syncedLabel}` : "ממתינים לסנכרון"}</span>
            {sheet ? (
              <span>
                · {sheet.rows.length.toLocaleString("he-IL")} שורות · {columnCount.toLocaleString("he-IL")} עמודות
              </span>
            ) : null}
            {loadState === "error" && dashboard ? <span>· עותק מקומי, כדאי לסנכרן</span> : null}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בכל השדות…"
            className="h-9 rounded-full border-black/[0.08] bg-white pe-9"
          />
        </div>
      </header>

      <div className="mx-3 mb-3 space-y-2 sm:mx-5">
        {workbook.sheets.length ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">גיליונות</span>
            {workbook.sheets.map((item, index) => {
              const active = index === sheetIndex;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSheetIndex(index)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border py-1 pe-1.5 ps-3 text-sm transition-colors",
                    active
                      ? "border-transparent bg-highlight font-medium text-[#1a1a1a]"
                      : "border-black/[0.06] bg-white text-foreground hover:bg-[#fafaf8]",
                  )}
                >
                  <span className="whitespace-nowrap">{item.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      active ? "bg-black/10 text-[#1a1a1a]" : "bg-[#f3f2ee] text-[#5c5c56]",
                    )}
                  >
                    {item.rows.length.toLocaleString("he-IL")} שורות
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {sheet?.kind === "report" ? (
          <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-white px-3 py-2.5">
            {agentCol >= 0 || sourceCol >= 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">מותג</span>
                <div className="flex items-center gap-1 rounded-full bg-[#f6f5f1] p-1" role="tablist" aria-label="ליבה או שמש">
                  {(["all", "liba", "shemesh"] as const).map((id) => {
                    const selected = brand === id;
                    const count =
                      id === "all" ? sheet.rows.length : id === "liba" ? brandCounts.liba : brandCounts.shemesh;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setBrand(id)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors",
                          selected && id === "shemesh" && "bg-amber-700 font-medium text-white",
                          selected && id === "liba" && "bg-[#1a1a1a] font-medium text-white",
                          selected && id === "all" && "bg-highlight font-medium text-[#1a1a1a]",
                          !selected && "text-muted-foreground hover:bg-white",
                        )}
                      >
                        {OPERATING_BRAND_LABEL[id]}
                        <span className="tabular-nums opacity-80">{count.toLocaleString("he-IL")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {dateColumns.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">תאריך</span>
                <select
                  className={selectClass}
                  value={dateCol}
                  onChange={(event) => setDateCol(Number(event.target.value))}
                  aria-label="שדה תאריך"
                >
                  {dateColumns.map((item) => (
                    <option key={item.index} value={item.index}>
                      {item.header}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 rounded-full bg-[#f6f5f1] p-1">
                  {(
                    [
                      ["all", "הכל"],
                      ["month", "החודש"],
                      ["prev", "חודש קודם"],
                      ["year", "השנה"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyPreset(id)}
                      className={cn(
                        "h-7 rounded-full px-2.5 text-xs transition-colors",
                        activePreset === id
                          ? "bg-highlight font-medium text-[#1a1a1a]"
                          : "text-muted-foreground hover:bg-white",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  aria-label="מתאריך"
                  className={selectClass}
                />
                <span className="text-xs text-muted-foreground">עד</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  aria-label="עד תאריך"
                  className={selectClass}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">סינון</span>
              {policyCol >= 0 ? (
                <Input
                  value={policyQuery}
                  onChange={(event) => setPolicyQuery(event.target.value)}
                  placeholder="מספר פוליסה"
                  aria-label="מספר פוליסה"
                  className="h-8 w-40 rounded-full border-black/[0.08] bg-white"
                />
              ) : null}
              {statuses.length ? (
                <select
                  className={selectClass}
                  value={quick.status}
                  onChange={(event) => setQuick((current) => ({ ...current, status: event.target.value }))}
                  aria-label="סטטוס"
                >
                  <option value="">כל הסטטוסים</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : null}
              {processes.length ? (
                <select
                  className={selectClass}
                  value={quick.process}
                  onChange={(event) => setQuick((current) => ({ ...current, process: event.target.value }))}
                  aria-label="תהליך"
                >
                  <option value="">כל התהליכים</option>
                  {processes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : null}
              {agents.length ? (
                <select
                  className={cn(selectClass, "max-w-[14rem]")}
                  value={quick.agent}
                  onChange={(event) => setQuick((current) => ({ ...current, agent: event.target.value }))}
                  aria-label="משווק"
                >
                  <option value="">כל המשווקים</option>
                  {agents.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ) : null}
              {activeFilterCount || query ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearControls}>
                  <X className="size-4" />
                  נקה
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">100 שורות בעמוד. כל העמודות נשארות, בגלילה לצדדים.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {!sheet || (loadState === "loading" && !sheet.rows.length) ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loadState === "loading" ? "טוען את הדוח…" : "אין נתונים — סנכרנו את דוח המנהלים"}
        </div>
      ) : (
        <div className="mx-3 mb-2 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)] sm:mx-5">
          <SalesExcelGrid
            sheet={sheet}
            rows={pageRows}
            sort={sort}
            filters={filters}
            selectedId={selectedId}
            onSelect={selectRow}
            onMove={moveRow}
            onSort={toggleSort}
            onFilter={setColumnFilter}
          />
        </div>
      )}
      {sheet ? (
        <SalesExcelInspector sheet={sheet} row={selected} onClose={() => setSelectedId(null)} />
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
        <p className="text-[12px] text-muted-foreground">
          {visible.length
            ? `${(pageStart + 1).toLocaleString("he-IL")}–${Math.min(visible.length, pageStart + PAGE_SIZE).toLocaleString("he-IL")} מתוך ${visible.length.toLocaleString("he-IL")}`
            : "אין שורות"}
          {sheet && visible.length !== sheet.rows.length
            ? ` · אחרי סינון מתוך ${sheet.rows.length.toLocaleString("he-IL")}`
            : ""}
          {premiumCol >= 0 ? ` · פרמיה ${formatIls(Math.round(premiumSum))}` : ""}
        </p>
        <div className="flex items-center gap-2">
          <SalesEntryAudit sheets={workbook.sheets} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 0}
            onClick={() => setPage(currentPage - 1)}
          >
            הקודם
          </Button>
          <span className="min-w-24 text-center text-[12px] tabular-nums text-muted-foreground">
            עמוד {(currentPage + 1).toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            הבא
          </Button>
        </div>
      </footer>
    </section>
  );
}
