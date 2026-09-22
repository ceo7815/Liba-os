"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  cellTone,
  excelColumnWidth,
  isNotesHeader,
  isPolicyHeader,
  type CellTone,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

export type SortState = { col: number; dir: "asc" | "desc" } | null;

const ROW_H = 34;
const HEADER_H = 38;
const GUTTER = 48;
const OVERSCAN = 14;

const TONE_CLASS: Record<CellTone, string> = {
  none: "",
  active: "bg-emerald-50 text-emerald-950",
  cancelled: "bg-rose-50 text-rose-950",
  pending: "bg-amber-50 text-amber-950",
  sale: "bg-sky-50 text-sky-950",
  settled: "bg-violet-50 text-violet-950",
};

function uniqueColumnValues(rows: WorkbookRow[], col: number): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row.cells[col] ?? "";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "he", { numeric: true, sensitivity: "base" }),
  );
}

export function SalesExcelGrid({
  sheet,
  rows,
  sort,
  filters,
  selectedId,
  onSelect,
  onMove,
  onSort,
  onFilter,
}: {
  sheet: WorkbookSheet;
  rows: WorkbookRow[];
  sort: SortState;
  filters: Record<number, string[]>;
  selectedId: string | null;
  onSelect: (row: WorkbookRow) => void;
  onMove: (row: WorkbookRow) => void;
  onSort: (col: number) => void;
  onFilter: (col: number, values: string[]) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(640);
  const [filterQuery, setFilterQuery] = useState<Record<number, string>>({});
  const [openCol, setOpenCol] = useState<number | null>(null);

  const widths = useMemo(
    () => sheet.headers.map((header) => excelColumnWidth(header)),
    [sheet.headers],
  );
  const totalWidth = GUTTER + widths.reduce((sum, w) => sum + w, 0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setViewH(el.clientHeight);
      setScrollTop(el.scrollTop);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [sheet.name, rows.length]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [sheet.name, filters]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const slice = rows.slice(start, end);

  const openOptions = useMemo(() => {
    if (openCol == null) return [];
    return uniqueColumnValues(sheet.rows, openCol);
  }, [openCol, sheet]);

  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1;

  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = scroller.current;
    if (!el) return;
    const top = selectedIndex * ROW_H;
    const bottom = top + ROW_H;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight - HEADER_H;
    if (top < viewTop) el.scrollTop = top;
    else if (bottom > viewBottom) el.scrollTop = bottom - (el.clientHeight - HEADER_H);
  }, [selectedIndex]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!rows.length) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter" && event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    if (event.key === "Escape") {
      if (selectedIndex >= 0) onSelect(rows[selectedIndex]);
      return;
    }
    if (selectedIndex < 0) {
      onMove(rows[0]);
      return;
    }
    if (event.key === "ArrowDown") onMove(rows[Math.min(rows.length - 1, selectedIndex + 1)]);
    if (event.key === "ArrowUp") onMove(rows[Math.max(0, selectedIndex - 1)]);
    if (event.key === "Enter" && rows[selectedIndex]) onSelect(rows[selectedIndex]);
  }

  return (
    <div
      ref={scroller}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="min-h-0 flex-1 overflow-auto bg-[#fbfbfa] outline-none"
    >
      <div style={{ width: totalWidth, height: HEADER_H + rows.length * ROW_H }} className="relative">
        <div
          className="sticky top-0 z-20 flex border-b border-black/10 bg-[#f4f4f1] text-[12px] font-semibold"
          style={{ height: HEADER_H, width: totalWidth }}
        >
          <div
            className="sticky right-0 z-30 flex items-center justify-center border-e border-black/10 bg-[#f4f4f1] text-[11px] text-muted-foreground"
            style={{ width: GUTTER, minWidth: GUTTER }}
          >
            #
          </div>
          {sheet.headers.map((header, col) => {
            const filtered = Boolean(filters[col]?.length);
            const q = (filterQuery[col] ?? "").trim().toLowerCase();
            const shown = q
              ? openOptions.filter(([value]) => value.toLowerCase().includes(q) || !value)
              : openOptions.slice(0, 120);
            return (
              <div
                key={`${header}-${col}`}
                className={cn(
                  "flex items-center gap-0.5 border-e border-black/10 px-1.5",
                  col === 0 && "sticky z-30 bg-[#f4f4f1]",
                )}
                style={{
                  width: widths[col],
                  minWidth: widths[col],
                  right: col === 0 ? GUTTER : undefined,
                }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-start"
                  onClick={() => onSort(col)}
                >
                  <span className="truncate">{header || `עמודה ${col + 1}`}</span>
                  {sort?.col === col ? (
                    sort.dir === "asc" ? (
                      <ArrowUp className="size-3 shrink-0" />
                    ) : (
                      <ArrowDown className="size-3 shrink-0" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3 shrink-0 opacity-25" />
                  )}
                </button>
                {sheet.kind === "report" ? (
                  <DropdownMenu
                    onOpenChange={(open) => {
                      setOpenCol(open ? col : null);
                      if (!open) {
                        setFilterQuery((current) => {
                          const next = { ...current };
                          delete next[col];
                          return next;
                        });
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "rounded p-0.5 hover:bg-black/5",
                          filtered && "bg-highlight text-black",
                        )}
                        aria-label={`סינון ${header}`}
                      >
                        <Filter className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56" dir="rtl">
                      <DropdownMenuLabel className="font-normal">{header}</DropdownMenuLabel>
                      <div className="px-2 pb-1">
                        <Input
                          value={filterQuery[col] ?? ""}
                          onChange={(event) =>
                            setFilterQuery((current) => ({ ...current, [col]: event.target.value }))
                          }
                          placeholder="סינון ערכים…"
                          className="h-8"
                        />
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={!filters[col]?.length}
                        onCheckedChange={() => onFilter(col, [])}
                      >
                        הכל ({openOptions.length})
                      </DropdownMenuCheckboxItem>
                      {shown.map(([value, count]) => {
                        const selected = filters[col] ?? [];
                        const on = !selected.length || selected.includes(value);
                        return (
                          <DropdownMenuCheckboxItem
                            key={value || "(empty)"}
                            checked={on && Boolean(selected.length)}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(checked) => {
                              const all = openOptions.map(([item]) => item);
                              const current = filters[col];
                              if (!current?.length) {
                                onFilter(col, checked ? [value] : all.filter((item) => item !== value));
                                return;
                              }
                              const next = checked
                                ? Array.from(new Set([...current, value]))
                                : current.filter((item) => item !== value);
                              onFilter(col, next.length === all.length ? [] : next);
                            }}
                          >
                            <span className="truncate">{value || "(ריק)"}</span>
                            <span className="ms-auto text-[10px] text-muted-foreground">{count}</span>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                      {openOptions.length > shown.length ? (
                        <p className="px-2 py-1 text-[11px] text-muted-foreground">
                          עוד {openOptions.length - shown.length} ערכים — חפשו למעלה
                        </p>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={{ height: start * ROW_H }} />

        {slice.map((row, offset) => {
          const selected = row.id === selectedId;
          const zebra = (start + offset) % 2 === 1;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className={cn(
                "flex w-full text-start text-[12.5px] leading-[34px]",
                selected ? "bg-[#fff4b0]" : zebra ? "bg-[#fafafa]" : "bg-white",
                !selected && "hover:bg-[#fffce8]",
              )}
              style={{ height: ROW_H, width: totalWidth }}
            >
              <div
                className={cn(
                  "sticky right-0 z-10 flex items-center justify-center border-b border-e border-black/[0.06] text-[11px] tabular-nums text-muted-foreground",
                  selected ? "bg-[#fff4b0]" : "bg-[#f7f7f4]",
                )}
                style={{ width: GUTTER, minWidth: GUTTER }}
              >
                {row.excelRow}
              </div>
              {row.cells.map((value, col) => {
                const header = sheet.headers[col] ?? "";
                const tone = selected ? "none" : cellTone(header, value);
                return (
                  <div
                    key={`${row.id}-${col}`}
                    title={value}
                    className={cn(
                      "truncate border-b border-e border-black/[0.06] px-2 whitespace-nowrap",
                      TONE_CLASS[tone],
                      isPolicyHeader(header) && value && "text-[#1a73e8]",
                      isNotesHeader(header) && "text-muted-foreground",
                      col === 0 && "sticky z-10 font-medium",
                      col === 0 && selected && "bg-[#fff4b0]",
                      col === 0 && !selected && !TONE_CLASS[tone] && (zebra ? "bg-[#fafafa]" : "bg-white"),
                    )}
                    style={{
                      width: widths[col],
                      minWidth: widths[col],
                      right: col === 0 ? GUTTER : undefined,
                    }}
                  >
                    {value}
                  </div>
                );
              })}
            </button>
          );
        })}

        <div style={{ height: Math.max(0, (rows.length - end) * ROW_H) }} />
      </div>
      {!rows.length ? (
        <p className="p-10 text-center text-sm text-muted-foreground">אין שורות לסינון הזה</p>
      ) : null}
    </div>
  );
}
