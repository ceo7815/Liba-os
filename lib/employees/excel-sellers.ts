import { COL, normalizeExcelText, resolveHeader } from "@/lib/sales-dashboard/columns";
import { isShemeshAgentName } from "@/lib/finance/operating-brand";
import type { DashboardData, MarketingProduction } from "@/lib/sales-dashboard/types";

const SKIP_NAMES = new Set(["", "—", "-", "null", "אחר", "ללא", "כן", "לא"]);

export type SellerHint = {
  agent: string;
};

/** Columns that can hold a marketer name. Never clients, dates, products, sources. */
export function isSellerColumnHeader(header: string): boolean {
  const h = resolveHeader(header);
  if (!h) return false;
  if (h === COL.agent) return true;
  if (h === COL.client || h.includes("לקוח")) return false;
  if (h.includes("תאריך") || h.includes("תשלום") || h.includes("פרמיה")) return false;
  if (h.includes("תהליך") || h.includes("סטאטוס") || h.includes("סטטוס")) return false;
  if (h.includes("מוצר") || h.includes("חבר") || h.includes("מקור")) return false;
  if (h.includes("הערות") || h.includes("פוליסה") || h.includes("נייד") || h.includes("שיקוף")) return false;
  return /משווק|סוכן|נציג|עובד|^סגל$|סגל$/.test(h);
}

/** Exact Excel spelling, after stripping RTL marks / extra spaces. */
export function excelAgentDisplay(raw: string): string | null {
  const name = normalizeExcelText(raw);
  if (!name || SKIP_NAMES.has(name)) return null;
  if (name.length > 80) return null;
  if (/^\d+([.,]\d+)?$/.test(name)) return null;
  if ((Object.values(COL) as string[]).includes(name)) return null;
  return name;
}

/** Same person if only spacing / בראון vs בר און differ. Does not shorten last names. */
export function excelAgentKey(name: string): string {
  const display = excelAgentDisplay(name) ?? normalizeExcelText(name);
  return display.replace(/בראון/g, "בר און").replace(/ברודוגו/g, "ברדוגו").replace(/\s+/g, " ").trim();
}

function addDisplay(into: Map<string, Map<string, number>>, raw: string) {
  const display = excelAgentDisplay(raw);
  if (!display) return;
  const key = excelAgentKey(display);
  if (!key) return;
  const counts = into.get(key) ?? new Map<string, number>();
  counts.set(display, (counts.get(display) ?? 0) + 1);
  into.set(key, counts);
}

function preferredDisplay(counts: Map<string, number>): string {
  return Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], "he"),
  )[0][0];
}

export function collectSellerNamesFromProduction(
  row: Pick<MarketingProduction, "agent" | "fields">,
  into: Map<string, Map<string, number>>,
) {
  addDisplay(into, row.agent);
  for (const [header, value] of Object.entries(row.fields ?? {})) {
    if (!isSellerColumnHeader(header)) continue;
    addDisplay(into, value);
  }
}

/** Every distinct marketer in the workbook — exact Excel spelling, any status / process / sheet. */
export function collectExcelSellerNames(
  data: DashboardData | null | undefined,
  extra: SellerHint[] = [],
): string[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const name of data?.marketing?.sellerCatalog ?? []) addDisplay(byKey, name);
  for (const row of data?.marketing?.productions ?? []) collectSellerNamesFromProduction(row, byKey);
  for (const row of data?.marketing?.agents ?? []) addDisplay(byKey, row.name);
  for (const row of data?.agents ?? []) addDisplay(byKey, row.name);
  for (const row of extra) addDisplay(byKey, row.agent);
  return Array.from(byKey.values())
    .map((counts) => preferredDisplay(counts))
    .sort((a, b) => a.localeCompare(b, "he"));
}

export function waitCircleForImportedSeller(name: string): string {
  if (isShemeshAgentName(name)) return "שמש";
  return "ליבה";
}
