/** Shared integer counts. he-IL supplies the thousands separator. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatIls(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** Signed whole-number change. Null when either side is unknown. */
export function formatDelta(current: number | null, previous: number | null): string | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const diff = Math.round(current) - Math.round(previous);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatCount(diff)}`;
}
