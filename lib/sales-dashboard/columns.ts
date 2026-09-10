/** Excel contract for the sales dashboard. First sheet only. Headers must match after trim. */

export const COL = {
  status: "סטאטוס פוליסה",
  premium: "פרמיה",
  process: "סוג תהליך",
  transferDate: "תאריך העברה ליצרן",
  startDate: "תאריך תחילת ביטוח",
  client: "שם לקוח",
  agent: "משווק",
  product: "סוג המוצר",
  company: "חברת הביטוח",
  source: "מקור הפנייה",
} as const;

/** Strip Excel RTL marks / NBSP so new source names still group. */
export function normalizeExcelText(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Headers seen in the live managers workbook that map to COL. */
export const COL_ALIASES: Record<string, string> = {
  "תחילת ביטוח": COL.startDate,
  "מקור הפניה": COL.source,
  "מקור פנייה": COL.source,
  "מקור פניה": COL.source,
  "סטטוס פוליסה": COL.status,
  "סטטוס": COL.status,
  "סטאטוס": COL.status,
};

export function resolveHeader(raw: string): string {
  const trimmed = normalizeExcelText(raw);
  if (!trimmed) return trimmed;
  if (COL_ALIASES[trimmed]) return COL_ALIASES[trimmed];
  if (trimmed.includes("מקור") && trimmed.includes("פני")) return COL.source;
  return trimmed;
}

export const STATUS = {
  active: "פעילה",
  activeShort: "פעיל",
  pending: "ממתינה למינוי",
  archived: "גניזה",
  cancelled: "בוטלה",
} as const;

export const PROCESS = {
  sale: "מכירה",
  appointment: "מינוי",
  agentAppointment: "מינוי סוכן",
} as const;

export type SourcePnlKind = "volume" | "settled";

/** מכירה → היקף. מינוי / מינוי סוכן → נפרעים. */
export function sourcePnlKindForProcess(value: string): SourcePnlKind | "other" {
  const v = normalizeExcelText(value);
  if (!v) return "other";
  if (v === PROCESS.sale || v.startsWith("מכירה")) return "volume";
  if (v.includes("מינוי")) return "settled";
  return "other";
}

export function matchesSourcePnlKind(process: string, kind: SourcePnlKind): boolean {
  return sourcePnlKindForProcess(process) === kind;
}

export const HEBREW_MONTHS: Record<string, string> = {
  "01": "ינו",
  "02": "פבר",
  "03": "מרץ",
  "04": "אפר",
  "05": "מאי",
  "06": "יוני",
  "07": "יולי",
  "08": "אוג",
  "09": "ספט",
  "10": "אוק",
  "11": "נוב",
  "12": "דצ",
};

export const JERUSALEM_TZ = "Asia/Jerusalem";
