export const LEAD_CONTROL_PATH = "/lead-control";

export type ControlLane = "leads" | "sofia" | "mashi" | "rep" | "appointment";
export type ControlState = "overdue" | "on_time" | "unassigned" | "watching" | "blocked";

export type ControlItem = {
  id: string;
  kind: "lead" | "workflow";
  number: number | null;
  name: string;
  status: string;
  assignee: string;
  source: string;
  lane: ControlLane;
  rule: string;
  openedAt: string;
  deadline: string | null;
  state: ControlState;
  lateMs: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const LEAD_TITLES = new Set(["חדש", "מעקב", "מעקב מתקדם", "הצעת מחיר", "טרם נענה"]);

const SALE_RULES: Record<string, { lane: ControlLane; hours?: number; watch?: boolean; rule: string }> = {
  "שיקוף חדש": { lane: "sofia", hours: 24, rule: "לכל היותר יום" },
  "בקרה לפני שיקוף ליבה": { lane: "mashi", hours: 3, rule: "לכל היותר 3 שעות" },
  "לשלוח הצעה להפקה": { lane: "mashi", hours: 3, rule: "לכל היותר 3 שעות" },
  "נשלחה הפקה חדשה": { lane: "mashi", watch: true, rule: "נשלח, בלי שעון איחור" },
  "חוסרים מהחברה": { lane: "rep", hours: 24, rule: "לכל היותר יום" },
  "חוסרי מוכר": { lane: "rep", hours: 24, rule: "לכל היותר יום" },
  "נדרש תנאי חיתום": { lane: "rep", watch: true, rule: "בטיפול הנציג, בלי שעון" },
  "ריגקט לנציג": { lane: "rep", watch: true, rule: "חזר לנציג, בלי שעון" },
};

const APPOINTMENT_BLOCKS = new Set([
  "ריגקט חברה",
  "ריגקט תפעול",
  "נשלח תיקון ריגקט לחברה",
  "הושלם ריגקט חברה",
  "הושלם ריגקט תפעול",
]);

export function normalizeStatus(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function leadTitles(): string[] {
  return [...LEAD_TITLES];
}

export function workflowTitles(): string[] {
  return [...Object.keys(SALE_RULES), "מינוי סוכן חדש", ...APPOINTMENT_BLOCKS];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function jerusalemOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return asUtc - utcMs;
}

function endOfJerusalemDay(value: string): number | null {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return parseTime(value);
  const [year, month, day] = date.split("-").map(Number);
  const noon = Date.UTC(year, month - 1, day, 12, 0, 0);
  return Date.UTC(year, month - 1, day, 23, 59, 59) - jerusalemOffsetMs(noon);
}

function addBusinessDays(fromMs: number, days: number): number {
  let cursor = fromMs;
  let left = days;
  while (left > 0) {
    cursor += DAY;
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      weekday: "short",
    }).format(new Date(cursor));
    if (weekday !== "Fri" && weekday !== "Sat") left -= 1;
  }
  return cursor;
}

function finish(input: {
  id: string;
  kind: ControlItem["kind"];
  number: number | null;
  name: string;
  status: string;
  assignee: string;
  source: string;
  lane: ControlLane;
  rule: string;
  openedMs: number | null;
  deadlineMs: number | null;
  state: ControlState;
  now: number;
}): ControlItem {
  const lateMs =
    input.state === "overdue" && input.deadlineMs != null ? Math.max(0, input.now - input.deadlineMs) : 0;
  return {
    id: input.id,
    kind: input.kind,
    number: input.number,
    name: input.name,
    status: input.status,
    assignee: input.assignee,
    source: input.source,
    lane: input.lane,
    rule: input.rule,
    openedAt: input.openedMs != null ? new Date(input.openedMs).toISOString() : "",
    deadline: input.deadlineMs != null ? new Date(input.deadlineMs).toISOString() : null,
    state: input.state,
    lateMs,
  };
}

function timed(input: {
  id: string;
  kind: ControlItem["kind"];
  number: number | null;
  name: string;
  status: string;
  assignee: string;
  source: string;
  lane: ControlLane;
  rule: string;
  openedMs: number | null;
  deadlineMs: number | null;
  now: number;
  emptyState?: ControlState;
}): ControlItem {
  const state: ControlState =
    input.deadlineMs == null
      ? (input.emptyState ?? "watching")
      : input.now > input.deadlineMs
        ? "overdue"
        : "on_time";
  return finish({ ...input, state });
}

export function classifyLead(
  row: Record<string, unknown>,
  sourceName: string,
  now: number,
): ControlItem | null {
  const status = normalizeStatus(text(row.statusName));
  if (!LEAD_TITLES.has(status)) return null;
  const openedMs = parseTime(row.statusDate) ?? parseTime(row.createdDate);
  const assignee = text(row.assigneeName) || text(row.assignedUserName);
  const name = text(row.fullName) || text(row.customerFullName) || "בלי שם";
  const number = typeof row.number === "number" ? row.number : null;
  const id = text(row.id) || `lead-${number ?? name}`;
  const base = {
    id,
    kind: "lead" as const,
    number,
    name,
    status,
    assignee,
    source: sourceName,
    lane: "leads" as const,
    openedMs,
    now,
  };

  if (status === "חדש") {
    const deadlineMs = openedMs == null ? null : openedMs + 3 * HOUR;
    if (!assignee) {
      return finish({
        ...base,
        rule: "3 שעות מרגע שיש מטפל",
        deadlineMs,
        state: "unassigned",
      });
    }
    return timed({ ...base, rule: "לכל היותר 3 שעות", deadlineMs });
  }

  if (status === "מעקב" || status === "מעקב מתקדם") {
    const dueExact = row.dueAtTimeSet === true ? parseTime(row.dueAt) : null;
    const dueDay = text(row.dueDate) || text(row.dueAt);
    const deadlineMs = dueExact ?? (dueDay ? endOfJerusalemDay(dueDay) : openedMs == null ? null : openedMs + 2 * DAY);
    return timed({
      ...base,
      rule: dueDay ? "לפי תאריך טיפול נדרש" : "לכל היותר יומיים",
      deadlineMs,
    });
  }

  if (status === "הצעת מחיר") {
    const anchor = parseTime(row.lastActivityDate) ?? openedMs;
    return timed({
      ...base,
      rule: "3 ימים בלי תיעוד נוסף",
      deadlineMs: anchor == null ? null : anchor + 3 * DAY,
    });
  }

  return timed({
    ...base,
    rule: "יומיים, ואז לא נענה בכלל",
    deadlineMs: openedMs == null ? null : openedMs + 2 * DAY,
  });
}

export function classifyWorkflow(row: Record<string, unknown>, now: number): ControlItem | null {
  const status = normalizeStatus(text(row.statusName));
  const type = normalizeStatus(text(row.typeName));
  const openedMs = parseTime(row.statusDate) ?? parseTime(row.openDate) ?? parseTime(row.createdDate);
  const assignee = text(row.assigneeName) || text(row.assignedUserName) || text(row.ownerName);
  const name = text(row.customerFullName) || text(row.customerName) || "בלי שם";
  const number = typeof row.number === "number" ? row.number : null;
  const id = text(row.id) || `workflow-${number ?? name}`;
  const base = {
    id,
    kind: "workflow" as const,
    number,
    name,
    status,
    assignee,
    source: type,
    openedMs,
    now,
  };

  if (type === "מכירת ביטוח") {
    const rule = SALE_RULES[status];
    if (!rule) return null;
    if (rule.watch || rule.hours == null) {
      return finish({
        ...base,
        lane: rule.lane,
        rule: rule.rule,
        deadlineMs: null,
        state: "watching",
      });
    }
    return timed({
      ...base,
      lane: rule.lane,
      rule: rule.rule,
      deadlineMs: openedMs == null ? null : openedMs + rule.hours * HOUR,
    });
  }

  if (type === "מינוי סוכן" && status === "מינוי סוכן חדש") {
    return timed({
      ...base,
      lane: "appointment",
      rule: "15 ימי עסקים עד בוצע מינוי סוכן",
      deadlineMs: openedMs == null ? null : addBusinessDays(openedMs, 15),
    });
  }

  if (type === "מינוי סוכן" && APPOINTMENT_BLOCKS.has(status)) {
    return finish({
      ...base,
      lane: "appointment",
      rule: "השעון לא רץ בגלל ריג'קט",
      deadlineMs: null,
      state: "blocked",
    });
  }

  return null;
}
