"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { calendarTone, dubaiDay, type CalendarItem, type CalendarView } from "@/lib/admin/calendar-types";
import { shiftCalendarEvent } from "@/lib/crm/calendar-actions";

const hours = Array.from({ length: 15 }, (_, index) => index + 7);

function top(start: string, day: string) {
  const at = new Date(start);
  if (Number.isNaN(at.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  if (dubaiDay(start) !== day) return 0;
  return Math.max(0, ((hour - 7) * 60 + minute) / 60) * 3.5;
}

function height(start: string, end: string) {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 3.5;
  return Math.max(1.75, Math.min(14, (to - from) / 3_600_000) * 3.5);
}

export function CalendarBoard({
  items,
  days,
  view,
  href,
  locale,
}: {
  items: CalendarItem[];
  days: string[];
  view: CalendarView;
  href: string;
  locale: string;
}) {
  const router = useRouter();
  const [, startMove] = useTransition();
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams(href.split("?")[1] ?? "");
    for (const [key, value] of Object.entries(change)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `/admin/crm/calendar?${query}` : "/admin/crm/calendar";
  };
  const t = useTranslations("crm.calendar");
  const dayName = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { weekday: "short", timeZone: "Asia/Dubai" });
  const dayFull = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Dubai" });
  const time = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  function chip(item: CalendarItem, compact = false) {
    const inner = (
      <span className={`cal-chip ${item.late ? "is-late" : ""}`} data-tone={calendarTone(item.kind)}>
        {!item.allDay && !compact ? <span className="cal-chip-time">{time.format(new Date(item.start))}</span> : null}
        <span className="min-w-0 truncate">{item.title}</span>
      </span>
    );
    return item.source === "event" ? (
      <Link
        key={item.id}
        href={link({ e: item.id })}
        className="block min-w-0"
        draggable={item.editable}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        {inner}
      </Link>
    ) : (
      <Link key={item.id} href={item.href} className="block min-w-0">
        {inner}
      </Link>
    );
  }

  if (view === "agenda") {
    return (
      <section className="work-sheet overflow-hidden">
        {days.map((day) => {
          const rows = items.filter((item) => dubaiDay(item.start) === day || (item.allDay && item.start.slice(0, 10) === day));
          return (
            <div key={day} className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0">
              <h3 className={`text-sm font-medium ${day === today ? "text-primary" : ""}`}>{dayFull.format(new Date(`${day}T12:00:00+04:00`))}</h3>
              {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("emptyDay")}</p> : <div className="grid gap-1">{rows.map((item) => chip(item))}</div>}
            </div>
          );
        })}
      </section>
    );
  }

  if (view === "month") {
    return (
      <section className="work-sheet overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border text-xs text-muted-foreground">
          {days.slice(0, 7).map((day) => (
            <p key={day} className="px-2 py-2 text-center">
              {dayName.format(new Date(`${day}T12:00:00+04:00`))}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const rows = items.filter((item) => dubaiDay(item.start) === day || (item.allDay && item.start.slice(0, 10) === day));
            return (
              <div
                key={day}
                className={`min-h-28 border-e border-b border-border p-1.5 last:border-e-0 ${day === today ? "bg-primary/5" : ""} ${day.slice(0, 7) !== days[15]?.slice(0, 7) ? "opacity-50" : ""}`}
              >
                <Link
                  href={link({ view: "day", on: day, e: "", start: `${day}T09:00`, end: `${day}T10:00` })}
                  className={`mb-1 block text-xs hover:underline ${day === today ? "font-semibold text-primary" : "text-muted-foreground"}`}
                >
                  {Number(day.slice(8))}
                </Link>
                <span className="grid gap-0.5">{rows.slice(0, 4).map((item) => chip(item, true))}</span>
                {rows.length > 4 ? <span className="mt-1 block text-[11px] text-muted-foreground">+{rows.length - 4}</span> : null}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="work-sheet overflow-hidden">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((day) => (
          <Link key={day} href={link({ view: "day", on: day })} className={`px-2 py-2 text-center text-sm ${day === today ? "font-semibold text-primary" : "text-muted-foreground"}`}>
            <span className="block text-xs">{dayName.format(new Date(`${day}T12:00:00+04:00`))}</span>
            <span>{Number(day.slice(8))}</span>
          </Link>
        ))}
      </div>
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
        <p className="px-2 py-2 text-[11px] text-muted-foreground">{t("allDay")}</p>
        {days.map((day) => (
          <div key={day} className="min-h-10 border-s border-border px-1 py-1">
            {items.filter((item) => item.allDay && (dubaiDay(item.start) === day || item.start.slice(0, 10) === day)).map((item) => chip(item, true))}
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
        <div>
          {hours.map((hour) => (
            <p key={hour} className="h-14 pe-2 text-end text-[11px] leading-none text-muted-foreground">
              {`${String(hour).padStart(2, "0")}:00`}
            </p>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="relative border-s border-border">
            {hours.map((hour) => (
              <Link
                key={`${day}-${hour}`}
                href={link({
                  e: "",
                  start: `${day}T${String(hour).padStart(2, "0")}:00`,
                  end: `${day}T${String(hour + 1).padStart(2, "0")}:00`,
                })}
                className="block h-14 border-b border-border/70 hover:bg-primary/5"
                aria-label={t("newAt", { time: `${hour}:00` })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain");
                  if (!id) return;
                  const form = new FormData();
                  form.set("id", id);
                  form.set("day", day);
                  form.set("hour", String(hour));
                  startMove(async () => {
                    await shiftCalendarEvent(form);
                    router.refresh();
                  });
                }}
              />
            ))}
            {items
              .filter((item) => !item.allDay && dubaiDay(item.start) === day)
              .map((item) => (
                <div key={item.id} className="pointer-events-none absolute inset-x-1" style={{ top: `${top(item.start, day)}rem` }}>
                  <div className="pointer-events-auto" style={{ minHeight: `${height(item.start, item.end)}rem` }}>
                    {chip(item)}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
