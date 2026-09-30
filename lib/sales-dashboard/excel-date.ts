import * as XLSX from "xlsx";

/**
 * Excel stores a calendar day, not a moment in time.
 * SheetJS `cellDates` rebuilds that day in the computer's local clock.
 * `Date.UTC(y, m, d)` stores it at UTC midnight.
 * Formatting either one in another timezone (Jerusalem vs Dubai) moves the day.
 * This reads the calendar day Excel shows, on any machine.
 */

export type ExcelCalendarDay = { y: number; m: number; d: number };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatExcelCalendarIso(day: ExcelCalendarDay): string {
  return `${day.y}-${pad(day.m)}-${pad(day.d)}`;
}

function isMidnight(hours: number, minutes: number, seconds: number, ms: number): boolean {
  return hours === 0 && minutes === 0 && seconds === 0 && ms === 0;
}

/** Local fields = SheetJS / `new Date(y, m, d)`. UTC fields = `Date.UTC`. */
function partsFromDate(date: Date): ExcelCalendarDay {
  const utcMidnight = isMidnight(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
  const localMidnight = isMidnight(
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  if (utcMidnight && !localMidnight) {
    return {
      y: date.getUTCFullYear(),
      m: date.getUTCMonth() + 1,
      d: date.getUTCDate(),
    };
  }
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
  };
}

function partsFromText(raw: string): ExcelCalendarDay | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  }
  const israeli = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s|$)/);
  if (!israeli) return null;
  const day = Number(israeli[1]);
  const month = Number(israeli[2]);
  let year = Number(israeli[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { y: year, m: month, d: day };
}

export function excelCalendarDay(value: unknown): ExcelCalendarDay | null {
  if (value == null || value === "" || value === "—") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return partsFromDate(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || parsed.y < 1900 || parsed.y > 2100) return null;
    return { y: parsed.y, m: parsed.m, d: parsed.d };
  }
  if (typeof value === "string") return partsFromText(value.trim());
  return null;
}

/** `YYYY-MM-DD` as Excel shows the cell. Empty when the value is not a date. */
export function excelCalendarIso(value: unknown): string {
  const day = excelCalendarDay(value);
  return day ? formatExcelCalendarIso(day) : "";
}

export function assertExcelCalendarIgnoresTimezone(): void {
  const utc = excelCalendarIso(new Date(Date.UTC(2026, 8, 1)));
  const local = excelCalendarIso(new Date(2026, 8, 1));
  const serial = excelCalendarIso(46266);
  const text = excelCalendarIso("01/09/2026");
  if (utc !== "2026-09-01" || local !== "2026-09-01" || serial !== "2026-09-01" || text !== "2026-09-01") {
    throw new Error(
      `excel calendar day drifted: utc=${utc} local=${local} serial=${serial} text=${text}`,
    );
  }
  if (excelCalendarIso("15/08/2026") !== "2026-08-15") {
    throw new Error("expected Israeli day/month text to stay 15 August");
  }
}
