/** Fee math. Rates come from shemesh_fee_settings. Nothing here is a business constant. */

export type FeeSettings = {
  redemptionFeeRate: number | null;
  taxFeeRate: number | null;
  vatRate: number | null;
  slaDays: number | null;
};

export const EMPTY_FEE_SETTINGS: FeeSettings = {
  redemptionFeeRate: null,
  taxFeeRate: null,
  vatRate: null,
  slaDays: null,
};

export function rateOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export function feeForKind(kind: "redemption" | "tax_refund", gross: number, settings: FeeSettings): {
  rate: number | null;
  fee: number | null;
  net: number | null;
} {
  const rate = kind === "redemption" ? settings.redemptionFeeRate : settings.taxFeeRate;
  if (rate == null || !Number.isFinite(gross)) return { rate: null, fee: null, net: null };
  const fee = Math.round(gross * rate * 100) / 100;
  return { rate, fee, net: Math.round((gross - fee) * 100) / 100 };
}

export function deadlineFromSla(openedOn: string, slaDays: number | null): string | null {
  if (slaDays == null || !/^\d{4}-\d{2}-\d{2}$/.test(openedOn)) return null;
  const date = new Date(`${openedOn}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + slaDays);
  return date.toISOString().slice(0, 10);
}

export function slaOverdue(deadline: string | null, status: string, today: string): boolean {
  if (!deadline || status === "done" || status === "cancelled") return false;
  return deadline < today;
}

export function assertFeeComesFromSettings(): void {
  const settings: FeeSettings = { ...EMPTY_FEE_SETTINGS, redemptionFeeRate: 0.2, taxFeeRate: 0.1 };
  const redemption = feeForKind("redemption", 1000, settings);
  const tax = feeForKind("tax_refund", 1000, settings);
  if (redemption.fee !== 200 || redemption.net !== 800) throw new Error("redemption fee must follow the saved rate");
  if (tax.fee !== 100 || tax.net !== 900) throw new Error("tax fee must follow the saved rate");
  const empty = feeForKind("redemption", 1000, EMPTY_FEE_SETTINGS);
  if (empty.fee != null || empty.net != null) throw new Error("missing rate must not invent a fee");
  if (deadlineFromSla("2026-04-01", 3) !== "2026-04-04") throw new Error("SLA deadline drifted");
  if (!slaOverdue("2026-04-01", "open", "2026-04-02")) throw new Error("open past deadline should alert");
  if (slaOverdue("2026-04-01", "done", "2026-04-02")) throw new Error("done cases are not overdue");
}

assertFeeComesFromSettings();
