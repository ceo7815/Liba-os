/** Rivhit Online API. Calls happen only after a token and company id are saved. */

export const RIVHIT_BASE = "https://api.rivhit.co.il/online/RivhitOnlineAPI.svc";
export const RIVHIT_READS = ["Document.List", "Receipt.List", "Customer.List", "Payment.Report"] as const;
export const RIVHIT_TEST = "Monitor.Get";

export type RivhitCache = Record<string, { at: string; body: unknown }>;

export function rivhitCacheKey(method: string, companyId: string, extra: Record<string, unknown>): string {
  return `${method}|${companyId}|${JSON.stringify(extra)}`;
}

export function rivhitMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** A cached read does not spend a paid operation. */
export function rivhitShouldCall(input: {
  cachedAt: string | null;
  now?: Date;
  maxAgeMs?: number;
  opsCount: number;
  opsMonth: string | null;
  quota: number | null;
}): { call: boolean; reason: string } {
  const now = input.now ?? new Date();
  const month = rivhitMonth(now);
  const count = input.opsMonth === month ? input.opsCount : 0;
  if (input.quota != null && count >= input.quota) return { call: false, reason: "המכסה החודשית נוצלה" };
  if (input.cachedAt) {
    const age = now.getTime() - Date.parse(input.cachedAt);
    if (Number.isFinite(age) && age < (input.maxAgeMs ?? 6 * 60 * 60 * 1000)) {
      return { call: false, reason: "מהמטמון" };
    }
  }
  return { call: true, reason: "קריאה" };
}

export async function rivhitPost(
  method: string,
  body: { api_token: string; company_id: string; [key: string]: unknown },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${RIVHIT_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body: payload };
}

export function assertRivhitCachesBeforeCalling(): void {
  const fresh = rivhitShouldCall({
    cachedAt: new Date().toISOString(),
    opsCount: 1,
    opsMonth: rivhitMonth(),
    quota: 10,
  });
  if (fresh.call || fresh.reason !== "מהמטמון") throw new Error("a fresh Rivhit read must not spend another operation");
  const blocked = rivhitShouldCall({
    cachedAt: null,
    opsCount: 10,
    opsMonth: rivhitMonth(),
    quota: 10,
  });
  if (blocked.call || blocked.reason !== "המכסה החודשית נוצלה") throw new Error("Rivhit must stop at the monthly quota");
}

assertRivhitCachesBeforeCalling();
