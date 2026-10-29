import { CASE_STAGES } from "@/lib/shemesh/catalog";

/** Named lifecycle rules. Rates stay null until a setting is saved. Pending means not verified. */

export const SERVICE_TYPES = [
  { id: "redemption", label: "פדיון" },
  { id: "tax_refund", label: "החזר מס" },
  { id: "claim", label: "תביעה" },
  { id: "national_insurance", label: "ביטוח לאומי" },
  { id: "other", label: "אחר" },
] as const;

export type ServiceTypeId = (typeof SERVICE_TYPES)[number]["id"];

/** Document names only. No amounts. ייפוי כוח is the consent document. */
export const SERVICE_CHECKLIST: Record<ServiceTypeId, string[]> = {
  redemption: ["תעודת זהות", "ייפוי כוח", "אישור קופה"],
  tax_refund: ["תעודת זהות", "טופס 106", "ייפוי כוח"],
  claim: ["תעודת זהות", "מסמכי תביעה", "ייפוי כוח"],
  national_insurance: ["תעודת זהות", "טפסי ביטוח לאומי", "ייפוי כוח"],
  other: ["תעודת זהות"],
};

const STAGE_ORDER = CASE_STAGES.map((stage) => stage.id);

/** A case may stay or move one stage forward. Jumps are rejected. */
export function stageMoveAllowed(from: string, to: string): boolean {
  const current = STAGE_ORDER.indexOf(from as (typeof STAGE_ORDER)[number]);
  const next = STAGE_ORDER.indexOf(to as (typeof STAGE_ORDER)[number]);
  if (current < 0 || next < 0) return false;
  return next === current || next === current + 1;
}

export const TAX_PIPELINE = [
  { id: "open_lead", label: "ליד פתוח" },
  { id: "open_process", label: "תהליך פתוח" },
  { id: "filed", label: "הוגש" },
  { id: "received", label: "התקבל" },
  { id: "fee_billed", label: "שכר טרחה חויב" },
] as const;

export type TaxStatusId = (typeof TAX_PIPELINE)[number]["id"];

const TAX_LABELS: Record<string, TaxStatusId> = {
  open_lead: "open_lead",
  "ליד פתוח": "open_lead",
  open_process: "open_process",
  "תהליך פתוח": "open_process",
  בתהליך: "open_process",
  filed: "filed",
  הוגש: "filed",
  received: "received",
  התקבל: "received",
  fee_billed: "fee_billed",
  "שכר טרחה חויב": "fee_billed",
};

export function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  return days >= 0 ? days : null;
}

export function averageDays(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value != null);
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

export function soldInMonth<T extends { dealDate: string | null }>(rows: T[], month: string): T[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  return rows.filter((row) => row.dealDate?.slice(0, 7) === month);
}

export function feeFromReceived(received: number | null, rate: number | null, pending: boolean): { fee: number | null; pending: boolean } {
  if (pending || rate == null || received == null || !Number.isFinite(received) || !Number.isFinite(rate)) {
    return { fee: null, pending: true };
  }
  return { fee: Math.round(received * rate * 100) / 100, pending: false };
}

export function settledCommission(
  production: number | null,
  multiplier: number | null,
  status: string,
  pending: boolean,
): { income: number | null; counted: boolean; pending: boolean } {
  const settled = status === "fully_settled";
  if (!settled) return { income: null, counted: false, pending };
  if (pending || multiplier == null || production == null || !Number.isFinite(production) || !Number.isFinite(multiplier)) {
    return { income: null, counted: true, pending: true };
  }
  return { income: Math.round(production * multiplier * 100) / 100, counted: true, pending: false };
}

export function mapTaxStatus(raw: string): TaxStatusId | null {
  const key = raw.trim();
  return TAX_LABELS[key] ?? TAX_LABELS[key.toLowerCase()] ?? null;
}

export function countTaxPipeline(statuses: Array<string | null>): Record<TaxStatusId, number> {
  const counts = Object.fromEntries(TAX_PIPELINE.map((item) => [item.id, 0])) as Record<TaxStatusId, number>;
  for (const status of statuses) {
    const mapped = status ? mapTaxStatus(status) : null;
    if (mapped) counts[mapped] += 1;
  }
  return counts;
}

function assertLifecycleMath(): void {
  if (daysBetween("2026-10-01", "2026-10-05") !== 4) throw new Error("cycle days drifted");
  if (daysBetween("2026-10-05", "2026-10-01") !== null) throw new Error("negative cycle must stay empty");
  const sold = soldInMonth(
    [{ dealDate: "2026-10-02" }, { dealDate: "2026-09-30" }, { dealDate: null }],
    "2026-10",
  );
  if (sold.length !== 1) throw new Error("sold-this-month must follow deal_date");
  if (feeFromReceived(1000, 0.2, true).fee !== null) throw new Error("pending rate must not produce a fee");
  if (feeFromReceived(1000, null, false).fee !== null) throw new Error("missing rate must not invent a fee");
  if (feeFromReceived(1000, 0.2, false).fee !== 200) throw new Error("fee must be received times the named rate");
  const open = settledCommission(1000, 0.1, "open", false);
  if (open.counted || open.income !== null) throw new Error("only fully_settled rows count");
  const waiting = settledCommission(1000, null, "fully_settled", true);
  if (!waiting.counted || waiting.income !== null) throw new Error("settled row without a verified multiplier stays empty");
  if (settledCommission(1000, 0.1, "fully_settled", false).income !== 100) throw new Error("commission must be production times multiplier");
  if (mapTaxStatus("הוגש") !== "filed" || mapTaxStatus("לא מוכר") !== null) throw new Error("tax status map drifted");
  if (!stageMoveAllowed("lead", "eligibility") || stageMoveAllowed("lead", "filed")) {
    throw new Error("case stage may move only one step");
  }
}

assertLifecycleMath();
