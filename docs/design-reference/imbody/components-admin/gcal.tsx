"use client";

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { layoutOverlaps } from "@/lib/admin/calendar-layout";
import { toneForKind } from "@/lib/admin/semantic-color";
import {
  atDubai,
  calendarRange,
  dubaiDay,
  shiftDubaiDay,
  startOfMonth,
  startOfWeek,
  type CalendarItem,
  type CalendarKind,
  type CalendarView,
} from "@/lib/admin/calendar-types";
import { createCalendarEvent, deleteCalendarEvent, placeCalendarEvent, saveCalendarEvent } from "@/lib/crm/calendar-actions";

const HOUR = 48;
const paint: Record<string, string> = {
  meeting: "#1a73e8",
  follow_up: "#e37400",
  visit: "#0b8043",
  install: "#8e24aa",
  service: "#0b8043",
  task: "#f9ab00",
  sla: "#d93025",
  deal: "#5f6368",
  block: "#5f6368",
};

const layers = [
  { id: "meeting", kinds: ["meeting"] },
  { id: "visit", kinds: ["visit", "service"] },
  { id: "install", kinds: ["install"] },
  { id: "task", kinds: ["task", "sla"] },
  { id: "follow_up", kinds: ["follow_up", "deal", "block"] },
] as const;

type Person = { id: string; name: string; department?: string };
type Guest = { id: string; name: string };

function minutesInDubai(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function nowMinutes() {
  return minutesInDubai(new Date().toISOString());
}

function slotIso(day: string, minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 15, minutes));
  return atDubai(day, Math.floor(clamped / 60), clamped % 60);
}

function spanMinutes(item: CalendarItem) {
  const start = minutesInDubai(item.start);
  let end = minutesInDubai(item.end);
  if (dubaiDay(item.end) && dubaiDay(item.end) !== dubaiDay(item.start)) end = 24 * 60;
  if (end <= start) end = start + 30;
  return { start, end };
}

function placeDay(items: CalendarItem[], maxCols: number) {
  const laid = layoutOverlaps(items.map((item) => ({ id: item.id, ...spanMinutes(item) })), maxCols);
  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    visible: laid.visible.flatMap((slot) => {
      const item = byId.get(slot.id);
      return item ? [{ item, col: slot.col, cols: slot.cols, start: slot.start, end: slot.end }] : [];
    }),
    overflow: laid.overflow.map((group) => ({
      start: group.start,
      items: group.ids.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      }),
    })),
  };
}

export function GCal({
  items,
  day,
  view,
  today,
  locale,
  members,
  people,
  canEdit,
  kinds,
}: {
  items: CalendarItem[];
  day: string;
  view: CalendarView;
  today: string;
  locale: string;
  members: Person[];
  people: Guest[];
  canEdit: boolean;
  kinds: readonly CalendarKind[];
}) {
  const t = useTranslations("crm.calendar");
  const nav = useTranslations("nav.items");
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [query, setQuery] = useState("");
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [hiddenPeople, setHiddenPeople] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string>(day);
  const [more, setMore] = useState<{ items: CalendarItem[]; x: number; y: number } | null>(null);
  const [pop, setPop] = useState<
    | { kind: "create" | "edit"; day: string; start: number; end: number; item?: CalendarItem; x: number; y: number }
    | { kind: "detail"; item: CalendarItem; x: number; y: number }
    | null
  >(null);
  const he = locale === "he";
  const monthCursor = view === "month" ? day : cursor.slice(0, 7) === day.slice(0, 7) ? day : day;

  useEffect(() => setRows(items), [items]);
  useEffect(() => {
    const scroller = document.getElementById("gcal-scroll");
    if (scroller) scroller.scrollTop = 7 * HOUR;
  }, [view, day]);

  const range = calendarRange(view === "agenda" ? "agenda" : view, day);
  const visibleDays = view === "day" ? [day] : view === "month" || view === "agenda" ? range.days : range.days;
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((item) => {
      const layer = layers.find((entry) => (entry.kinds as readonly string[]).includes(item.kind));
      if (layer && hiddenLayers.includes(layer.id)) return false;
      if (item.owner && hiddenPeople.includes(item.owner)) return false;
      if (!needle) return true;
      return `${item.title} ${item.name}`.toLowerCase().includes(needle);
    });
  }, [rows, query, hiddenLayers, hiddenPeople]);

  function go(nextView: CalendarView, nextDay: string) {
    const params = new URLSearchParams();
    if (nextView !== "week") params.set("view", nextView);
    if (nextDay !== today) params.set("on", nextDay);
    const queryString = params.toString();
    router.push(queryString ? `/admin/crm/calendar?${queryString}` : "/admin/crm/calendar");
  }

  function step(direction: number) {
    const amount = view === "month" ? 30 : view === "agenda" ? 14 : view === "day" ? 1 : 7;
    go(view, shiftDubaiDay(day, direction * amount));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === "t") go("week", today);
      if (key === "d") go("day", day);
      if (key === "w") go("week", day);
      if (key === "m") go("month", day);
      if (key === "a") go("agenda", day);
      if (key === "j") step(1);
      if (key === "k") step(-1);
      if (key === "c" && canEdit) {
        setPop({ kind: "create", day: today, start: 9 * 60, end: 10 * 60, x: 280, y: 120 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const titleFormat = new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", {
    month: "long",
    year: "numeric",
    day: view === "day" ? "numeric" : undefined,
    timeZone: "Asia/Dubai",
  });
  const titleDay = view === "month" ? startOfMonth(day) : view === "week" ? startOfWeek(day) : day;
  const weekday = new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { weekday: "short", timeZone: "Asia/Dubai" });
  const clock = new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
  const miniDays = Array.from({ length: 42 }, (_, index) => shiftDubaiDay(startOfWeek(startOfMonth(monthCursor)), index));
  const hours = Array.from({ length: 24 }, (_, index) => index);

  function openCreate(nextDay: string, start: number, clientX: number, clientY: number) {
    setPop({ kind: "create", day: nextDay, start, end: Math.min(24 * 60, start + 60), x: clientX, y: clientY });
  }

  function beginDrag(event: ReactMouseEvent, nextDay: string, item?: CalendarItem, edge?: "end") {
    if (!canEdit || (item && !item.editable)) return;
    event.preventDefault();
    event.stopPropagation();
    const originY = event.clientY;
    const originStart = item ? minutesInDubai(item.start) : Math.round(((event.clientY - (event.currentTarget as HTMLElement).getBoundingClientRect().top) / HOUR) * 60 / 15) * 15;
    const originEnd = item ? Math.max(originStart + 15, minutesInDubai(item.end)) : originStart + 60;
    let moved = false;
    let dropDay = nextDay;
    let nextStart = originStart;
    let nextEnd = originEnd;
    const move = (pointer: MouseEvent) => {
      const delta = Math.round(((pointer.clientY - originY) / HOUR) * 60 / 15) * 15;
      if (Math.abs(pointer.clientY - originY) > 4) moved = true;
      const column = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-day]");
      dropDay = column?.getAttribute("data-day") || nextDay;
      if (item && edge === "end") {
        nextEnd = Math.max(originStart + 15, originEnd + delta);
        nextStart = originStart;
        setRows((current) => current.map((row) => (row.id === item.id ? { ...row, end: slotIso(dubaiDay(item.start) || nextDay, nextEnd) } : row)));
        return;
      }
      if (item) {
        const length = originEnd - originStart;
        nextStart = Math.max(0, originStart + delta);
        nextEnd = nextStart + length;
        setRows((current) => current.map((row) => (row.id === item.id ? { ...row, start: slotIso(dropDay, nextStart), end: slotIso(dropDay, nextEnd) } : row)));
        return;
      }
      nextStart = Math.max(0, Math.min(originStart, originStart + delta));
      nextEnd = Math.max(nextStart + 15, Math.max(originStart, originStart + delta));
      setPop({ kind: "create", day: dropDay, start: nextStart, end: nextEnd, x: pointer.clientX, y: pointer.clientY });
    };
    const up = (pointer: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (item) {
        if (moved) {
          const form = new FormData();
          form.set("id", item.id);
          form.set("start", slotIso(dropDay, nextStart));
          form.set("end", slotIso(edge === "end" ? dubaiDay(item.start) || nextDay : dropDay, nextEnd));
          void placeCalendarEvent(form).then(() => router.refresh());
        } else {
          setPop({ kind: "detail", item, x: pointer.clientX, y: pointer.clientY });
        }
        return;
      }
      if (!moved) openCreate(nextDay, originStart, pointer.clientX, pointer.clientY);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function chip(item: CalendarItem, compact = false, minutes = 60) {
    const showTime = !compact && !item.allDay && minutes >= 36;
    return (
      <button
        type="button"
        data-event
        title={item.title}
        onMouseDown={(event) => beginDrag(event, dubaiDay(item.start), item)}
        className="gcal-chip flex h-full min-w-0 w-full flex-col overflow-hidden rounded px-1.5 py-0.5 text-start text-[11px] leading-4"
        style={{ "--event": toneForKind(item.kind) } as CSSProperties}
      >
        <span className="block min-w-0 truncate font-medium">{item.title}</span>
        {showTime ? <span className="block min-w-0 truncate text-[10px] opacity-80" dir="ltr">{clock.format(new Date(item.start))}</span> : null}
      </button>
    );
  }

  const counts = Object.fromEntries(layers.map((layer) => [layer.id, shown.filter((item) => (layer.kinds as readonly string[]).includes(item.kind)).length]));

  return (
    <div className="gcal flex h-[calc(100vh-6.5rem)] min-h-[640px] overflow-hidden rounded-2xl border border-[#dadce0] bg-white text-[#3c4043] shadow-sm">
      <aside className="flex w-64 shrink-0 flex-col gap-3 border-e border-[#dadce0] p-3">
        {canEdit ? (
          <button type="button" onClick={() => openCreate(today, 9 * 60, 240, 140)} className="flex h-12 w-fit items-center gap-3 rounded-2xl border border-[#dadce0] bg-white px-4 text-sm font-medium shadow-md">
            <Plus className="size-5 text-[#1a73e8]" />
            {t("create")}
          </button>
        ) : null}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-medium">
            <button type="button" aria-label={t("prev")} onClick={() => setCursor(shiftDubaiDay(startOfMonth(monthCursor), -1))}><ChevronRight className="size-4" /></button>
            <span>{titleFormat.format(new Date(`${startOfMonth(monthCursor)}T12:00:00+04:00`))}</span>
            <button type="button" aria-label={t("next")} onClick={() => setCursor(shiftDubaiDay(startOfMonth(monthCursor), 32))}><ChevronLeft className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-[#70757a]">
            {miniDays.slice(0, 7).map((mini) => <span key={mini}>{weekday.format(new Date(`${mini}T12:00:00+04:00`))}</span>)}
            {miniDays.map((mini) => {
              const on = mini === day;
              const isToday = mini === today;
              return (
                <button key={mini} type="button" onClick={() => go(view === "month" ? "month" : "day", mini)} className={`mx-auto grid size-7 place-items-center rounded-full ${on ? "bg-[#1a73e8] text-white" : isToday ? "text-[#1a73e8] font-semibold" : mini.slice(0, 7) === monthCursor.slice(0, 7) ? "" : "text-[#dadce0]"}`}>
                  {Number(mini.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-[#70757a]">{t("calendars")}</p>
          {layers.map((layer) => (
            <label key={layer.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={!hiddenLayers.includes(layer.id)} onChange={() => setHiddenLayers((current) => current.includes(layer.id) ? current.filter((id) => id !== layer.id) : [...current, layer.id])} style={{ accentColor: paint[layer.kinds[0]] }} />
              <span className="flex-1">{t(`kinds.${layer.id}`)}</span>
              <span className="text-[11px] text-[#70757a]">{counts[layer.id] ?? 0}</span>
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-[#70757a]">{t("people")}</p>
          {members.map((person) => (
            <label key={person.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={!hiddenPeople.includes(person.id)} onChange={() => setHiddenPeople((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} />
              <span className="grid size-6 place-items-center rounded-full bg-[#e8f0fe] text-[10px] font-semibold text-[#1a73e8]">{person.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1 truncate">{person.name}</span>
            </label>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#dadce0] px-3 py-2">
          <button type="button" onClick={() => go(view, today)} className="h-9 rounded-full border border-[#dadce0] px-4 text-sm">{t("today")}</button>
          <button type="button" aria-label={t("prev")} onClick={() => step(-1)} className="grid size-9 place-items-center rounded-full hover:bg-[#f1f3f4]"><ChevronRight className="size-5" /></button>
          <button type="button" aria-label={t("next")} onClick={() => step(1)} className="grid size-9 place-items-center rounded-full hover:bg-[#f1f3f4]"><ChevronLeft className="size-5" /></button>
          <h1 className="text-xl">{titleFormat.format(new Date(`${titleDay}T12:00:00+04:00`))}</h1>
          <label className="ms-auto flex h-9 items-center gap-2 rounded-full border border-[#dadce0] px-3 text-sm">
            <Search className="size-4 text-[#70757a]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} className="w-36 bg-transparent outline-none" />
          </label>
          <div className="flex rounded-full border border-[#dadce0] p-0.5 text-sm">
            {(["day", "week", "month", "agenda"] as const).map((key) => (
              <button key={key} type="button" onClick={() => go(key, day)} className={`h-8 rounded-full px-3 ${view === key ? "bg-[#e8f0fe] text-[#1a73e8]" : ""}`}>
                {key === "agenda" ? t("schedule") : t(`tabs.${key}`)}
              </button>
            ))}
          </div>
        </header>
        {view === "agenda" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleDays.map((date) => {
              const list = shown.filter((item) => dubaiDay(item.start) === date);
              return (
                <div key={date} className="grid grid-cols-[8rem_1fr] border-b border-[#dadce0]">
                  <p className={`px-3 py-3 text-sm ${date === today ? "text-[#1a73e8]" : ""}`}>{weekday.format(new Date(`${date}T12:00:00+04:00`))} {Number(date.slice(8))}</p>
                  <div className="grid gap-1 px-2 py-2">{list.length === 0 ? <p className="text-sm text-[#70757a]">{t("emptyDay")}</p> : list.map((item) => <div key={item.id}>{chip(item)}</div>)}</div>
                </div>
              );
            })}
          </div>
        ) : view === "month" ? (
          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,1fr)]">
            {visibleDays.slice(0, 7).map((date) => <p key={date} className="border-b border-[#dadce0] py-2 text-center text-xs text-[#70757a]">{weekday.format(new Date(`${date}T12:00:00+04:00`))}</p>)}
            {visibleDays.map((date) => {
              const list = shown.filter((item) => dubaiDay(item.start) === date);
              return (
                <div key={date} className={`min-h-0 border-b border-e border-[#dadce0] p-1 ${canEdit ? "cursor-pointer" : ""}`} onMouseDown={(event) => canEdit && openCreate(date, 9 * 60, event.clientX, event.clientY)}>
                  <span className={`mb-1 grid size-6 place-items-center rounded-full text-xs ${date === today ? "bg-[#1a73e8] text-white" : ""}`}>{Number(date.slice(8))}</span>
                  <div className="grid gap-0.5">{list.slice(0, 3).map((item) => <div key={item.id}>{chip(item, true)}</div>)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div id="gcal-scroll" className="min-h-0 flex-1 overflow-auto">
            <div className="sticky top-0 z-10 grid border-b border-[#dadce0] bg-white" style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0,1fr))` }}>
              <div />
              {visibleDays.map((date) => (
                <button key={date} type="button" onClick={() => go("day", date)} className="px-2 py-2 text-center text-xs text-[#70757a]">
                  <span className="block">{weekday.format(new Date(`${date}T12:00:00+04:00`))}</span>
                  <span className={`mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm ${date === today ? "bg-[#1a73e8] text-white" : "text-[#3c4043]"}`}>{Number(date.slice(8))}</span>
                </button>
              ))}
            </div>
            <div className="grid border-b border-[#dadce0]" style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0,1fr))` }}>
              <p className="px-2 py-1 text-[10px] text-[#70757a]">{t("allDay")}</p>
              {visibleDays.map((date) => (
                <div key={date} className="min-h-8 border-s border-[#dadce0] p-0.5">
                  {shown.filter((item) => item.allDay && dubaiDay(item.start) === date).map((item) => <div key={item.id}>{chip(item, true)}</div>)}
                </div>
              ))}
            </div>
            <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0,1fr))` }}>
              <div>
                {hours.map((hour) => <p key={hour} className="relative h-12 pe-2 text-end text-[10px] text-[#70757a]"><span className="absolute -top-1.5 end-2">{`${String(hour).padStart(2, "0")}:00`}</span></p>)}
              </div>
              {visibleDays.map((date) => {
                const dayItems = shown.filter((item) => !item.allDay && dubaiDay(item.start) === date);
                const placed = placeDay(dayItems, visibleDays.length > 1 ? 2 : 4);
                return (
                  <div key={date} data-day={date} className="relative cursor-pointer border-s border-[#dadce0]" style={{ height: 24 * HOUR }} onMouseDown={(event) => beginDrag(event, date)}>
                    {hours.map((hour) => <div key={hour} className="h-12 border-b border-[#e8eaed]" />)}
                    {date === today ? <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-[#ea4335]" style={{ top: (nowMinutes() / 60) * HOUR }}><span className="absolute -top-1.5 start-0 size-3 -translate-x-1/2 rounded-full bg-[#ea4335]" /></div> : null}
                    {placed.visible.map(({ item, col, cols, start, end }) => (
                      <div key={item.id} className="absolute z-20 min-w-0 px-0.5" style={{ top: (start / 60) * HOUR, height: Math.max(22, ((end - start) / 60) * HOUR), width: `${100 / cols}%`, insetInlineStart: `${(col / cols) * 100}%` }}>
                        {chip(item, false, end - start)}
                        {item.editable ? <span className="absolute inset-x-2 bottom-0 h-1.5 cursor-ns-resize" onMouseDown={(event) => beginDrag(event, date, item, "end")} /> : null}
                      </div>
                    ))}
                    {placed.overflow.map((group) => (
                      <button
                        key={group.items.map((item) => item.id).join("-")}
                        type="button"
                        className="absolute z-30 mx-0.5 truncate rounded bg-white/95 px-1 text-start text-[10px] font-semibold text-[#1a73e8] shadow-sm"
                        style={{ top: (group.start / 60) * HOUR + 22, height: 18, insetInlineStart: 2, insetInlineEnd: 2 }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMore({ items: group.items, x: event.clientX, y: event.clientY });
                        }}
                      >
                        {t("overflow", { count: group.items.length })}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {more ? (
        <div className="fixed z-50 w-64 rounded-xl border border-[#dadce0] bg-white p-2 text-sm shadow-2xl" style={{ top: Math.min(more.y, 560), left: Math.min(more.x, 1000) }} role="dialog">
          <div className="mb-1 flex justify-end">
            <button type="button" className="text-[#70757a]" onClick={() => setMore(null)}>×</button>
          </div>
          <ul className="grid gap-1">
            {more.items.map((item) => (
              <li key={item.id}>
                <button type="button" title={item.title} className="flex w-full min-w-0 flex-col rounded px-2 py-1 text-start hover:bg-[#f1f3f4]" onClick={(event) => { setMore(null); setPop({ kind: "detail", item, x: event.clientX, y: event.clientY }); }}>
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="text-[11px] text-[#70757a]" dir="ltr">{clock.format(new Date(item.start))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {pop ? (
        <div className="fixed z-50 w-80 rounded-xl border border-[#dadce0] bg-white p-3 text-sm shadow-2xl" style={{ top: Math.min(pop.y, 520), left: Math.min(pop.x, 900) }} role="dialog">
          {pop.kind === "detail" ? (
            <div className="grid gap-2">
              <p className="text-base font-medium">{pop.item.title}</p>
              <p className="text-[#70757a]">{t(`kinds.${pop.item.kind}`)} · {clock.format(new Date(pop.item.start))}</p>
              {pop.item.name ? <p>{pop.item.name}</p> : null}
              <div className="flex flex-wrap gap-2 text-[#1a73e8]">
                {pop.item.leadId ? <a href={`/admin/crm/leads/${pop.item.leadId}`}>{nav("leads")}</a> : null}
                {pop.item.dealId ? <a href={`/admin/crm/deals/${pop.item.dealId}`}>{nav("deals")}</a> : null}
                {pop.item.orderId ? <a href={`/admin/orders/${pop.item.orderId}`}>{nav("orders")}</a> : null}
                {pop.item.ticketId ? <a href={`/admin/crm/tickets/${pop.item.ticketId}`}>{nav("tickets")}</a> : null}
                {pop.item.href && pop.item.source !== "event" ? <a href={pop.item.href}>{t("more")}</a> : null}
              </div>
              <div className="flex gap-2">
                {pop.item.editable ? <button type="button" className="text-[#1a73e8]" onClick={() => setPop({ kind: "edit", day: dubaiDay(pop.item.start), start: minutesInDubai(pop.item.start), end: minutesInDubai(pop.item.end), item: pop.item, x: pop.x, y: pop.y })}>{t("edit")}</button> : null}
                {pop.item.editable ? (
                  <form action={deleteCalendarEvent}>
                    <input type="hidden" name="id" value={pop.item.id} />
                    <button type="submit" className="text-[#d93025]">{t("remove")}</button>
                  </form>
                ) : null}
                <button type="button" className="ms-auto text-[#70757a]" onClick={() => setPop(null)}>×</button>
              </div>
            </div>
          ) : (
            <form action={pop.kind === "edit" ? saveCalendarEvent : createCalendarEvent} className="grid gap-2">
              {pop.item ? <input type="hidden" name="id" value={pop.item.id} /> : null}
              <input name="title" required defaultValue={pop.item?.title ?? ""} placeholder={t("new")} className="h-10 border-b border-[#dadce0] bg-transparent text-base outline-none" />
              <select name="kind" defaultValue={pop.item?.kind ?? kinds[0]} className="h-9 rounded-lg border border-[#dadce0] px-2">
                {kinds.map((kind) => <option key={kind} value={kind}>{t(`kinds.${kind}`)}</option>)}
              </select>
              <input type="hidden" name="start" value={localStamp(pop.day, pop.start)} />
              <input type="hidden" name="end" value={localStamp(pop.day, pop.end)} />
              <p dir="ltr" className="text-[#70757a]">{localStamp(pop.day, pop.start).replace("T", " ")} – {localStamp(pop.day, pop.end).slice(11)}</p>
              {pop.kind === "create" ? (
                <select name="customer" className="h-9 rounded-lg border border-[#dadce0] px-2">
                  <option value="">{t("guest")}</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              ) : null}
              <details>
                <summary className="cursor-pointer text-[#1a73e8]">{t("more")}</summary>
                <textarea name="note" rows={2} defaultValue="" className="mt-2 w-full rounded-lg border border-[#dadce0] px-2 py-1" />
              </details>
              <button type="submit" className="h-9 rounded-full bg-[#1a73e8] px-4 text-white">{pop.kind === "edit" ? t("edit") : t("create")}</button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function localStamp(day: string, minutes: number) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${day}T${hour}:${minute}`;
}
