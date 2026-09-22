"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Database, FileSpreadsheet, Search, X } from "lucide-react";
import { GLOBAL_SYNC_EVENT } from "@/components/layout/global-sync-button";
import { useLiveDashboard } from "@/components/layout/live-dashboard-provider";
import { SalesExcelGrid, type SortState } from "@/components/sales-dashboard/sales-excel-grid";
import { SalesExcelInspector } from "@/components/sales-dashboard/sales-excel-inspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatIls } from "@/lib/sales-dashboard/campaign-math";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import {
  findHeaderIndex,
  parsePremiumCell,
  premiumColumnIndex,
  workbookFromDashboard,
  type SalesWorkbookPayload,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

function compareCells(a: string, b: string): number {
  const na = Number(String(a).replace(/,/g, ""));
  const nb = Number(String(b).replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && a.trim() !== "" && b.trim() !== "") {
    return na - nb;
  }
  return a.localeCompare(b, "he", { numeric: true, sensitivity: "base" });
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setSelectedId(null);
  }, [sheetIndex, sheet?.name]);

  const statusCol = sheet ? findHeaderIndex(sheet.headers, "סטאטוס", "סטטוס") : -1;
  const processCol = sheet ? findHeaderIndex(sheet.headers, "סוג תהליך", "תהליך") : -1;
  const agentCol = sheet ? findHeaderIndex(sheet.headers, "משווק") : -1;
  const premiumCol = sheet ? premiumColumnIndex(sheet.headers) : -1;

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

  const visible = useMemo(() => {
    if (!sheet) return [];
    const needle = deferredQuery.trim().toLowerCase();
    let rows = sheet.rows.filter((row) => {
      if (quick.status && statusCol >= 0 && (row.cells[statusCol] ?? "") !== quick.status) return false;
      if (quick.process && processCol >= 0 && (row.cells[processCol] ?? "") !== quick.process) return false;
      if (quick.agent && agentCol >= 0 && (row.cells[agentCol] ?? "") !== quick.agent) return false;
      for (const [col, allowed] of Object.entries(filters)) {
        if (!allowed?.length) continue;
        if (!allowed.includes(row.cells[Number(col)] ?? "")) return false;
      }
      if (!needle) return true;
      return row.cells.some((cell) => cell.toLowerCase().includes(needle));
    });
    if (sort) {
      const { col, dir } = sort;
      rows = [...rows].sort((a, b) => {
        const cmp = compareCells(a.cells[col] ?? "", b.cells[col] ?? "");
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [sheet, filters, deferredQuery, sort, quick, statusCol, processCol, agentCol]);

  const premiumSum = useMemo(() => {
    if (premiumCol < 0) return 0;
    return visible.reduce((sum, row) => sum + parsePremiumCell(row.cells[premiumCol] ?? ""), 0);
  }, [visible, premiumCol]);

  const selected = visible.find((row) => row.id === selectedId) ?? null;

  function toggleSort(col: number) {
    setSort((current) => {
      if (!current || current.col !== col) return { col, dir: "asc" };
      if (current.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }

  function setColumnFilter(col: number, values: string[]) {
    setFilters((current) => {
      const next = { ...current };
      if (!values.length) delete next[col];
      else next[col] = values;
      return next;
    });
  }

  const activeFilterCount =
    Object.keys(filters).length + (quick.status ? 1 : 0) + (quick.process ? 1 : 0) + (quick.agent ? 1 : 0);
  const syncedLabel = formatLastUpdatedAt(workbook.syncedAt);
  const selectClass =
    "h-9 max-w-[11rem] rounded-md border border-input bg-white px-2.5 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f3f0]">
      <header className="flex flex-wrap items-center gap-3 border-b border-black/[0.08] bg-white px-4 py-3 sm:px-5">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-highlight shadow-sm">
          <FileSpreadsheet className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">דוח אקסל מכירות</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {workbook.stored ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                <Database className="size-3" />
                נשמר במסד
              </span>
            ) : null}
            <span>{syncedLabel ? `סנכרון אחרון · ${syncedLabel}` : "ממתינים לסנכרון"}</span>
            {sheet ? <span>· {sheet.rows.length.toLocaleString("he-IL")} שורות</span> : null}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בכל העמודות…"
            className="h-9 rounded-full bg-[#f7f7f4] pe-9"
          />
        </div>
      </header>

      {sheet?.kind === "report" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] bg-white px-4 py-2 sm:px-5">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({});
                setQuery("");
                setSort(null);
                setQuick({ status: "", process: "", agent: "" });
              }}
            >
              <X className="size-4" />
              נקה
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">לחצו על שורה לפתיחת כרטיס מלא</p>
          )}
        </div>
      ) : null}

      {workbook.sheets.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-black/[0.08] bg-[#ecece8] px-2 pt-1.5">
          {workbook.sheets.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSheetIndex(index)}
              className={cn(
                "shrink-0 rounded-t-lg px-3.5 py-1.5 text-sm transition-colors",
                index === sheetIndex
                  ? "bg-white font-medium shadow-[0_-1px_0_#fff]"
                  : "text-muted-foreground hover:bg-white/70",
              )}
            >
              {item.name}
              <span className="ms-1.5 text-[11px] text-muted-foreground">
                {item.rows.length.toLocaleString("he-IL")}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!sheet || (loadState === "loading" && !sheet.rows.length) ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loadState === "loading" ? "טוען את הדוח השמור…" : "אין נתונים — סנכרנו את דוח המנהלים"}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <SalesExcelGrid
            sheet={sheet}
            rows={visible}
            sort={sort}
            filters={filters}
            selectedId={selectedId}
            onSelect={(row) => setSelectedId((current) => (current === row.id ? null : row.id))}
            onMove={(row) => setSelectedId(row.id)}
            onSort={toggleSort}
            onFilter={setColumnFilter}
          />
          {selected ? (
            <SalesExcelInspector sheet={sheet} row={selected} onClose={() => setSelectedId(null)} />
          ) : null}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.08] bg-white px-4 py-1.5 text-[11px] text-muted-foreground">
        <span>
          ספירה {visible.length.toLocaleString("he-IL")}
          {sheet && visible.length !== sheet.rows.length
            ? ` מתוך ${sheet.rows.length.toLocaleString("he-IL")}`
            : ""}
        </span>
        {premiumCol >= 0 ? <span>סכום פרמיה {formatIls(Math.round(premiumSum))}</span> : null}
        {workbook.sheets.length ? (
          <span>
            {workbook.sheets.length} גיליונות
            {sheet ? ` · ${sheet.headers.filter(Boolean).length} עמודות` : ""}
          </span>
        ) : null}
        {loadState === "error" && dashboard ? <span>מוצג עותק מקומי — סנכרנו לקובץ החי</span> : null}
      </footer>
    </section>
  );
}
