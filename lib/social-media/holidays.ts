import { HebrewCalendar, flags, Location, Event } from "@hebcal/core";
import type { HolidayDay } from "@/lib/social-media/types";

const TOPIC_HINTS: Record<string, string> = {
  roshHashana: "תחילת שנה — סדר בתיק, בדיקה לפני מוצר חדש",
  yomKippur: "יום כיפור — לא פרסום; אם מכינים מראש: מסר ערכי ומכבד, בלי מכירה",
  sukkot: "סוכות — יציבות, הגנה, בית ומשפחה",
  pesach: "פסח — חופש כלכלי, תכנון מראש, שקיפות",
  shavuot: "שבועות — למידה, הבנה לפני החלטה",
  chanukah: "חנוכה — אור בענן, בחירה מודעת",
  purim: "פורים — קלילות עם אחריות; בלי הבטחות",
  lagBaomer: "ל״ג בעומר — קהילה, יציבות, אמון",
  yomHaZikaron: "יום הזיכרון — כבוד, לא שיווק",
  yomHaAtzmaut: "יום העצמאות — גאווה ישראלית, ביטחון ותכנון",
  yomHaShoah: "יום השואה — זיכרון בלבד",
  yomYerushalayim: "יום ירושלים — שורשים, עתיד, יציבות",
  tishaBav: "תשעה באב — לא פרסום שיווקי",
};

function topicForEvent(ev: Event): string {
  const desc = ev.getDesc();
  if (TOPIC_HINTS[desc]) return TOPIC_HINTS[desc];
  const basename = ev.basename();
  if (/fast/i.test(desc) || basename.includes("צום")) {
    return "יום צום — מסרים רגישים בלבד, ללא מכירה";
  }
  if (ev.getCategories().includes("holiday")) {
    return `חג ${basename} — תוכן ערכי קצר: להבין לפני שממליצים`;
  }
  if (ev.getCategories().includes("modern")) {
    return `אירוע לאומי — ${basename}: מסר מכבד, לא דחיפות`;
  }
  return `יום מיוחד — ${basename}: רעיון לתוכן עדין ומקצועי`;
}

function holidayKey(ev: Event): string {
  return ev.getDesc() || ev.basename().replace(/\s+/g, "_");
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Israeli holidays + national days for a calendar month (Asia/Jerusalem dates). */
export function getHolidaysForMonth(year: number, month: number): HolidayDay[] {
  const il = Location.lookup("Jerusalem");
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const events = HebrewCalendar.calendar({
    start,
    end,
    location: il ?? undefined,
    il: true,
    sedrot: false,
    candlelighting: false,
    isHebrewYear: false,
  });

  const out: HolidayDay[] = [];
  for (const ev of events) {
    const cats = ev.getCategories();
    const isHoliday =
      cats.includes("holiday") ||
      cats.includes("modern") ||
      (ev.getFlags() & flags.CHAG) !== 0;
    if (!isHoliday) continue;

    const date = ev.getDate().greg();
    out.push({
      date: toDateKey(date),
      key: holidayKey(ev),
      label: ev.render("he"),
      topicHint: topicForEvent(ev),
    });
  }

  return out;
}

export function getHolidayForDate(
  year: number,
  month: number,
  dateStr: string,
): HolidayDay | null {
  return getHolidaysForMonth(year, month).find((h) => h.date === dateStr) ?? null;
}

export const HEBREW_MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export const HEBREW_WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** Sunday-first grid offset for a month (Israel). */
export function firstWeekdayOffset(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function todayJerusalemDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
