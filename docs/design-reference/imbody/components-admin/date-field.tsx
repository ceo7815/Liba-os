"use client";

import { useState, type ReactNode } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";

export function DateField({
  label,
  ariaLabel,
  value,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ordersDesk");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => cursorOf(value));
  const tag = locale === "he" ? "he-IL" : "en-GB";

  return (
    <Picker
      label={label}
      ariaLabel={ariaLabel ?? label}
      text={value ? formatDay(value, tag) : "—"}
      filled={Boolean(value)}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCursor(cursorOf(value));
      }}
    >
      <DayGrid
        cursor={cursor}
        value={value}
        localeTag={tag}
        weekStart={locale === "he" ? 0 : 1}
        todayLabel={t("today")}
        clearLabel={t("clear")}
        onCursor={setCursor}
        onPick={(day) => {
          onChange(day);
          setOpen(false);
        }}
        onClear={() => {
          onChange("");
          setOpen(false);
        }}
      />
    </Picker>
  );
}

export function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ordersDesk");
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => yearOf(value));
  const tag = locale === "he" ? "he-IL" : "en-GB";

  return (
    <Picker
      label={label}
      ariaLabel={label}
      text={value ? formatMonth(value, tag) : "—"}
      filled={Boolean(value)}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setYear(yearOf(value));
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <StepButton label="-1" onClick={() => setYear((current) => current - 1)} />
        <span className="text-sm font-medium tabular-nums">{year}</span>
        <StepButton label="+1" forward onClick={() => setYear((current) => current + 1)} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, month) => {
          const key = `${year}-${String(month + 1).padStart(2, "0")}`;
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={
                selected
                  ? "rounded-xl bg-foreground px-2 py-2 text-sm text-background"
                  : "rounded-xl px-2 py-2 text-sm hover:bg-muted"
              }
            >
              {monthName(year, month, tag)}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            const { year, month } = dubaiParts();
            onChange(`${year}-${String(month).padStart(2, "0")}`);
            setOpen(false);
          }}
        >
          {t("thisMonth")}
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          {t("clear")}
        </button>
      </div>
    </Picker>
  );
}

function Picker({
  label,
  ariaLabel,
  text,
  filled,
  open,
  onOpenChange,
  children,
}: {
  label?: string;
  ariaLabel?: string;
  text: string;
  filled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className={label ? "grid gap-1 text-sm" : "text-sm"}>
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger
          aria-label={ariaLabel}
          className="flex h-10 w-full min-w-36 items-center justify-between gap-3 rounded-full border border-border bg-background px-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={filled ? "truncate tabular-nums" : "text-muted-foreground"}>{text}</span>
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="menu-panel z-50 w-72 p-3 outline-none">
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function DayGrid({
  cursor,
  value,
  localeTag,
  weekStart,
  todayLabel,
  clearLabel,
  onCursor,
  onPick,
  onClear,
}: {
  cursor: string;
  value: string;
  localeTag: string;
  weekStart: number;
  todayLabel: string;
  clearLabel: string;
  onCursor: (cursor: string) => void;
  onPick: (day: string) => void;
  onClear: () => void;
}) {
  const [year, month] = cursor.split("-").map(Number);
  const first = new Date(year, month - 1, 1).getDay();
  const lead = (first - weekStart + 7) % 7;
  const count = new Date(year, month, 0).getDate();
  const days = Array.from({ length: lead + count }, (_, index) => (index < lead ? 0 : index - lead + 1));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "narrow" }).format(new Date(2026, 0, 4 + ((weekStart + index) % 7))),
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <StepButton label="-1" onClick={() => onCursor(shiftMonth(cursor, -1))} />
        <span className="text-sm font-medium">{monthName(year, month - 1, localeTag)} {year}</span>
        <StepButton label="+1" forward onClick={() => onCursor(shiftMonth(cursor, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdays.map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = `${cursor}-${String(day).padStart(2, "0")}`;
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className={
                selected
                  ? "mx-auto flex size-8 items-center justify-center rounded-full bg-foreground text-sm text-background tabular-nums"
                  : "mx-auto flex size-8 items-center justify-center rounded-full text-sm tabular-nums hover:bg-muted"
              }
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onPick(todayKey())}
        >
          {todayLabel}
        </button>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClear}>
          {clearLabel}
        </button>
      </div>
    </>
  );
}

function StepButton({ forward = false, label, onClick }: { forward?: boolean; label: string; onClick: () => void }) {
  const Icon = forward ? ChevronRight : ChevronLeft;
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex size-8 items-center justify-center rounded-full hover:bg-muted">
      <Icon className="size-4 rtl:rotate-180" />
    </button>
  );
}

function cursorOf(value: string) {
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : todayKey().slice(0, 7);
}

function yearOf(value: string) {
  return /^\d{4}/.test(value) ? Number(value.slice(0, 4)) : dubaiParts().year;
}

function dubaiParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

function todayKey() {
  const { year, month, day } = dubaiParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(cursor: string, delta: number) {
  const [year, month] = cursor.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(year: number, monthIndex: number, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, { month: "short" }).format(new Date(year, monthIndex, 1));
}

function formatDay(value: string, localeTag: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatMonth(value: string, localeTag: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}
