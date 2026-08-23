import type { HolidayDay } from "@/lib/social-media/types";

export {
  HEBREW_MONTH_NAMES,
  HEBREW_WEEKDAYS,
  daysInMonth,
  firstWeekdayOffset,
  todayJerusalemDateKey,
} from "@/lib/social-media/calendar-ui";

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

type Hebcal = typeof import("@hebcal/core");
type HebcalEvent = InstanceType<Hebcal["Event"]>;

let hebcalPromise: Promise<Hebcal | null> | null = null;

function loadHebcal(): Promise<Hebcal | null> {
  if (!hebcalPromise) {
    hebcalPromise = import("@hebcal/core")
      .then((mod) => mod)
      .catch((err) => {
        console.error("[social-media] @hebcal/core failed to load", err);
        return null;
      });
  }
  return hebcalPromise;
}

function topicForEvent(ev: HebcalEvent): string {
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

function holidayKey(ev: HebcalEvent): string {
  return ev.getDesc() || ev.basename().replace(/\s+/g, "_");
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Israeli holidays + national days for a calendar month (Asia/Jerusalem dates). Server-only. */
export async function getHolidaysForMonth(
  year: number,
  month: number,
): Promise<HolidayDay[]> {
  try {
    const hebcal = await loadHebcal();
    if (!hebcal) return [];

    const { HebrewCalendar, flags, Location } = hebcal;
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
  } catch (err) {
    console.error("[social-media] getHolidaysForMonth failed", err);
    return [];
  }
}

export async function getHolidayForDate(
  year: number,
  month: number,
  dateStr: string,
): Promise<HolidayDay | null> {
  const days = await getHolidaysForMonth(year, month);
  return days.find((h) => h.date === dateStr) ?? null;
}
