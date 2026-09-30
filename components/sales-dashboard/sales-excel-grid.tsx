"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  cellTone,
  excelColumnWidth,
  formatWorkbookDateDisplay,
  isDateHeader,
  isNotesHeader,
  isPolicyHeader,
  type CellTone,
  type WorkbookRow,
  type WorkbookSheet,
} from "@/lib/sales-dashboard/workbook-grid";

export type SortState = { col: number; dir: "asc" | "desc" } | null;

const ROW_H = 42;
const HEADER_H = 44;
const GUTTER = 46;
const MIN_COL = 76;
const MAX_COL = 560;

const PILL_CLASS: Record<CellTone, string> = {
  none: "",
  active: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-rose-50 text-rose-800",
  pending: "bg-amber-50 text-amber-900",
  sale: "bg-sky-50 text-sky-900",
  settled: "bg-violet-50 text-violet-800",
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

function isNumericHeader(header: string): boolean {
  return /תאריך|פרמיה|פוליסה|ת\.ז|נייד|טלפון/.test(header);
}

const ExcelRow = memo(function ExcelRow({
  row,
  index,
  selected,
  widths,
  headers,
  totalWidth,
  onSelect,
}: {
  row: WorkbookRow;
  index: number;
  selected: boolean;
  widths: number[];
  headers: string[];
  totalWidth: number;
  onSelect: (row: WorkbookRow) => void;
}) {
  const zebra = index % 2 === 1;
  const surface = selected ? "bg-[#fff6cc]" : zebra ? "bg-[#fafaf8]" : "bg-white";

  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={() => onSelect(row)}
      data-row={index}
      className="group flex cursor-pointer text-[13px] text-[#1c1c1a]"
      style={{ height: ROW_H, width: totalWidth }}
    >
      <div
        className={cn(
          "pin sticky right-0 z-10 flex shrink-0 items-center justify-center border-b border-black/[0.04] text-[11px] tabular-nums text-[#9a9a94]",
          surface,
          !selected && "group-hover:bg-[#fffbea]",
        )}
        style={{ width: GUTTER, minWidth: GUTTER }}
      >
        {row.excelRow}
      </div>
      {row.cells.map((value, col) => {
        const header = headers[col] ?? "";
        const shown = isDateHeader(header) ? formatWorkbookDateDisplay(value) : value;
        const tone = cellTone(header, shown);
        const pinned = col === 0;
        return (
          <div
            key={col}
            role="gridcell"
            title={shown || undefined}
            className={cn(
              "flex shrink-0 items-center overflow-hidden border-b border-black/[0.04] px-3 whitespace-nowrap",
              surface,
              !selected && "group-hover:bg-[#fffbea]",
              isPolicyHeader(header) && value && "font-medium tabular-nums",
              isNotesHeader(header) && "text-[#6f6f68]",
              isNumericHeader(header) && "tabular-nums",
              pinned && "pin-edge sticky z-10 font-medium",
            )}
            style={{
              width: widths[col],
              minWidth: widths[col],
              right: pinned ? GUTTER : undefined,
            }}
          >
            {tone !== "none" && value ? (
              <span
                className={cn(
                  "max-w-full truncate rounded-full px-2 py-0.5 text-[12px] font-medium leading-5",
                  PILL_CLASS[tone],
                )}
              >
                {shown}
              </span>
            ) : (
              <span className="truncate">{shown}</span>
            )}
          </div>
        );
      })}
    </div>
  );
});

const GridHeader = memo(function GridHeader({
  sheet,
  widths,
  totalWidth,
  sort,
  filters,
  scrollerRef,
  onSort,
  onFilter,
  onResize,
}: {
  sheet: WorkbookSheet;
  widths: number[];
  totalWidth: number;
  sort: SortState;
  filters: Record<number, string[]>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  onSort: (col: number) => void;
  onFilter: (col: number, values: string[]) => void;
  onResize: (col: number, width: number) => void;
}) {
  const [menu, setMenu] = useState<{ col: number; top: number; left: number } | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const options = useMemo(() => {
    if (menu == null) return [];
    return uniqueColumnValues(sheet.rows, menu.col);
  }, [menu, sheet.rows]);

  useEffect(() => {
    if (menu == null) return;
    const el = scrollerRef.current;
    const close = () => setMenu(null);
    el?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      el?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, scrollerRef]);

  function openMenu(col: number, anchor: HTMLButtonElement) {
    const rect = anchor.getBoundingClientRect();
    const width = 248;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setFilterQuery("");
    setMenu({ col, top: rect.bottom + 6, left });
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>, col: number) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startW = widths[col] ?? MIN_COL;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    let frame = 0;
    let latest = startW;
    const move = (ev: PointerEvent) => {
      latest = Math.max(MIN_COL, Math.min(MAX_COL, Math.round(startW + (startX - ev.clientX))));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onResize(col, latest);
      });
    };
    const up = () => {
      if (frame) cancelAnimationFrame(frame);
      onResize(col, latest);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  const q = filterQuery.trim().toLowerCase();
  const shown = q
    ? options.filter(([value]) => value.toLowerCase().includes(q) || !value)
    : options.slice(0, 120);
  const activeCol = menu?.col ?? -1;
  const selectedValues = filters[activeCol] ?? [];

  return (
    <>
      <div
        role="row"
        className="sticky top-0 z-20 flex border-b border-black/[0.06] bg-white text-[12px] font-medium text-[#6d6d66]"
        style={{ height: HEADER_H, width: totalWidth }}
      >
        <div
          className="pin sticky right-0 z-30 flex items-center justify-center border-b border-black/[0.06] bg-white text-[11px] font-medium text-[#9a9a94]"
          style={{ width: GUTTER, minWidth: GUTTER }}
        >
          #
        </div>
        {sheet.headers.map((header, col) => {
          const filtered = Boolean(filters[col]?.length);
          return (
            <div
              key={`${header}-${col}`}
              role="columnheader"
              className={cn(
                "relative flex items-center gap-0.5 border-b border-black/[0.06] bg-white px-2",
                col === 0 && "pin-edge sticky z-30",
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
                    <ArrowUp className="size-3 shrink-0 text-[#1a1a1a]" />
                  ) : (
                    <ArrowDown className="size-3 shrink-0 text-[#1a1a1a]" />
                  )
                ) : (
                  <ArrowUpDown className="size-3 shrink-0 opacity-30" />
                )}
              </button>
              {sheet.kind === "report" ? (
                <button
                  type="button"
                  className={cn(
                    "rounded-full p-1 text-[#8a8a84] hover:bg-black/[0.04]",
                    filtered && "bg-highlight text-[#1a1a1a] hover:bg-highlight",
                  )}
                  aria-label={`סינון ${header}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    if (menu?.col === col) {
                      setMenu(null);
                      return;
                    }
                    openMenu(col, event.currentTarget);
                  }}
                >
                  <Filter className="size-3" />
                </button>
              ) : null}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={`רוחב ${header || col + 1}`}
                className="absolute inset-y-1 left-0 z-10 w-1.5 cursor-col-resize rounded-full hover:bg-highlight"
                onPointerDown={(event) => beginResize(event, col)}
              />
            </div>
          );
        })}
      </div>
      {menu != null && typeof document !== "undefined"
        ? createPortal(
            <FilterPanel
              header={sheet.headers[menu.col] || `עמודה ${menu.col + 1}`}
              top={menu.top}
              left={menu.left}
              query={filterQuery}
              onQuery={setFilterQuery}
              options={options}
              shown={shown}
              selected={selectedValues}
              onClose={() => setMenu(null)}
              onFilter={(values) => onFilter(menu.col, values)}
            />,
            document.body,
          )
        : null}
    </>
  );
});

function FilterPanel({
  header,
  top,
  left,
  query,
  onQuery,
  options,
  shown,
  selected,
  onClose,
  onFilter,
}: {
  header: string;
  top: number;
  left: number;
  query: string;
  onQuery: (value: string) => void;
  options: [string, number][];
  shown: [string, number][];
  selected: string[];
  onClose: () => void;
  onFilter: (values: string[]) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed z-[80] flex max-h-[min(24rem,70vh)] w-[248px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_16px_40px_-24px_rgba(0,0,0,0.45)]"
      style={{ top, left }}
    >
      <div className="border-b border-black/[0.06] px-3 py-2">
        <p className="mb-1.5 truncate text-[12px] font-medium">{header}</p>
        <Input
          autoFocus
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="חיפוש ערך…"
          className="h-8"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <FilterOption
          checked={!selected.length}
          label="הכל"
          count={options.length}
          onChange={() => onFilter([])}
        />
        {shown.map(([value, count]) => {
          const on = !selected.length || selected.includes(value);
          return (
            <FilterOption
              key={value || "(empty)"}
              checked={on}
              label={value || "(ריק)"}
              count={count}
              onChange={(checked) => {
                const all = options.map(([item]) => item);
                if (!selected.length) {
                  onFilter(checked ? [value] : all.filter((item) => item !== value));
                  return;
                }
                const next = checked
                  ? Array.from(new Set([...selected, value]))
                  : selected.filter((item) => item !== value);
                onFilter(next.length === all.length ? [] : next);
              }}
            />
          );
        })}
        {options.length > shown.length ? (
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
            עוד {options.length - shown.length} ערכים — חפשו למעלה
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FilterOption({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count: number;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[#f6f5f1]">
      <input
        type="checkbox"
        className="size-3.5 accent-[#1a1a1a]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
    </label>
  );
}

export const SalesExcelGrid = memo(function SalesExcelGrid({
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
  const [widths, setWidths] = useState<number[]>(() => sheet.headers.map((header) => excelColumnWidth(header)));

  useEffect(() => {
    setWidths(sheet.headers.map((header) => excelColumnWidth(header)));
  }, [sheet.name, sheet.headers]);

  const totalWidth = GUTTER + widths.reduce((sum, width) => sum + width, 0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const next = Math.abs(el.scrollLeft) > 2 ? "1" : "0";
      if (el.dataset.x !== next) el.dataset.x = next;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
      event.preventDefault();
      el.scrollLeft += event.shiftKey ? event.deltaY : event.deltaX;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, [sheet.name]);

  const pageMark = `${rows.length}:${rows[0]?.id ?? ""}`;

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0, left: 0 });
  }, [sheet.name, filters, pageMark]);

  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1;

  useEffect(() => {
    if (selectedIndex < 0) return;
    scroller.current?.querySelector(`[data-row="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
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

  const onResize = useCallback((col: number, width: number) => {
    setWidths((current) => {
      if (current[col] === width) return current;
      const next = current.slice();
      next[col] = width;
      return next;
    });
  }, []);

  return (
    <div
      ref={scroller}
      role="grid"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="excel-scroller min-h-0 min-w-0 flex-1 overflow-auto bg-white outline-none [overflow-anchor:none] [scrollbar-color:rgba(23,23,23,0.35)_transparent] [scrollbar-width:thin] [&[data-x=1]_.pin-edge]:shadow-[-12px_0_16px_-14px_rgba(17,17,17,0.35)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/30 [&::-webkit-scrollbar-track]:bg-transparent"
    >
      <div style={{ width: totalWidth }}>
        <GridHeader
          sheet={sheet}
          widths={widths}
          totalWidth={totalWidth}
          sort={sort}
          filters={filters}
          scrollerRef={scroller}
          onSort={onSort}
          onFilter={onFilter}
          onResize={onResize}
        />
        {rows.map((row, index) => (
          <ExcelRow
            key={row.id}
            row={row}
            index={index}
            selected={row.id === selectedId}
            widths={widths}
            headers={sheet.headers}
            totalWidth={totalWidth}
            onSelect={onSelect}
          />
        ))}
      </div>
      {!rows.length ? (
        <p className="p-10 text-center text-sm text-muted-foreground">אין שורות לסינון הזה</p>
      ) : null}
    </div>
  );
});
