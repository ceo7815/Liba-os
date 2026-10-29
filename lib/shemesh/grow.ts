/** Grow (Meshulam) light server API. Live calls wait until userId and pageCode are saved. */

export const GROW_SANDBOX = "https://sandbox.meshulam.co.il/api/light/server/1.0/";
export const GROW_PRODUCTION = "https://secure.meshulam.co.il/api/light/server/1.0/";

export function growBase(environment: string): string {
  return environment === "production" ? GROW_PRODUCTION : GROW_SANDBOX;
}

export function growReady(input: { userId?: string | null; pageCode?: string | null }): boolean {
  return Boolean(input.userId?.trim() && input.pageCode?.trim());
}

export async function growApproveTransaction(input: {
  environment: string;
  userId: string;
  pageCode: string;
  apiKey?: string | null;
  transactionId: string;
  transactionToken?: string | null;
}): Promise<{ ok: boolean; status: number }> {
  const body = new URLSearchParams({
    userId: input.userId,
    pageCode: input.pageCode,
    transactionId: input.transactionId,
  });
  if (input.transactionToken) body.set("transactionToken", input.transactionToken);
  if (input.apiKey) body.set("apiKey", input.apiKey);
  const res = await fetch(`${growBase(input.environment)}approveTransaction`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status };
}
