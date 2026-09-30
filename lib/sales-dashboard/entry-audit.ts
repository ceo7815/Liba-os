import { normalizeExcelText, sourcePnlKindForProcess } from "@/lib/sales-dashboard/columns";
import { parseWorkbookDate, type WorkbookSheet } from "@/lib/sales-dashboard/workbook-grid";

export type RequiredEntryField = {
  id: string;
  label: string;
  match: (header: string) => boolean;
};

export const REQUIRED_ENTRY_FIELDS: RequiredEntryField[] = [
  { id: "agent", label: "משווק", match: (header) => header === "משווק" || header.startsWith("משווק ") },
  { id: "transfer", label: "תאריך העברה ליצרן", match: (header) => header.includes("העברה") },
  {
    id: "source",
    label: "מקור הפנייה",
    match: (header) => header.includes("מקור") && header.includes("פני"),
  },
  { id: "process", label: "סוג תהליך", match: (header) => header.includes("תהליך") },
  {
    id: "status",
    label: "סטטוס פוליסה",
    match: (header) => header.includes("סטטוס") || header.includes("סטאטוס"),
  },
  {
    id: "client",
    label: "שם לקוח",
    match: (header) => header.includes("שם") && header.includes("לקוח"),
  },
  {
    id: "id",
    label: "ת.ז לקוח",
    match: (header) => header.includes("ת.ז") && header.includes("לקוח"),
  },
  {
    id: "company",
    label: "חברת ביטוח",
    match: (header) => header.includes("חברת") && header.includes("ביטוח"),
  },
  { id: "premium", label: "פרמיה", match: (header) => header === "פרמיה" },
  { id: "start", label: "תחילת ביטוח", match: (header) => header.includes("תחילת") },
  {
    id: "offset",
    label: "ביטול נגדי 2",
    match: (header) => header.includes("ביטול") && header.includes("נגדי"),
  },
  { id: "mobile", label: "נייד", match: (header) => header.includes("נייד") },
];

/** פעילה, בתהליך, חוסרים, שימור וחיתום: כל חוסר. דחייה, בוטלה וגניזה: כל חוסר חוץ מתחילת ביטוח ופרמיה. */
export function completionStatusKind(status: string): "full" | "partial" | null {
  const text = normalizeExcelText(status);
  if (!text) return null;
  if (
    text.includes("גניז") ||
    text.includes("נגנז") ||
    text.includes("בוטל") ||
    text.includes("דחי") ||
    text.includes("נדח")
  ) {
    return "partial";
  }
  if (
    text.includes("פעיל") ||
    text.includes("בתהליך") ||
    text.includes("חוסר") ||
    text.includes("שימור") ||
    text.includes("חיתום")
  ) {
    return "full";
  }
  return null;
}

const CLOSED_IGNORED_FIELDS = new Set(["premium", "start"]);

export type EntryGap = {
  sheet: string;
  rowId: string;
  excelRow: number;
  client: string;
  agent: string;
  company: string;
  status: string;
  transfer: string;
  /** UTC day of תאריך העברה ליצרן. Empty when that date was not entered. */
  transferAt: number | null;
  missing: { id: string; label: string }[];
};

export type EntryGapSummary = {
  byField: { id: string; label: string; count: number }[];
  byAgent: { agent: string; count: number }[];
};

export type EntryAudit = {
  checked: number;
  gaps: EntryGap[];
  byField: EntryGapSummary["byField"];
  byAgent: EntryGapSummary["byAgent"];
  missingColumns: { sheet: string; label: string }[];
};

function isBlank(value: string): boolean {
  const text = normalizeExcelText(value);
  return !text || text === "—" || text === "-" || text === "–";
}

/** מינוי and מינוי סוכן are not tracked. A blank process stays, because סוג תהליך is required. */
function isTrackedSale(process: string): boolean {
  const kind = sourcePnlKindForProcess(process);
  if (kind === "settled") return false;
  if (kind === "volume") return true;
  return isBlank(process);
}

function columnIndex(headers: string[], field: RequiredEntryField): number {
  const normalized = headers.map((header) => normalizeExcelText(header));
  if (field.id === "offset") {
    const numbered = normalized.findIndex((header) => field.match(header) && header.includes("2"));
    if (numbered >= 0) return numbered;
  }
  if (field.id === "id") {
    const withClient = normalized.findIndex((header) => field.match(header));
    if (withClient >= 0) return withClient;
    return normalized.findIndex((header) => header.includes("ת.ז") && !header.includes("משווק"));
  }
  return normalized.findIndex((header) => field.match(header));
}

export function auditWorkbookEntry(sheets: WorkbookSheet[]): EntryAudit {
  const gaps: EntryGap[] = [];
  const missingColumns: { sheet: string; label: string }[] = [];
  let checked = 0;

  for (const sheet of sheets) {
    if (sheet.kind !== "report") continue;
    const indexes = REQUIRED_ENTRY_FIELDS.map((field) => ({
      field,
      index: columnIndex(sheet.headers, field),
    }));
    for (const item of indexes) {
      if (item.index < 0) missingColumns.push({ sheet: sheet.name, label: item.field.label });
    }
    const clientIndex = indexes.find((item) => item.field.id === "client")?.index ?? -1;
    const agentIndex = indexes.find((item) => item.field.id === "agent")?.index ?? -1;
    const companyIndex = indexes.find((item) => item.field.id === "company")?.index ?? -1;
    const transferIndex = indexes.find((item) => item.field.id === "transfer")?.index ?? -1;
    const processIndex = indexes.find((item) => item.field.id === "process")?.index ?? -1;
    const statusIndex = indexes.find((item) => item.field.id === "status")?.index ?? -1;

    for (const row of sheet.rows) {
      if (row.cells.every((value) => isBlank(value))) continue;
      const process = processIndex >= 0 ? row.cells[processIndex] ?? "" : "";
      if (!isTrackedSale(process)) continue;
      const status = statusIndex >= 0 ? normalizeExcelText(row.cells[statusIndex] ?? "") : "";
      const kind = completionStatusKind(status);
      if (!kind) continue;
      checked += 1;
      const missing = indexes
        .filter((item) => item.index >= 0 && isBlank(row.cells[item.index] ?? ""))
        .filter((item) => kind === "full" || !CLOSED_IGNORED_FIELDS.has(item.field.id))
        .map((item) => ({ id: item.field.id, label: item.field.label }));
      if (missing.length === 0) continue;
      const transfer = transferIndex >= 0 ? normalizeExcelText(row.cells[transferIndex] ?? "") : "";
      gaps.push({
        sheet: sheet.name,
        rowId: row.id,
        excelRow: row.excelRow,
        client: clientIndex >= 0 ? normalizeExcelText(row.cells[clientIndex] ?? "") : "",
        agent: agentIndex >= 0 ? normalizeExcelText(row.cells[agentIndex] ?? "") : "",
        company: companyIndex >= 0 ? normalizeExcelText(row.cells[companyIndex] ?? "") : "",
        status,
        transfer,
        transferAt: parseWorkbookDate(transfer),
        missing,
      });
    }
  }

  gaps.sort((a, b) => (b.transferAt ?? -1) - (a.transferAt ?? -1) || b.excelRow - a.excelRow);
  const summary = summarizeEntryGaps(gaps);

  return {
    checked,
    gaps,
    byField: summary.byField,
    byAgent: summary.byAgent,
    missingColumns,
  };
}

export function summarizeEntryGaps(gaps: EntryGap[]): EntryGapSummary {
  const fieldCounts = new Map<string, number>();
  const agentMap = new Map<string, number>();
  for (const gap of gaps) {
    for (const field of gap.missing) fieldCounts.set(field.id, (fieldCounts.get(field.id) ?? 0) + 1);
    const agent = gap.agent || "בלי משווק";
    agentMap.set(agent, (agentMap.get(agent) ?? 0) + 1);
  }
  return {
    byField: REQUIRED_ENTRY_FIELDS.map((field) => ({
      id: field.id,
      label: field.label,
      count: fieldCounts.get(field.id) ?? 0,
    })).filter((field) => field.count > 0),
    byAgent: Array.from(agentMap.entries())
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count || a.agent.localeCompare(b.agent, "he")),
  };
}

export function filterEntryGaps(
  gaps: EntryGap[],
  from: number | null,
  to: number | null,
): { matched: EntryGap[]; undated: number } {
  const undated = gaps.filter((gap) => gap.transferAt == null).length;
  if (from == null && to == null) return { matched: gaps, undated };
  return {
    matched: gaps.filter((gap) => {
      if (gap.transferAt == null) return false;
      if (from != null && gap.transferAt < from) return false;
      if (to != null && gap.transferAt > to) return false;
      return true;
    }),
    undated,
  };
}

const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function entryGapMonths(gaps: EntryGap[]): { key: string; label: string; from: string; to: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const gap of gaps) {
    if (gap.transferAt == null) continue;
    const date = new Date(gap.transferAt);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return {
        key,
        label: `${HEBREW_MONTHS[month - 1]} ${year}`,
        from: isoDay(year, month, 1),
        to: isoDay(year, month, lastDay),
        count,
      };
    })
    .sort((a, b) => (a.from < b.from ? 1 : -1));
}

export function groupEntryGaps(gaps: EntryGap[]): { agent: string; rows: EntryGap[] }[] {
  const map = new Map<string, EntryGap[]>();
  for (const gap of gaps) {
    const agent = gap.agent || "בלי משווק";
    const list = map.get(agent) ?? [];
    list.push(gap);
    map.set(agent, list);
  }
  return Array.from(map.entries())
    .map(([agent, rows]) => ({ agent, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.agent.localeCompare(b.agent, "he"));
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assertEntryAudit() {
  const headers = [
    "משווק",
    "תאריך העברה ליצרן",
    "מקור הפנייה",
    "סוג תהליך",
    "סטטוס פוליסה",
    "שם לקוח",
    "ת.ז לקוח",
    "חברת הביטוח",
    "פרמיה",
    "תחילת ביטוח",
    "ביטול נגדי 2",
    "נייד",
  ];
  const full = ["דנה", "1.1.26", "גוגל", "מכירה", "פעילה", "יוסי", "123", "הראל", "0", "1.2.26", "לא", "050"];
  const thin = ["", "1.1.26", "", "מכירה", "פעילה", "יוסי", "", "הראל", "", "1.2.26", "", ""];
  const appointment = ["דנה", "1.1.26", "גוגל", "מינוי", "פעילה", "יוסי", "", "הראל", "", "", "", ""];
  const closedDatesOnly = ["דנה", "1.1.26", "גוגל", "מכירה", "גניזה", "יוסי", "123", "הראל", "", "", "לא", "050"];
  const closedOther = ["", "1.1.26", "גוגל", "מכירה", "בוטלה", "יוסי", "", "הראל", "", "", "לא", "050"];
  const waiting = ["דנה", "", "גוגל", "מכירה", "ממתינה למינוי", "יוסי", "", "הראל", "", "", "", ""];
  const audit = auditWorkbookEntry([
    {
      name: "2026",
      kind: "report",
      headers,
      rows: [
        { id: "a", excelRow: 2, cells: full },
        { id: "b", excelRow: 3, cells: thin },
        { id: "c", excelRow: 4, cells: appointment },
        { id: "d", excelRow: 5, cells: closedDatesOnly },
        { id: "e", excelRow: 6, cells: closedOther },
        { id: "f", excelRow: 7, cells: waiting },
      ],
    },
  ]);
  const openGap = audit.gaps.find((gap) => gap.rowId === "b");
  const closedGap = audit.gaps.find((gap) => gap.rowId === "e");
  if (audit.checked !== 4 || audit.gaps.length !== 2 || openGap?.missing.length !== 6) {
    throw new Error(`expected two gaps, open row missing 6, got ${audit.gaps.length}/${openGap?.missing.length}`);
  }
  if (!openGap?.missing.some((field) => field.id === "premium")) {
    throw new Error("empty premium must be missing on an active row");
  }
  if (closedGap?.missing.some((field) => field.id === "premium" || field.id === "start")) {
    throw new Error("closed rows ignore missing premium and start date");
  }
  if (!closedGap?.missing.some((field) => field.id === "agent")) {
    throw new Error("closed rows still need the other missing fields");
  }
  if (audit.gaps[0]?.company !== "הראל" || audit.gaps[0]?.transferAt == null) {
    throw new Error("company and transfer date must be kept");
  }
  const outside = filterEntryGaps(audit.gaps, Date.UTC(2026, 1, 1), Date.UTC(2026, 1, 28));
  if (outside.matched.length !== 0 || outside.undated !== 0) {
    throw new Error("January row must stay out of February");
  }
}

assertEntryAudit();
