"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEK = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function jerusalemToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function monthEnd(monthKey: string): string {
  const next = shiftMonth(monthKey, 1);
  const [year, month] = next.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 0));
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function formatHebrewDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function presets(today: string) {
  const month = today.slice(0, 7);
  const prev = shiftMonth(month, -1);
  return [
    { id: "month", label: "החודש", from: `${month}-01`, to: today },
    { id: "prev", label: "חודש קודם", from: `${prev}-01`, to: monthEnd(prev) },
    { id: "d30", label: "30 יום", from: addDays(today, -29), to: today },
  ];
}

function monthCells(monthKey: string): { iso: string; day: number; outside: boolean }[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = first.getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: { iso: string; day: number; outside: boolean }[] = [];
  for (let index = 0; index < startOffset; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (startOffset - index)));
    cells.push({ iso: date.toISOString().slice(0, 10), day: date.getUTCDate(), outside: true });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({
      iso: `${monthKey}-${String(day).padStart(2, "0")}`,
      day,
      outside: false,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].iso;
    const next = addDays(last, 1);
    cells.push({ iso: next, day: Number(next.slice(8)), outside: true });
  }
  return cells;
}

export function DateRangeField({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}) {
  const today = jerusalemToday();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(from.slice(0, 7) || today.slice(0, 7));
  const [anchor, setAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(iso: string) {
    if (!anchor) {
      setAnchor(iso);
      onChange({ from: iso, to: iso });
      return;
    }
    const nextFrom = iso < anchor ? iso : anchor;
    const nextTo = iso < anchor ? anchor : iso;
    onChange({ from: nextFrom, to: nextTo });
    setAnchor(null);
    setOpen(false);
  }

  const cells = monthCells(cursor);
  const monthLabel = `${MONTHS[Number(cursor.slice(5, 7)) - 1]} ${cursor.slice(0, 4)}`;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 text-xs font-semibold text-foreground shadow-card backdrop-blur-xl"
      >
        <Calendar className="size-3.5 text-[#c2410c]" />
        <span dir="ltr" className="tabular-nums">
          {formatHebrewDay(from)} – {formatHebrewDay(to)}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute end-0 z-50 mt-2 w-[18.5rem] rounded-[20px] border border-white/80 bg-white/80 p-3 text-foreground shadow-pop backdrop-blur-2xl"
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {presets(today).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-full bg-[#fff4cc] px-2.5 py-1 text-[11px] font-semibold text-[#6a4b00]"
                onClick={() => {
                  onChange({ from: preset.from, to: preset.to });
                  setCursor(preset.from.slice(0, 7));
                  setAnchor(null);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="size-7 rounded-full hover:bg-black/5" onClick={() => setCursor(shiftMonth(cursor, 1))} aria-label="חודש הבא">‹</button>
            <p className="text-sm font-semibold">{monthLabel}</p>
            <button type="button" className="size-7 rounded-full hover:bg-black/5" onClick={() => setCursor(shiftMonth(cursor, -1))} aria-label="חודש קודם">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {WEEK.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const selected = cell.iso >= from && cell.iso <= to;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pick(cell.iso)}
                  className={cn(
                    "h-8 rounded-full text-xs tabular-nums",
                    cell.outside && "text-muted-foreground/50",
                    selected ? "bg-[#ffd60a] font-semibold text-[#1a1204]" : "hover:bg-black/5",
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
