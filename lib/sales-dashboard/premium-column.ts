import { COL, normalizeExcelText, resolveHeader } from "@/lib/sales-dashboard/columns";

const KNOWN_HEADERS = new Set<string>(Object.values(COL));

function resolvedHeaders(headers: string[]): string[] {
  return headers.map((header) => resolveHeader(header));
}

function countHeader(resolved: string[], name: string): number {
  let count = 0;
  for (const header of resolved) {
    if (header === name) count += 1;
  }
  return count;
}

/** A header cell that is only a number, such as the live sheet's J1 value 64. */
export function isNumericColumnHeader(header: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(normalizeExcelText(header));
}

/**
 * Premium column when the sheet has no «פרמיה» header.
 *
 * On the live managers sheet the monthly premium is column J. Its header cell
 * is the number 64, and it is the only column between I «סוג המוצר» and
 * K «תחילת ביטוח». That slot is used only when all of these hold:
 * the sheet has exactly one product header and exactly one start-date header,
 * they have exactly one column between them in that order, and that column's
 * header is a bare number rather than another field name.
 * Any other layout returns -1 so premium stays unread.
 * A sheet that already has «פרמיה» always returns -1.
 */
export function fallbackPremiumHeaderIndex(headers: string[]): number {
  const resolved = resolvedHeaders(headers);
  if (countHeader(resolved, COL.premium) > 0) return -1;
  if (countHeader(resolved, COL.product) !== 1) return -1;
  if (countHeader(resolved, COL.startDate) !== 1) return -1;
  const productAt = resolved.indexOf(COL.product);
  const startAt = resolved.indexOf(COL.startDate);
  if (startAt !== productAt + 2) return -1;
  const between = productAt + 1;
  const header = resolved[between] ?? "";
  if (!isNumericColumnHeader(header)) return -1;
  if (KNOWN_HEADERS.has(header)) return -1;
  return between;
}
