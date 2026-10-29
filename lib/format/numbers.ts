/**
 * Shared number display for Liba and Shemesh.
 * Counts are whole numbers with he-IL grouping. Money keeps agorot.
 * Decimals are only for rates, hours, and other measured fractions.
 */

const COUNT = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
});

function moneyFormat(fractionDigits: 0 | 2): Intl.NumberFormat {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

const MONEY_WHOLE = moneyFormat(0);
const MONEY_AGOROT = moneyFormat(2);

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return COUNT.format(Math.round(value));
}

/** Shekel display. Whole shekels stay whole; anything else shows agorot. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? MONEY_WHOLE.format(rounded) : MONEY_AGOROT.format(rounded);
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const places = Math.max(0, Math.min(4, digits));
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: places,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}
