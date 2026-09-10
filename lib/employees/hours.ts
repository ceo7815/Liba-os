import * as XLSX from "xlsx";
import { excelAgentDisplay, excelAgentKey } from "@/lib/employees/excel-sellers";
import { normalizeExcelText } from "@/lib/sales-dashboard/columns";

export type AttendanceDay = {
  date: string;
  label: string;
  kind: string;
  event: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  paidHours: number;
};

export type EmployeeHoursRow = {
  employeeId: string;
  fullName: string;
  month: string;
  hours: number;
  source: string;
  fileName: string | null;
  uploadedAt: string;
  days: AttendanceDay[];
};

export type ParsedHoursLine = {
  name: string;
  month: string;
  hours: number;
  days: AttendanceDay[];
};

const HEBREW_MONTH_INDEX: Record<string, string> = {
  ינו: "01",
  ינואר: "01",
  פבר: "02",
  פברואר: "02",
  מרץ: "03",
  אפר: "04",
  אפריל: "04",
  מאי: "05",
  יונ: "06",
  יוני: "06",
  יול: "07",
  יולי: "07",
  אוג: "08",
  אוגוסט: "08",
  ספט: "09",
  ספטמבר: "09",
  אוק: "10",
  אוקטובר: "10",
  נוב: "11",
  נובמבר: "11",
  דצמ: "12",
  דצמבר: "12",
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return normalizeExcelText(String(value));
}

function clockText(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1) {
    return formatHoursClock(value * 24);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatHoursClock(value.getHours() + value.getMinutes() / 60);
  }
  const text = normalizeExcelText(String(value)).replace(/^[*\s]+/, "");
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : "";
}

function parseHoursValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0 && value < 1) return value * 24;
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() + value.getMinutes() / 60 + value.getSeconds() / 3600;
  }
  const text = cellText(value).replace(",", ".");
  if (!text) return 0;
  const clock = text.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
  if (clock) {
    return Number(clock[1]) + Number(clock[2]) / 60;
  }
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatHoursClock(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const rounded = Math.round(hours * 60);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatIsoDay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function attendanceDaysWorked(days: AttendanceDay[] | undefined): number {
  if (!days?.length) return 0;
  return new Set(days.filter((day) => day.paidHours > 0).map((day) => day.date)).size;
}

export function isVacationEvent(event: string | undefined): boolean {
  const text = (event ?? "").trim();
  if (!text || /היעדר/.test(text)) return false;
  return /חופש/.test(text);
}

export function countVacationDays(days: AttendanceDay[] | undefined): number {
  if (!days?.length) return 0;
  return new Set(days.filter((day) => isVacationEvent(day.event)).map((day) => day.date)).size;
}

export function parseAttendanceDays(value: unknown): AttendanceDay[] {
  if (!Array.isArray(value)) return [];
  const days: AttendanceDay[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const date = String(item.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    days.push({
      date,
      label: String(item.label ?? ""),
      kind: String(item.kind ?? ""),
      event: String(item.event ?? ""),
      clockIn: String(item.clockIn ?? ""),
      clockOut: String(item.clockOut ?? ""),
      totalHours: Number(item.totalHours) || 0,
      paidHours: Number(item.paidHours) || 0,
    });
  }
  return days;
}

export function parseMonthKey(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}`;
    }
  }
  const text = cellText(value);
  const iso = text.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const slash = text.match(/^(\d{1,2})[./](\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, "0")}`;
  const slashDay = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (slashDay) {
    const year = slashDay[3].length === 2 ? `20${slashDay[3]}` : slashDay[3];
    return `${year}-${slashDay[2].padStart(2, "0")}`;
  }
  const heb = text.match(/([א-ת]{3,})[^\d]*(\d{4})/);
  if (heb) {
    const month = HEBREW_MONTH_INDEX[heb[1]];
    if (month) return `${heb[2]}-${month}`;
  }
  return "";
}

function looksNameHeader(header: string): boolean {
  return /שם|עובד|משווק|employee|worker|name/.test(header) && !/חברה|לקוח|קובץ/.test(header);
}

function looksHoursHeader(header: string): boolean {
  if (/שעתי|שכר/.test(header)) return false;
  return /שעות משולמות|שעות|hours|סה.?כ.*שע|נוכחות/.test(header);
}

function looksMonthHeader(header: string): boolean {
  return /חודש|month|תקופה|period/.test(header);
}

function looksDateHeader(header: string): boolean {
  return /תאריך|date|יום/.test(header);
}

function looksTimeWatchHeader(headers: string[]): boolean {
  const blob = headers.join(" ");
  return /תאריך/.test(blob) && /שעות/.test(blob);
}

function looksDayLabel(value: unknown): { day: number; label: string } | null {
  const text = cellText(value);
  const match = text.match(/^([א-ת])\s*[-–]\s*(\d{1,2})$/);
  if (!match) return null;
  const day = Number(match[2]);
  if (day < 1 || day > 31) return null;
  return { day, label: `${match[1]} - ${String(day).padStart(2, "0")}` };
}

function parseDateRange(value: unknown): { year: number; month: number } | null {
  const text = cellText(value);
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  return { year: Number(match[3]), month: Number(match[2]) };
}

function looksSummaryRow(row: unknown[] | undefined): boolean {
  const text = cellText(row?.[0]);
  return /סיכום|חישוב יומי|ימי נוכחות|שעות נוכחות|שעות משולמות|שעות חוסר|הצגת אירועים/.test(text);
}

function looksPersonName(value: unknown): string | null {
  const name = excelAgentDisplay(cellText(value));
  if (!name) return null;
  if (looksDayLabel(value) != null) return null;
  if (/תאריך|סיכום|חישוב|חברה|סוכנות/.test(name)) return null;
  if (/\d{1,2}\.\d{1,2}\.\d{4}/.test(name)) return null;
  return name;
}

function monthIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emptyLine(name: string, month: string): ParsedHoursLine {
  return { name, month, hours: 0, days: [] };
}

function addLine(into: Map<string, ParsedHoursLine>, line: ParsedHoursLine) {
  const key = `${excelAgentKey(line.name)}|${line.month}`;
  const current = into.get(key) ?? emptyLine(line.name, line.month);
  current.hours += line.hours;
  if (line.days.length) current.days.push(...line.days);
  into.set(key, current);
}

function parseTimeWatchSheet(aoa: unknown[][]): ParsedHoursLine[] {
  const totals = new Map<string, ParsedHoursLine>();
  let name = "";
  let year = 0;
  let month = 0;
  let lastDay = 0;
  let headerIndex = -1;
  let kindCol = 1;
  let eventCol = -1;
  let inCol = 2;
  let outCol = 3;
  let totalCol = 4;
  let hoursCol = 5;

  const commitDay = (person: string, y: number, m: number, day: AttendanceDay) => {
    if (!person || y < 2000 || m < 1 || m > 12) return;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const key = `${excelAgentKey(person)}|${monthKey}`;
    const current = totals.get(key) ?? emptyLine(person, monthKey);
    current.hours += day.paidHours;
    current.days.push(day);
    totals.set(key, current);
  };

  for (let i = 0; i < aoa.length; i += 1) {
    const row = aoa[i] ?? [];
    const headers = row.map((cell) => cellText(cell));
    if (looksTimeWatchHeader(headers)) {
      headerIndex = i;
      kindCol = headers.findIndex((h) => /^סוג$/.test(h));
      eventCol = headers.findIndex((h) => /אירוע/.test(h));
      inCol = headers.findIndex((h) => /כניסה/.test(h));
      outCol = headers.findIndex((h) => /יציאה/.test(h));
      totalCol = headers.findIndex((h) => /סה.?כ.*שעות/.test(h) && !/משולמ/.test(h));
      hoursCol = headers.findIndex((h) => /שעות משולמות/.test(h));
      if (hoursCol < 0) hoursCol = headers.findIndex(looksHoursHeader);
      lastDay = 0;
      continue;
    }

    const range = parseDateRange(row[0]);
    if (range) {
      year = range.year;
      month = range.month;
      lastDay = 0;
      continue;
    }

    const maybeName = looksPersonName(row[0]);
    if (looksSummaryRow(row)) {
      headerIndex = -1;
      lastDay = 0;
      continue;
    }
    if (maybeName && headerIndex < 0) {
      name = maybeName;
      continue;
    }

    if (headerIndex < 0 || hoursCol < 0 || !name) continue;
    const marked = looksDayLabel(row[0]);
    if (!marked) continue;
    if (lastDay > 0 && marked.day < lastDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    lastDay = marked.day;
    commitDay(name, year, month, {
      date: monthIso(year, month, marked.day),
      label: marked.label,
      kind: kindCol >= 0 ? cellText(row[kindCol]) : "",
      event: eventCol >= 0 ? cellText(row[eventCol]).trim() : "",
      clockIn: inCol >= 0 ? clockText(row[inCol]) : "",
      clockOut: outCol >= 0 ? clockText(row[outCol]) : "",
      totalHours: Math.round(parseHoursValue(row[totalCol >= 0 ? totalCol : hoursCol]) * 100) / 100,
      paidHours: Math.round(parseHoursValue(row[hoursCol]) * 100) / 100,
    });
  }

  return Array.from(totals.values()).map((row) => ({
    ...row,
    hours: Math.round(row.hours * 100) / 100,
  }));
}

function detectFallbackMonth(rows: unknown[][]): string {
  for (const row of rows.slice(0, 8)) {
    for (const cell of row) {
      const month = parseMonthKey(cell);
      if (month) return month;
    }
  }
  return "";
}

export function parseAttendanceHoursWorkbook(
  input: ArrayBuffer | Uint8Array | Buffer,
  fileName?: string | null,
): ParsedHoursLine[] {
  const wb = XLSX.read(input, { type: "array", cellDates: true });
  const fromFile = parseMonthKey(fileName ?? "");
  const totals = new Map<string, ParsedHoursLine>();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const aoa = XLSX.utils.sheet_to_json<(unknown | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    if (aoa.length < 2) continue;
    const timeWatch = parseTimeWatchSheet(aoa);
    if (timeWatch.length > 0) {
      for (const line of timeWatch) addLine(totals, line);
      continue;
    }
    const fallbackMonth = parseMonthKey(sheetName) || fromFile || detectFallbackMonth(aoa);
    let headerIndex = 0;
    let nameCol = -1;
    let hoursCol = -1;
    let monthCol = -1;
    let dateCol = -1;
    for (let i = 0; i < Math.min(aoa.length, 12); i += 1) {
      const headers = (aoa[i] ?? []).map((cell) => cellText(cell));
      const n = headers.findIndex(looksNameHeader);
      const h = headers.findIndex(looksHoursHeader);
      if (n < 0 || h < 0) continue;
      headerIndex = i;
      nameCol = n;
      hoursCol = h;
      monthCol = headers.findIndex(looksMonthHeader);
      dateCol = headers.findIndex(looksDateHeader);
      break;
    }
    if (nameCol < 0 || hoursCol < 0) continue;
    for (const row of aoa.slice(headerIndex + 1)) {
      const name = excelAgentDisplay(cellText(row?.[nameCol]));
      if (!name) continue;
      const hours = parseHoursValue(row?.[hoursCol]);
      if (hours <= 0) continue;
      const month =
        (monthCol >= 0 ? parseMonthKey(row?.[monthCol]) : "") ||
        (dateCol >= 0 ? parseMonthKey(row?.[dateCol]) : "") ||
        fallbackMonth;
      if (!month) continue;
      addLine(totals, { name, month, hours, days: [] });
    }
  }

  return Array.from(totals.values())
    .map((row) => ({ ...row, hours: Math.round(row.hours * 100) / 100 }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name, "he"));
}

export function groupHoursByEmployeeId(
  rows: Array<{ employeeId?: string; employee_id?: string; month: string; hours: number }>,
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const id = row.employeeId || row.employee_id;
    if (!id || !/^\d{4}-\d{2}$/.test(row.month)) continue;
    const current = map.get(id) ?? {};
    current[row.month] = Number(row.hours) || 0;
    map.set(id, current);
  }
  return map;
}

export function groupVacationDaysByEmployeeId(
  rows: Array<{
    employeeId?: string;
    employee_id?: string;
    month: string;
    days?: AttendanceDay[];
  }>,
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const id = row.employeeId || row.employee_id;
    if (!id || !/^\d{4}-\d{2}$/.test(row.month)) continue;
    const days = countVacationDays(row.days);
    if (days <= 0) continue;
    const current = map.get(id) ?? {};
    current[row.month] = days;
    map.set(id, current);
  }
  return map;
}

export function hoursTemplateWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const monthly = XLSX.utils.aoa_to_sheet([
    ["שם עובד", "חודש", "שעות"],
    ["ניב קובי", "2026-08", 160],
    ["אוריאל כהן", "2026-08", 148.5],
  ]);
  XLSX.utils.book_append_sheet(wb, monthly, "שעות");
  const daily = XLSX.utils.aoa_to_sheet([
    ["ניב לב רן", null, null, "ליבה"],
    ["01.08.2026 - 31.08.2026"],
    ["תאריך", "סוג", "כניסה", "יציאה", "סה\"כ שעות", "שעות משולמות", "אירוע"],
    ["א - 02", "יום חול", "09:00", "17:00", "08:00", "08:00", null],
    ["ב - 03", "יום חול", "09:00", "17:30", "08:30", "08:30", null],
    ["ג - 04", "יום חול", null, null, null, null, "חופש"],
  ]);
  XLSX.utils.book_append_sheet(wb, daily, "נוכחות");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function assertHoursWorkbookParses(): void {
  const parsed = parseAttendanceHoursWorkbook(hoursTemplateWorkbook(), "hours-2026-08.xlsx");
  const monthly = parsed.filter((row) => row.month === "2026-08");
  if (monthly.length < 3) throw new Error(`expected at least 3 August hour rows, got ${parsed.length}`);
  const niv = parsed.find((row) => row.name === "ניב לב רן" && row.month === "2026-08");
  if (!niv || niv.hours !== 16.5) {
    throw new Error(`expected TimeWatch daily hours 16.5, got ${niv?.hours}`);
  }
  if (niv.days.length !== 3 || niv.days[0]?.clockIn !== "09:00") {
    throw new Error(`expected 3 TimeWatch days with clock-in, got ${niv.days.length}`);
  }
  if (countVacationDays(niv.days) !== 1 || niv.days[2]?.event !== "חופש") {
    throw new Error(`expected one vacation event on the third day, got ${niv.days[2]?.event}`);
  }
}
