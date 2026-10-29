/** Explicit ad-account allowlists. Names are not a brand. */

export const DEFAULT_LIBA_AD_ACCOUNTS = ["917903574641136", "1393650169256796"] as const;
export const DEFAULT_SHEMESH_AD_ACCOUNTS = ["2542541459538449"] as const;
export const DEFAULT_LIBA_GOOGLE_CUSTOMERS = ["6469861321"] as const;

export function accountDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/^act_/i, "").replace(/\D/g, "");
}

function extraIds(envName: string): string[] {
  const raw = process.env[envName]?.trim() ?? "";
  if (!raw) return [];
  return raw.split(/[,;\s]+/).map(accountDigits).filter(Boolean);
}

export function libaAdAccountIds(): Set<string> {
  return new Set([...DEFAULT_LIBA_AD_ACCOUNTS.map(accountDigits), ...extraIds("FACEBOOK_LIBA_AD_ACCOUNT_IDS")]);
}

export function shemeshAdAccountIds(): Set<string> {
  return new Set([
    ...DEFAULT_SHEMESH_AD_ACCOUNTS.map(accountDigits),
    ...extraIds("FACEBOOK_SHEMESH_AD_ACCOUNT_IDS"),
  ]);
}

export function libaGoogleCustomerIds(): Set<string> {
  return new Set([
    ...DEFAULT_LIBA_GOOGLE_CUSTOMERS.map(accountDigits),
    ...extraIds("GOOGLE_LIBA_CUSTOMER_IDS"),
  ]);
}

export function shemeshGoogleCustomerIds(): Set<string> {
  return new Set(extraIds("GOOGLE_SHEMESH_CUSTOMER_IDS"));
}

export function adAccountBrand(accountId: string | null | undefined): "liba" | "shemesh" | null {
  const id = accountDigits(accountId);
  if (!id) return null;
  if (shemeshAdAccountIds().has(id)) return "shemesh";
  if (libaAdAccountIds().has(id)) return "liba";
  return null;
}

export function googleCustomerBrand(customerId: string | null | undefined): "liba" | "shemesh" | null {
  const id = accountDigits(customerId);
  if (!id) return null;
  if (shemeshGoogleCustomerIds().has(id)) return "shemesh";
  if (libaGoogleCustomerIds().has(id)) return "liba";
  return null;
}
