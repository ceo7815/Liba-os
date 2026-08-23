import { JERUSALEM_TZ } from "@/lib/social-media/constants";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function lastWeekdayOfMonth(year: number, month1to12: number, weekday: number) {
  const last = new Date(Date.UTC(year, month1to12, 0));
  const lastW = last.getUTCDay();
  const diff = (lastW - weekday + 7) % 7;
  return last.getUTCDate() - diff;
}

/** Israel DST (since 2013): Friday before last Sunday of March → last Sunday of October. */
function israelOffsetHours(utc: Date): 2 | 3 {
  const y = utc.getUTCFullYear();
  const lastSundayMarch = lastWeekdayOfMonth(y, 3, 0);
  const dstStartFriday = lastSundayMarch - 2;
  const start = Date.UTC(y, 2, dstStartFriday, 0, 0, 0);
  const lastSundayOct = lastWeekdayOfMonth(y, 10, 0);
  const end = Date.UTC(y, 9, lastSundayOct, 0, 0, 0);
  const t = utc.getTime();
  return t >= start && t < end ? 3 : 2;
}

function wallClockFromOffset(utc: Date, offsetHours: number) {
  const local = new Date(utc.getTime() + offsetHours * 3_600_000);
  return {
    date: `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`,
    time: `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`,
  };
}

function tryIntlParts(utc: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: JERUSALEM_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(utc);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    let hour = Number(get("hour"));
    if (hour === 24) hour = 0;
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${pad2(hour)}:${get("minute").padStart(2, "0")}`,
    };
  } catch {
    return null;
  }
}

/** Combine YYYY-MM-DD + HH:mm in Asia/Jerusalem → ISO UTC string. Never throws. */
export function jerusalemDateTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hhRaw, mmRaw] = time.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  const timeNorm = `${pad2(Number.isFinite(hh) ? hh : 10)}:${pad2(Number.isFinite(mm) ? mm : 0)}`;
  if (!y || !m || !d) {
    return new Date().toISOString();
  }

  for (const offsetHours of [3, 2] as const) {
    const candidate = new Date(
      Date.UTC(
        y,
        m - 1,
        d,
        (Number.isFinite(hh) ? hh : 10) - offsetHours,
        Number.isFinite(mm) ? mm : 0,
        0,
      ),
    );
    const intl = tryIntlParts(candidate);
    const wall = intl ?? wallClockFromOffset(candidate, israelOffsetHours(candidate));
    if (wall.date === date && wall.time === timeNorm) {
      return candidate.toISOString();
    }
  }

  const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offset = israelOffsetHours(guess);
  return new Date(
    Date.UTC(
      y,
      m - 1,
      d,
      (Number.isFinite(hh) ? hh : 10) - offset,
      Number.isFinite(mm) ? mm : 0,
      0,
    ),
  ).toISOString();
}

export function isoToJerusalemDate(iso: string): string {
  const utc = new Date(iso);
  if (Number.isNaN(utc.getTime())) return "";
  const intl = tryIntlParts(utc);
  if (intl) return intl.date;
  return wallClockFromOffset(utc, israelOffsetHours(utc)).date;
}

export function isoToJerusalemTime(iso: string): string {
  const utc = new Date(iso);
  if (Number.isNaN(utc.getTime())) return "10:00";
  const intl = tryIntlParts(utc);
  if (intl) return intl.time;
  return wallClockFromOffset(utc, israelOffsetHours(utc)).time;
}

/** Inclusive calendar month in Jerusalem. ±3h UTC pad so missing tzdata cannot drop posts. */
export function monthRangeIso(year: number, month: number): {
  start: string;
  end: string;
} {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: new Date(Date.UTC(year, month - 1, 1, -3, 0, 0)).toISOString(),
    end: new Date(Date.UTC(year, month - 1, lastDay, 26, 59, 59)).toISOString(),
  };
}
