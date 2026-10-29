/** Calculators only. Rates and amounts are inputs, never constants from the business file. */

export type BonusBand = { ceiling: number | null; rate: number };

export function withVat(amount: number, mode: "exclusive" | "inclusive", vatRate = 0.18): number {
  if (!Number.isFinite(amount)) return 0;
  if (mode === "inclusive") return amount;
  return amount * (1 + vatRate);
}

export function withoutVat(amount: number, mode: "exclusive" | "inclusive", vatRate = 0.18): number {
  if (!Number.isFinite(amount)) return 0;
  if (mode === "exclusive") return amount;
  return vatRate >= 0 ? amount / (1 + vatRate) : amount;
}

export function monthsToClear(balance: number, monthly: number): number | null {
  if (!(balance > 0) || !(monthly > 0)) return null;
  return Math.ceil(balance / monthly);
}

export function hourlyGross(hours: number, rate: number): number {
  if (!(hours > 0) || !(rate > 0)) return 0;
  return hours * rate;
}

export function collectionBonus(netCollected: number, bands: BonusBand[]): number {
  if (!(netCollected > 0) || bands.length === 0) return 0;
  const ordered = [...bands].sort((a, b) => (a.ceiling ?? Infinity) - (b.ceiling ?? Infinity));
  let previous = 0;
  let pay = 0;
  for (const band of ordered) {
    const ceiling = band.ceiling ?? Infinity;
    const slice = Math.max(0, Math.min(netCollected, ceiling) - previous);
    pay += slice * (band.rate || 0);
    previous = ceiling;
    if (netCollected <= ceiling) break;
  }
  return pay;
}

export function settlementGap(collectedInLiba: number, transferred: number): number {
  return (collectedInLiba || 0) - (transferred || 0);
}

export function matchReceipts<T extends { id: string; amount: number }>(
  receipts: T[],
  lines: { id: string; amount: number }[],
): { lineId: string; receiptId: string | null }[] {
  const used = new Set<string>();
  return lines.map((line) => {
    const receipt = receipts.find((item) => !used.has(item.id) && Math.abs(item.amount - line.amount) < 0.01);
    if (!receipt) return { lineId: line.id, receiptId: null };
    used.add(receipt.id);
    return { lineId: line.id, receiptId: receipt.id };
  });
}
