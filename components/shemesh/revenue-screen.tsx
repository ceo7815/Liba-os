"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import { HebrewDateRange } from "@/components/shemesh/hebrew-date";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatLastUpdatedAt } from "@/lib/sales-dashboard/marketing-copy";
import { shemeshWorkbookStaleWarning } from "@/lib/shemesh/sales-excel-source";
import {
  cellTone,
  formatWorkbookDateDisplay,
  type SalesWorkbookPayload,
} from "@/lib/sales-dashboard/workbook-grid";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import {
  buildRevenueBook,
  groupColumn,
  parseRecordedMoney,
  sumColumn,
  type RevenueLedger,
  type RevenueRow,
} from "@/lib/shemesh/revenue-book";

type TabId = "overview" | RevenueLedger["id"];

const PAGE_SIZE = 40;

const fieldClass =
  "h-8 w-full max-w-full min-w-0 rounded-full border border-border bg-card px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring sm:w-auto";

function jerusalemToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function dayStamp(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isMoneyHeader(header: string): boolean {
  return /סכום|יתרה|עמלה|נפרע|גמל|פנסיה|הפקדות|תגמול|פרמיה/.test(header);
}

function isDateHeader(header: string): boolean {
  return header.includes("תאריך");
}

function statusClass(value: string): string {
  const tone = cellTone("סטטוס", value);
  if (tone === "active") return "bg-highlight/15 text-foreground";
  if (tone === "cancelled") return "bg-rose-50 text-rose-800";
  if (tone === "pending") return "bg-muted text-foreground";
  return "bg-muted text-muted-foreground";
}

function uniqueValues(rows: RevenueRow[], index: number): string[] {
  if (index < 0) return [];
  const values = new Set<string>();
  for (const row of rows) {
    const value = row.cells[index]?.trim();
    if (value) values.add(value);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "he"));
}

function matchesQuery(row: RevenueRow, needle: string): boolean {
  if (!needle) return true;
  return row.cells.some((cell) => cell.toLowerCase().includes(needle));
}

function inRange(row: RevenueRow, from: number | null, to: number | null): boolean {
  if (from == null && to == null) return true;
  if (row.day == null) return false;
  if (from != null && row.day < from) return false;
  if (to != null && row.day > to + 86399999) return false;
  return true;
}

function filterRows(
  ledger: RevenueLedger,
  rows: RevenueRow[],
  options: {
    needle: string;
    from: number | null;
    to: number | null;
    agent: string;
    status: string;
    source: string;
    signed: string;
  },
): RevenueRow[] {
  return rows.filter((row) => {
    if (!inRange(row, options.from, options.to)) return false;
    if (options.agent && ledger.agent >= 0 && (row.cells[ledger.agent] ?? "") !== options.agent) return false;
    if (options.agent && ledger.agent < 0) return false;
    if (options.status && ledger.status >= 0 && (row.cells[ledger.status] ?? "") !== options.status) return false;
    if (options.source && ledger.source >= 0 && (row.cells[ledger.source] ?? "") !== options.source) return false;
    if (options.signed && ledger.signed >= 0 && (row.cells[ledger.signed] ?? "") !== options.signed) return false;
    return matchesQuery(row, options.needle);
  });
}

export function ShemeshRevenue({ workbook }: { workbook: SalesWorkbookPayload | null }) {
  const book = useMemo(() => buildRevenueBook(workbook), [workbook]);
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [preset, setPreset] = useState<"all" | "month" | "prev" | "year" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [signed, setSigned] = useState("");
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const fromStamp = dayStamp(from);
  const toStamp = dayStamp(to);
  const filterOptions = {
    needle: deferredQuery,
    from: fromStamp,
    to: toStamp,
    agent,
    status,
    source,
    signed,
  };

  const filtered = useMemo(() => {
    const map = new Map<RevenueLedger["id"], RevenueRow[]>();
    for (const ledger of book.ledgers) {
      map.set(ledger.id, filterRows(ledger, ledger.rows, filterOptions));
    }
    return map;
  }, [book.ledgers, filterOptions]);

  const collection = book.ledgers.find((ledger) => ledger.id === "collection") ?? null;
  const invoices = book.ledgers.find((ledger) => ledger.id === "invoices") ?? null;
  const finance = book.ledgers.find((ledger) => ledger.id === "finance") ?? null;
  const collectionRows = filtered.get("collection") ?? [];
  const invoiceRows = filtered.get("invoices") ?? [];
  const financeRows = filtered.get("finance") ?? [];

  const agents = useMemo(() => {
    const values = new Set<string>();
    for (const ledger of book.ledgers) {
      for (const value of uniqueValues(ledger.rows, ledger.agent)) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "he"));
  }, [book.ledgers]);
  const statuses = collection ? uniqueValues(collection.rows, collection.status) : [];
  const sources = collection ? uniqueValues(collection.rows, collection.source) : [];
  const signedValues = collection ? uniqueValues(collection.rows, collection.signed) : [];

  const activeLedger =
    tab === "collection" ? collection : tab === "invoices" ? invoices : tab === "finance" ? finance : null;
  const activeRows = activeLedger ? (filtered.get(activeLedger.id) ?? []) : [];

  const sortedRows = useMemo(() => {
    if (!activeLedger || !sort) return activeRows;
    const header = activeLedger.headers[sort.col] ?? "";
    const money = isMoneyHeader(header);
    const copy = [...activeRows];
    copy.sort((a, b) => {
      const left = a.cells[sort.col] ?? "";
      const right = b.cells[sort.col] ?? "";
      const cmp = money
        ? (parseRecordedMoney(left) ?? 0) - (parseRecordedMoney(right) ?? 0)
        : left.localeCompare(right, "he", { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [activeLedger, activeRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function applyPreset(next: "all" | "month" | "prev" | "year") {
    const today = jerusalemToday();
    setPreset(next);
    setPage(0);
    if (next === "all") {
      setFrom("");
      setTo("");
      return;
    }
    if (next === "month") {
      setFrom(monthStart(today));
      setTo(today);
      return;
    }
    if (next === "prev") {
      const start = shiftMonth(today, -1);
      const end = shiftMonth(today, 0);
      const last = new Date(dayStamp(end)! - 86400000);
      const endIso = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
      setFrom(start);
      setTo(endIso);
      return;
    }
    setFrom(yearStart(today));
    setTo(today);
  }

  function resetPageAnd<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  const collectionRowsForStatus = collection
    ? filterRows(collection, collection.rows, { ...filterOptions, status: "" })
    : [];
  const financeScopedOut = Boolean(agent) && finance != null && finance.agent < 0;
  const collected = collection ? sumColumn(collectionRows, collection.collected) : 0;
  const deals = collection
    ? sumColumn(
        collectionRows.filter((row) => (row.cells[collection.status] ?? "") !== "בוטל"),
        collection.deal,
      )
    : 0;
  const cancelled = collection
    ? sumColumn(
        collectionRows.filter((row) => (row.cells[collection.status] ?? "") === "בוטל"),
        collection.deal,
      )
    : 0;
  const invoiceTotal = invoices ? sumColumn(invoiceRows, invoices.invoiceAmount) : 0;
  const invoiceNet = invoices ? sumColumn(invoiceRows, invoices.invoiceNet) : 0;
  const commission = finance ? sumColumn(financeRows, finance.commission) : 0;
  const settled = finance ? sumColumn(financeRows, finance.settled) : 0;
  const syncedLabel = formatLastUpdatedAt(book.syncedAt);
  const staleWarning = shemeshWorkbookStaleWarning(book.syncedAt, Date.now());
  const statusGroups = collection ? groupColumn(collectionRows, collection.status, collection.collected) : [];
  const agentGroups = collection ? groupColumn(collectionRows, collection.agent, collection.collected).slice(0, 8) : [];
  const maxStatus = statusGroups[0]?.amount || 1;
  const maxAgent = agentGroups[0]?.amount || 1;

  if (!book.ledgers.length) {
    return (
      <section className="mx-auto flex min-h-[24rem] max-w-lg flex-col items-center justify-center text-center">
        <Wallet className="size-8 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold">הכנסות</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          דוח המכירות עדיין לא נטען. סנכרנו את המערכת, והסכומים מהקובץ יופיעו כאן.
        </p>
        <Link href="/shemesh/sales" className="mt-4 text-sm font-medium underline-offset-4 hover:underline">
          לשורות המכירה
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-[90rem] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">שמש · מקור האמת הוא קובץ המכירות</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">הכנסות</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            גבייה, חשבוניות ופיננסים כמו שנרשמו בקובץ. אין כאן נוסחת עמלה.
            {syncedLabel ? ` עודכן ${syncedLabel}.` : ""}
          </p>
          {staleWarning ? (
            <p role="status" className="mt-2 text-sm font-medium text-amber-800">
              {staleWarning}
            </p>
          ) : null}
        </div>
        <Link
          href="/shemesh/sales"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          כל שורות הקובץ
        </Link>
      </header>

      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["overview", "סקירה"],
            ["collection", `גבייה · ${collectionRows.length.toLocaleString("he-IL")}`],
            ["invoices", `חשבוניות · ${invoiceRows.length.toLocaleString("he-IL")}`],
            ["finance", `פיננסים · ${financeRows.length.toLocaleString("he-IL")}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setPage(0);
              setSort(null);
            }}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm transition-colors",
              tab === id
                ? "bg-highlight font-medium text-highlight-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="app-surface space-y-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 w-full flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => resetPageAnd(setQuery)(event.target.value)}
              placeholder="חיפוש לקוח, נציג, מקור או סטטוס"
              className="h-8 rounded-full border-border bg-card pe-9"
            />
          </div>
          <div className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  "h-8 shrink-0 rounded-full px-3 text-xs",
                  preset === id
                    ? "bg-highlight font-medium text-highlight-foreground"
                    : "bg-muted text-muted-foreground hover:bg-card",
                )}
              >
                {label}
              </button>
            ))}
            <div className="shrink-0">
              <HebrewDateRange
                from={from}
                to={to}
                onChange={(next) => {
                  setPreset("custom");
                  resetPageAnd(setFrom)(next.from);
                  resetPageAnd(setTo)(next.to);
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            aria-label="נציג"
            value={agent}
            onChange={(event) => resetPageAnd(setAgent)(event.target.value)}
            className={fieldClass}
          >
            <option value="">כל הנציגים</option>
            {agents.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {tab !== "invoices" && tab !== "finance" ? (
            <select
              aria-label="סטטוס גבייה"
              value={status}
              onChange={(event) => resetPageAnd(setStatus)(event.target.value)}
              className={fieldClass}
            >
              <option value="">כל הסטטוסים</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}
          {tab === "overview" || tab === "collection" ? (
            <>
              <select
                aria-label="מקור"
                value={source}
                onChange={(event) => resetPageAnd(setSource)(event.target.value)}
                className={fieldClass}
              >
                <option value="">כל המקורות</option>
                {sources.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                aria-label="חתימה"
                value={signed}
                onChange={(event) => resetPageAnd(setSigned)(event.target.value)}
                className={fieldClass}
              >
                <option value="">חתום ולא חתום</option>
                {signedValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
        {tab === "overview" || tab === "collection" ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <StatusChip
              label="הכל"
              count={collectionRowsForStatus.length}
              selected={!status}
              onClick={() => resetPageAnd(setStatus)("")}
            />
            {statuses.map((value) => (
              <StatusChip
                key={value}
                label={value}
                count={
                  collection && collection.status >= 0
                    ? collectionRowsForStatus.filter((row) => row.cells[collection.status] === value).length
                    : 0
                }
                selected={status === value}
                onClick={() => resetPageAnd(setStatus)(status === value ? "" : value)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard
              title="גבייה"
              hint="מה שנגבה בפועל, בלי עסקאות שבוטלו"
              value={formatShemeshMoney(collected)}
              lines={[
                `עסקאות פעילות ${formatShemeshMoney(deals)}`,
                cancelled ? `מבוטל ${formatShemeshMoney(cancelled)}` : `${collectionRows.length.toLocaleString("he-IL")} שורות`,
              ]}
              onOpen={() => setTab("collection")}
            />
            <SummaryCard
              title="חשבוניות"
              hint="סכום החשבונית כפי שנרשם"
              value={formatShemeshMoney(invoiceTotal)}
              lines={[`לפני מע״מ ${formatShemeshMoney(invoiceNet)}`, `${invoiceRows.length.toLocaleString("he-IL")} חשבוניות`]}
              onOpen={() => setTab("invoices")}
            />
            <SummaryCard
              title="פיננסים"
              hint="עמלות ונפרע מהגיליון, לא חישוב"
              value={financeScopedOut ? "—" : formatShemeshMoney(commission)}
              lines={
                financeScopedOut
                  ? ["הגיליון לא מחולק לפי נציג"]
                  : [`נפרע עד עכשיו ${formatShemeshMoney(settled)}`, `${financeRows.length.toLocaleString("he-IL")} רשומות`]
              }
              onOpen={() => setTab("finance")}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Breakdown title="נגבה לפי סטטוס" rows={statusGroups} max={maxStatus} />
            <Breakdown title="נגבה לפי נציג" rows={agentGroups} max={maxAgent} />
          </div>
          <p className="text-xs text-muted-foreground">
            שלושת הגיליונות לא מחוברים לסכום אחד. אותה עסקה יכולה להופיע גם בגבייה וגם בחשבונית.
          </p>
        </>
      ) : activeLedger ? (
        <LedgerTable
          ledger={activeLedger}
          rows={pageRows}
          total={sortedRows.length}
          page={safePage}
          pageCount={pageCount}
          sort={sort}
          onSort={(col) => {
            setSort((current) =>
              current?.col === col ? { col, dir: current.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" },
            );
          }}
          onPage={setPage}
        />
      ) : null}
    </section>
  );
}

function StatusChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs",
        selected ? "bg-highlight font-medium text-highlight-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
      )}
    >
      {label}
      <span className="tabular-nums opacity-80">{count.toLocaleString("he-IL")}</span>
    </button>
  );
}

function SummaryCard({
  title,
  hint,
  value,
  lines,
  onOpen,
}: {
  title: string;
  hint: string;
  value: string;
  lines: string[];
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="app-surface px-5 py-4 text-start transition-colors hover:bg-muted">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </button>
  );
}

function Breakdown({
  title,
  rows,
  max,
}: {
  title: string;
  rows: { key: string; count: number; amount: number }[];
  max: number;
}) {
  return (
    <section className="app-surface px-5 py-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {rows.length ? (
          rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{row.key}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{row.count.toLocaleString("he-IL")}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-highlight"
                    style={{ width: `${Math.max(4, Math.round((row.amount / max) * 100))}%` }}
                  />
                </div>
              </div>
              <span className="font-medium tabular-nums">{formatShemeshMoney(row.amount)}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">אין שורות בסינון הזה</li>
        )}
      </ul>
    </section>
  );
}

function LedgerTable({
  ledger,
  rows,
  total,
  page,
  pageCount,
  sort,
  onSort,
  onPage,
}: {
  ledger: RevenueLedger;
  rows: RevenueRow[];
  total: number;
  page: number;
  pageCount: number;
  sort: { col: number; dir: "asc" | "desc" } | null;
  onSort: (col: number) => void;
  onPage: (page: number) => void;
}) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{ledger.title}</h2>
          <p className="text-xs text-muted-foreground">{ledger.hint}</p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{total.toLocaleString("he-IL")} שורות</p>
      </div>
      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-xs text-muted-foreground">
              {ledger.show.map((index) => {
                const header = ledger.headers[index] ?? "";
                const active = sort?.col === index;
                return (
                  <th key={index} className="px-3 py-2 text-right font-medium">
                    <button type="button" onClick={() => onSort(index)} className="inline-flex items-center gap-1">
                      {header}
                      <span className="text-[10px]">{active ? (sort?.dir === "asc" ? "↑" : "↓") : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border odd:bg-muted">
                  {ledger.show.map((index) => {
                    const header = ledger.headers[index] ?? "";
                    const value = row.cells[index] ?? "";
                    const money = isMoneyHeader(header);
                    const shown = isDateHeader(header) ? formatWorkbookDateDisplay(value) : value;
                    return (
                      <td
                        key={`${row.id}-${index}`}
                        className={cn(
                          "max-w-[16rem] truncate px-3 py-2",
                          money && "tabular-nums",
                          index === ledger.status && value && "font-medium",
                        )}
                        title={shown}
                      >
                        {index === ledger.status && value ? (
                          <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium", statusClass(value))}>
                            {value}
                          </span>
                        ) : money ? (
                          shown ? formatShemeshMoney(parseRecordedMoney(shown)) : ""
                        ) : (
                          shown
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(1, ledger.show.length)} className="px-3 py-10 text-center text-muted-foreground">
                  אין שורות בסינון הזה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
        <span>
          עמוד {(page + 1).toLocaleString("he-IL")} מתוך {pageCount.toLocaleString("he-IL")}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} className="rounded-full bg-muted px-3 py-1 disabled:opacity-40">
            הקודם
          </button>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => onPage(page + 1)}
            className="rounded-full bg-muted px-3 py-1 disabled:opacity-40"
          >
            הבא
          </button>
        </div>
      </footer>
    </section>
  );
}
