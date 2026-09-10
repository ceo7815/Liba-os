import type { Profile } from "@/lib/types";
import {
  canAccessAnyFinance,
  hasPermission,
} from "@/lib/permissions/access";
import type { PermissionKey } from "@/lib/permissions/catalog";

/** Legacy emails — still honored if permissions row missing. */
export const FINANCE_ALLOWED_EMAILS = [
  "ceo@beosystem.com",
  "asaf@liba-fs.co.il",
] as const;

export const SOURCE_PNL_PATH = "/finance/source-pnl";
export const INSURANCE_AGREEMENTS_PATH = "/finance/insurance-agreements";
export const SETTLED_COMMISSIONS_PATH = "/finance/settled";
/** Unified expenses hub (fixed + variable tabs). */
export const EXPENSES_PATH = "/finance/expenses";
/** @deprecated use EXPENSES_PATH — kept for redirects / old links */
export const FIXED_EXPENSES_PATH = EXPENSES_PATH;
export const GENERAL_PNL_PATH = "/finance/pl-general";
export const LEDGER_PATH = "/finance";

type FinanceProfile = Pick<Profile, "email" | "permissionKeys"> | null | undefined;

function isLegacyFinanceEmail(profile: FinanceProfile): boolean {
  if (!profile?.email) return false;
  const email = profile.email.trim().toLowerCase();
  return (FINANCE_ALLOWED_EMAILS as readonly string[]).includes(email);
}

/** Any finance area (nav section). */
export function canAccessFinance(profile: FinanceProfile): boolean {
  return canAccessAnyFinance(profile) || isLegacyFinanceEmail(profile);
}

export function canAccessSourcePnl(profile: FinanceProfile): boolean {
  return canAccessFinanceSection(profile, "finance.source_pnl");
}

/** נפרעים — הרשאה ייעודית, או מי שיש לו הסכמי ביטוח (אותו צוות כספים). */
export function canAccessSettledCommissions(profile: FinanceProfile): boolean {
  return (
    canAccessFinanceSection(profile, "finance.settled") ||
    canAccessFinanceSection(profile, "finance.insurance")
  );
}

export function canAccessFinanceSection(
  profile: FinanceProfile,
  key: Extract<PermissionKey, `finance.${string}`>,
): boolean {
  return hasPermission(profile, key) || isLegacyFinanceEmail(profile);
}
